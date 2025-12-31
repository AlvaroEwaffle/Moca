import {
  getPendingDraftQueueItems,
  processDraftQueueItem,
  resetStuckDrafts
} from './emailDraftQueue.service';
import { logger } from '../utils/logger';

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
      logger.warn('email-draft-worker', 'Worker is already running');
      return;
    }

    logger.info('email-draft-worker', 'Starting worker', { checkIntervalSeconds: this.checkInterval / 1000 });
    
    // Run immediately on start
    this.processQueue();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, this.checkInterval);

    logger.info('email-draft-worker', 'Worker started successfully', { checkIntervalSeconds: this.checkInterval / 1000 });
  }

  /**
   * Stop the worker
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      logger.info('email-draft-worker', 'Worker stopped');
    }
  }

  /**
   * Process pending drafts in the queue
   */
  private async processQueue() {
    if (this.isRunning) {
      logger.debug('email-draft-worker', 'Already processing, skipping cycle');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();

    try {
      // First, check for and reset stuck drafts (drafts stuck in 'generating' status)
      // This runs every time the worker processes the queue
      const stuckThresholdMinutes = 30; // Consider drafts stuck if in generating status for 30+ minutes
      const resetCount = await resetStuckDrafts(stuckThresholdMinutes);
      if (resetCount > 0) {
        logger.warn('email-draft-worker', `Reset ${resetCount} stuck draft(s) before processing queue`, { resetCount });
      }

      const pendingItems = await getPendingDraftQueueItems(this.batchSize);
      
      if (pendingItems.length === 0) {
        this.isRunning = false;
        return;
      }

      logger.info('email-draft-worker', `Found ${pendingItems.length} pending draft(s) to process`, {
        pendingCount: pendingItems.length,
        itemIds: pendingItems.map(i => i.id)
      });

      // Process drafts sequentially to avoid overwhelming the system
      for (const item of pendingItems) {
        try {
          logger.info('email-draft-worker', `Processing draft for email`, {
            draftQueueItemId: item.id,
            emailId: item.emailId,
            conversationId: item.conversationId,
            contactId: item.contactId
          });
          const result = await processDraftQueueItem(item.id);
          
          if (result.success) {
            logger.info('email-draft-worker', 'Draft created successfully', {
              draftQueueItemId: item.id,
              draftId: result.draftId,
              emailId: item.emailId
            });
          } else {
            logger.error('email-draft-worker', 'Draft generation failed', {
              draftQueueItemId: item.id,
              emailId: item.emailId,
              error: result.error
            });
          }
          
          // Small delay between items
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error: any) {
          logger.error('email-draft-worker', 'Error processing draft', {
            draftQueueItemId: item.id,
            emailId: item.emailId,
            error: error.message,
            stack: error.stack
          });
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      logger.info('email-draft-worker', `Finished processing ${pendingItems.length} draft(s)`, {
        processedCount: pendingItems.length,
        durationMs: duration,
        durationSeconds: Math.round(duration / 1000)
      });
    } catch (error: any) {
      logger.error('email-draft-worker', 'Error processing queue', {
        error: error.message,
        stack: error.stack
      });
    } finally {
      this.isRunning = false;
    }
  }
}

export default new EmailDraftWorker();


