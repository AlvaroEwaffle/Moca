import {
  getPendingDraftQueueItems,
  processDraftQueueItem,
  resetStuckDrafts
} from './emailDraftQueue.service';

/**
 * Worker service to automatically process email draft queue
 */
class EmailDraftWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkInterval = 30 * 1000; // Check every 30 seconds
  private batchSize = 3; // Process 3 drafts at a time

  /**
   * Start the worker
   */
  start() {
    if (this.intervalId) {
      console.log('⚠️ [Email Draft Worker] Worker is already running');
      return;
    }

    console.log('🔄 [Email Draft Worker] Starting worker...');
    
    // Run immediately on start
    this.processQueue();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, this.checkInterval);

    console.log(`✅ [Email Draft Worker] Worker started (checking every ${this.checkInterval / 1000} seconds)`);
  }

  /**
   * Stop the worker
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('🛑 [Email Draft Worker] Worker stopped');
    }
  }

  /**
   * Process pending drafts in the queue
   */
  private async processQueue() {
    if (this.isRunning) {
      console.log('⏸️  [Email Draft Worker] Already processing, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      // First, check for and reset stuck drafts (drafts stuck in 'generating' status)
      // This runs every time the worker processes the queue
      const stuckThresholdMinutes = 30; // Consider drafts stuck if in generating status for 30+ minutes
      const resetCount = await resetStuckDrafts(stuckThresholdMinutes);
      if (resetCount > 0) {
        console.log(`🔧 [Email Draft Worker] Reset ${resetCount} stuck draft(s) before processing queue`);
      }

      const pendingItems = await getPendingDraftQueueItems(this.batchSize);
      
      if (pendingItems.length === 0) {
        this.isRunning = false;
        return;
      }

      console.log(`📋 [Email Draft Worker] Found ${pendingItems.length} pending draft(s) to process`);

      // Process drafts sequentially to avoid overwhelming the system
      for (const item of pendingItems) {
        try {
          console.log(`🔄 [Email Draft Worker] Processing draft for email ${item.emailId} (${item.id})`);
          const result = await processDraftQueueItem(item.id);
          
          if (result.success) {
            console.log(`✅ [Email Draft Worker] Draft created successfully: ${result.draftId}`);
          } else {
            console.error(`❌ [Email Draft Worker] Draft generation failed: ${result.error}`);
          }
          
          // Small delay between items
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error: any) {
          console.error(`❌ [Email Draft Worker] Error processing draft ${item.id}:`, error.message);
        }
      }

      console.log(`✅ [Email Draft Worker] Finished processing ${pendingItems.length} draft(s)`);
    } catch (error: any) {
      console.error(`❌ [Email Draft Worker] Error processing queue:`, error.message);
    } finally {
      this.isRunning = false;
    }
  }
}

export default new EmailDraftWorker();


