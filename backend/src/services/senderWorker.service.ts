import OutboundQueue from '../models/outboundQueue.model';
import Message from '../models/message.model';
import Conversation from '../models/conversation.model';
import InstagramAccount from '../models/instagramAccount.model';
import InstagramApiService from './instagramApi.service';
import { IOutboundQueue } from '../models/outboundQueue.model';

// Rate limiting configuration
interface RateLimitConfig {
  globalRateLimit: number; // Messages per second globally
  userRateLimit: number; // Messages per second per user
  processingInterval: number; // How often to check queue (in milliseconds)
  batchSize: number; // How many messages to process per batch
}

export class SenderWorkerService {
  private config: RateLimitConfig;
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      globalRateLimit: parseInt(process.env.GLOBAL_RATE_LIMIT || '3'),
      userRateLimit: parseInt(process.env.USER_RATE_LIMIT || '1'),
      processingInterval: parseInt(process.env.SENDER_INTERVAL_MS || '250'), // 250ms
      batchSize: parseInt(process.env.SENDER_BATCH_SIZE || '5')
    };
  }

  /**
   * Start the sender worker
   */
  async start(): Promise<void> {
    try {
      if (this.isRunning) {
        console.log('⚠️ Sender worker is already running');
        return;
      }

      console.log('🚀 Starting sender worker service');
      this.isRunning = true;

      // Start processing loop
      this.processingInterval = setInterval(async () => {
        if (this.isRunning) {
          await this.processOutboundQueue();
        }
      }, this.config.processingInterval);

      console.log('✅ Sender worker started successfully');
    } catch (error) {
      console.error('❌ Error starting sender worker:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the sender worker
   */
  async stop(): Promise<void> {
    try {
      console.log('🛑 Stopping sender worker service');
      this.isRunning = false;

      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }

      console.log('✅ Sender worker stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping sender worker:', error);
      throw error;
    }
  }

  /**
   * Process the outbound queue
   */
  async processOutboundQueue(): Promise<void> {
    try {
      // Get items ready to process
      const queueItems = await OutboundQueue.findReadyToProcess(this.config.batchSize);
      
      if (queueItems.length === 0) {
        return; // No items to process
      }

      console.log(`📤 Processing ${queueItems.length} outbound queue items`);

      for (const queueItem of queueItems) {
        try {
          await this.processQueueItem(queueItem);
        } catch (error) {
          console.error(`❌ Error processing queue item ${queueItem.id}:`, error);
          await this.handleProcessingError(queueItem, error);
        }
      }

    } catch (error) {
      console.error('❌ Error processing outbound queue:', error);
    }
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(queueItem: IOutboundQueue): Promise<void> {
    try {
      console.log(`📤 Processing queue item: ${queueItem.id}`);

      // Check rate limits before processing
      const canSend = await this.checkRateLimits(queueItem);
      if (!canSend.canSend) {
        console.log(`⏰ Rate limit hit for queue item ${queueItem.id}: ${canSend.reason}`);
        if (canSend.retryAfter) {
          queueItem.metadata.nextAttempt = canSend.retryAfter;
          await queueItem.save();
        }
        return;
      }

      // Mark as processing
      queueItem.status = 'processing';
      queueItem.metadata.lastAttempt = new Date();
      await queueItem.save();

      // Get the message to send
      const message = await Message.findById(queueItem.messageId);
      if (!message) {
        throw new Error(`Message not found: ${queueItem.messageId}`);
      }

      // Get Instagram account
      const account = await InstagramAccount.findById(queueItem.accountId);
      if (!account) {
        throw new Error(`Instagram account not found: ${queueItem.accountId}`);
      }

      // Initialize Instagram API service
      const instagramService = new InstagramApiService(account.accountId);

      // Send message via Instagram API
      const startTime = Date.now();
      const response = await instagramService.sendMessage(
        queueItem.contactId, // PSID
        queueItem.content.text,
        {
          quickReplies: queueItem.content.quickReplies,
          buttons: queueItem.content.buttons as any
        }
      );
      const processingTime = Date.now() - startTime;

      // Update queue item status
      queueItem.status = 'sent';
      queueItem.metadata.totalProcessingTime += processingTime;
      await queueItem.save();

      // Update message status
      message.status = 'sent';
      message.metadata.instagramResponse = {
        messageId: response.message_id,
        status: 'sent',
        timestamp: new Date()
      };
      await message.save();

      // Update conversation metadata
      await this.updateConversationMetadata(queueItem.conversationId, message.id);

      console.log(`✅ Message sent successfully: ${response.message_id}`);

    } catch (error) {
      console.error(`❌ Error processing queue item ${queueItem.id}:`, error);
      throw error;
    }
  }

  /**
   * Check rate limits before sending
   */
  private async checkRateLimits(queueItem: IOutboundQueue): Promise<{
    canSend: boolean;
    reason?: string;
    retryAfter?: Date;
  }> {
    try {
      const now = new Date();
      const oneSecondAgo = new Date(now.getTime() - 1000);

      // Check global rate limit
      if (this.config.globalRateLimit > 0) {
        const globalMessagesInLastSecond = await OutboundQueue.countDocuments({
          status: 'sent',
          'metadata.lastAttempt': { $gte: oneSecondAgo }
        });

        if (globalMessagesInLastSecond >= this.config.globalRateLimit) {
          return {
            canSend: false,
            reason: 'Global rate limit exceeded',
            retryAfter: new Date(now.getTime() + 1000)
          };
        }
      }

      // Check user rate limit
      if (this.config.userRateLimit > 0) {
        const userMessagesInLastSecond = await OutboundQueue.countDocuments({
          contactId: queueItem.contactId,
          status: 'sent',
          'metadata.lastAttempt': { $gte: oneSecondAgo }
        });

        if (userMessagesInLastSecond >= this.config.userRateLimit) {
          return {
            canSend: false,
            reason: 'User rate limit exceeded',
            retryAfter: new Date(now.getTime() + 1000)
          };
        }
      }

      return { canSend: true };
    } catch (error) {
      console.error('❌ Error checking rate limits:', error);
      return { canSend: false, reason: 'Error checking rate limits' };
    }
  }

  /**
   * Handle processing errors
   */
  private async handleProcessingError(queueItem: IOutboundQueue, error: any): Promise<void> {
    try {
      console.log(`🔄 Handling error for queue item: ${queueItem.id}`);

      // Increment attempt count
      queueItem.metadata.attempts += 1;
      queueItem.metadata.lastAttempt = new Date();
      
      // Calculate next attempt time
      const delayMs = queueItem.retryStrategy === 'immediate' ? 0 : 
                     queueItem.retryStrategy === 'fixed' ? queueItem.metadata.baseDelayMs :
                     queueItem.retryStrategy === 'custom' && queueItem.customRetryDelays ? 
                       queueItem.customRetryDelays[Math.min(queueItem.metadata.attempts, queueItem.customRetryDelays.length - 1)] || queueItem.metadata.baseDelayMs :
                     queueItem.metadata.baseDelayMs * Math.pow(queueItem.metadata.backoffMultiplier, queueItem.metadata.attempts);
      queueItem.metadata.nextAttempt = new Date(Date.now() + delayMs);

      // Determine if we should retry
      if (queueItem.metadata.attempts < queueItem.metadata.maxAttempts) {
        // Add error to history
        queueItem.metadata.errorHistory.push({
          attempt: queueItem.metadata.attempts,
          timestamp: new Date(),
          errorCode: error.code || 'UNKNOWN',
          errorMessage: error.message || 'Unknown error',
          retryAfter: queueItem.metadata.nextAttempt
        });

        // Set status to failed (will be retried)
        queueItem.status = 'failed';
        await queueItem.save();

        console.log(`⏰ Queue item ${queueItem.id} marked for retry at ${queueItem.metadata.nextAttempt}`);
      } else {
        // Max attempts reached, mark as permanently failed
        queueItem.status = 'failed';
        queueItem.notes.push(`Max retry attempts (${queueItem.metadata.maxAttempts}) reached`);
        await queueItem.save();

        // Update message status
        await Message.findByIdAndUpdate(queueItem.messageId, {
          status: 'failed',
          'metadata.errorDetails': {
            code: error.code || 'UNKNOWN',
            message: error.message || 'Max retry attempts reached'
          }
        });

        console.log(`❌ Queue item ${queueItem.id} permanently failed after ${queueItem.metadata.maxAttempts} attempts`);
      }

    } catch (saveError) {
      console.error('❌ Error saving error state for queue item:', saveError);
    }
  }

  /**
   * Update conversation metadata after successful send
   */
  private async updateConversationMetadata(conversationId: string, messageId: string): Promise<void> {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      // Update bot message timestamp
      conversation.timestamps.lastBotMessage = new Date();
      conversation.timestamps.lastActivity = new Date();

      // Update metrics
      conversation.metrics.totalMessages += 1;
      conversation.metrics.botMessages += 1;
      conversation.metrics.responseRate = Math.round(
        (conversation.metrics.botMessages / conversation.metrics.userMessages) * 100
      );

      // Update message count
      conversation.messageCount += 1;

      await conversation.save();
      console.log(`✅ Updated conversation metadata: ${conversationId}`);

    } catch (error) {
      console.error('❌ Error updating conversation metadata:', error);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    cancelled: number;
  }> {
    try {
      const stats = await OutboundQueue.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const result = {
        total: 0,
        pending: 0,
        processing: 0,
        sent: 0,
        failed: 0,
        cancelled: 0
      };

      stats.forEach(stat => {
        result[stat._id as keyof typeof result] = stat.count;
        result.total += stat.count;
      });

      return result;
    } catch (error) {
      console.error('❌ Error getting queue stats:', error);
      return {
        total: 0,
        pending: 0,
        processing: 0,
        sent: 0,
        failed: 0,
        cancelled: 0
      };
    }
  }

  /**
   * Retry failed messages
   */
  async retryFailedMessages(): Promise<number> {
    try {
      console.log('🔄 Starting retry of failed messages');

      const failedItems = await OutboundQueue.findNeedingRetry();
      console.log(`📋 Found ${failedItems.length} failed items to retry`);

      let retryCount = 0;
      for (const item of failedItems) {
        try {
          // Reset status to pending for retry
          item.status = 'pending';
          await item.save();
          retryCount++;
        } catch (error) {
          console.error(`❌ Error resetting failed item ${item.id}:`, error);
        }
      }

      console.log(`✅ Reset ${retryCount} failed items for retry`);
      return retryCount;

    } catch (error) {
      console.error('❌ Error retrying failed messages:', error);
      return 0;
    }
  }

  /**
   * Clean up expired queue items
   */
  async cleanupExpiredItems(): Promise<number> {
    try {
      console.log('🧹 Starting cleanup of expired queue items');

      const expiredItems = await OutboundQueue.findExpired();
      console.log(`📋 Found ${expiredItems.length} expired items to clean up`);

      let cleanupCount = 0;
      for (const item of expiredItems) {
        try {
          // Mark as cancelled
          item.status = 'cancelled';
          item.notes.push(`Expired at ${new Date().toISOString()}`);
          await item.save();
          cleanupCount++;
        } catch (error) {
          console.error(`❌ Error cleaning up expired item ${item.id}:`, error);
        }
      }

      console.log(`✅ Cleaned up ${cleanupCount} expired items`);
      return cleanupCount;

    } catch (error) {
      console.error('❌ Error cleaning up expired items:', error);
      return 0;
    }
  }

  /**
   * Get worker status
   */
  getStatus(): {
    isRunning: boolean;
    config: RateLimitConfig;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      uptime: this.isRunning ? Date.now() - (this.processingInterval ? Date.now() : 0) : 0
    };
  }
}

export default SenderWorkerService;
