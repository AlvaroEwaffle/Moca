import OutboundQueue from '../models/outboundQueue.model';
import Message from '../models/message.model';
import Conversation from '../models/conversation.model';
import InstagramAccount from '../models/instagramAccount.model';
import { IOutboundQueue } from '../models/outboundQueue.model';
import instagramService from './instagramApi.service';

class SenderWorkerService {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    console.log('🔧 SenderWorkerService: Initializing service');
  }

  /**
   * Start the sender worker service
   */
  async start(): Promise<void> {
    console.log('🚀 SenderWorkerService: Starting sender worker service');
    
    if (this.isRunning) {
      console.log('⚠️ SenderWorkerService: Service is already running');
      return;
    }

    this.isRunning = true;
    console.log('✅ SenderWorkerService: Service started successfully');

    // Process immediately on start
    await this.process();

    // Set up interval for periodic processing
    this.intervalId = setInterval(async () => {
      console.log('⏰ SenderWorkerService: Periodic processing triggered');
      await this.process();
    }, 2000); // Process every 2 seconds

    console.log('⏰ SenderWorkerService: Periodic processing scheduled every 2 seconds');
  }

  /**
   * Stop the sender worker service
   */
  async stop(): Promise<void> {
    console.log('🛑 SenderWorkerService: Stopping sender worker service');
    
    if (!this.isRunning) {
      console.log('⚠️ SenderWorkerService: Service is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏰ SenderWorkerService: Periodic processing stopped');
    }

    console.log('✅ SenderWorkerService: Service stopped successfully');
  }

  /**
   * Main processing function
   */
  async process(): Promise<void> {
    console.log('📤 SenderWorkerService: Starting outbound queue processing');
    
    try {
      // Get queue items ready to process
      const queueItems = await OutboundQueue.findReadyToProcess();
      console.log(`📤 SenderWorkerService: Processing ${queueItems.length} outbound queue items`);

      for (const queueItem of queueItems) {
        console.log(`📤 SenderWorkerService: Processing queue item: ${queueItem.id}`);
        await this.processQueueItem(queueItem);
      }

      // Handle retries and cleanup
      await this.handleRetries();
      await this.cleanupExpiredItems();

    } catch (error) {
      console.error('❌ SenderWorkerService: Error in outbound queue processing:', error);
    }
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(queueItem: IOutboundQueue): Promise<void> {
    console.log(`📤 SenderWorkerService: Processing queue item: ${queueItem.id}`);
    
    try {
      // Check rate limits
      const canSend = await this.checkRateLimits(queueItem);
      if (!canSend.canSend) {
        console.log(`⏰ SenderWorkerService: Rate limit hit for queue item ${queueItem.id}: ${canSend.reason}`);
        return;
      }

      // Initialize Instagram service
      const initialized = await instagramService.initialize(queueItem.accountId);
      if (!initialized) {
        console.log(`❌ SenderWorkerService: Failed to initialize Instagram service for queue item ${queueItem.id}`);
        await this.handleError(queueItem, 'Instagram service initialization failed');
        return;
      }

      // Get contact information
      const contact = await this.getContact(queueItem.contactId);
      if (!contact) {
        console.log(`❌ SenderWorkerService: Contact not found for queue item ${queueItem.id}`);
        await this.handleError(queueItem, 'Contact not found');
        return;
      }

      console.log(`📤 SenderWorkerService: Sending message to PSID: ${contact.psid}`);

      // Send the message
      let response;
      try {
        // For now, just send text messages
        response = await instagramService.sendTextMessage(contact.psid, queueItem.content.text);

        console.log(`✅ SenderWorkerService: Message sent successfully: ${response.message_id}`);
        
        // Update message status
        await this.updateMessageStatus(queueItem.messageId, 'sent', response.message_id);
        
        // Update queue item status
        await this.updateQueueItemStatus(queueItem.id, 'sent');
        
        // Update conversation metadata
        await this.updateConversationMetadata(queueItem.conversationId);

      } catch (error) {
        console.error(`❌ SenderWorkerService: Error sending message for queue item ${queueItem.id}:`, error);
        await this.handleError(queueItem, error instanceof Error ? error.message : 'Unknown error');
      }

    } catch (error) {
      console.error(`❌ SenderWorkerService: Error processing queue item ${queueItem.id}:`, error);
      await this.handleError(queueItem, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Check rate limits before sending
   */
  private async checkRateLimits(queueItem: IOutboundQueue): Promise<{ canSend: boolean; reason?: string }> {
    console.log(`⏰ SenderWorkerService: Checking rate limits for queue item: ${queueItem.id}`);
    
    try {
      // Get account rate limits
      const account = await InstagramAccount.findOne({ accountId: queueItem.accountId });
      if (!account) {
        console.log(`❌ SenderWorkerService: Account not found for rate limit check: ${queueItem.accountId}`);
        return { canSend: false, reason: 'Account not found' };
      }

      // Check global rate limit (simplified implementation)
      const now = new Date();
      const oneSecondAgo = new Date(now.getTime() - 1000);
      
      // This is a simplified check - in production you'd want more sophisticated rate limiting
      if (account.rateLimits.messagesPerSecond > 0) {
        // Check if we've sent a message in the last second
        const recentMessages = await OutboundQueue.countDocuments({
          accountId: queueItem.accountId,
          status: 'sent',
          'metadata.lastAttempt': { $gte: oneSecondAgo }
        });

        if (recentMessages >= account.rateLimits.messagesPerSecond) {
          console.log(`⏰ SenderWorkerService: Global rate limit exceeded for account: ${queueItem.accountId}`);
          return { canSend: false, reason: 'Global rate limit exceeded' };
        }
      }

      // Check user cooldown
      if (account.rateLimits.userCooldown > 0) {
        const cooldownEnd = new Date(now.getTime() - (account.rateLimits.userCooldown * 1000));
        const recentUserMessages = await OutboundQueue.countDocuments({
          contactId: queueItem.contactId,
          status: 'sent',
          'metadata.lastAttempt': { $gte: cooldownEnd }
        });

        if (recentUserMessages > 0) {
          console.log(`⏰ SenderWorkerService: User cooldown active for contact: ${queueItem.contactId}`);
          return { canSend: false, reason: 'User cooldown active' };
        }
      }

      console.log(`✅ SenderWorkerService: Rate limits check passed for queue item: ${queueItem.id}`);
      return { canSend: true };

    } catch (error) {
      console.error(`❌ SenderWorkerService: Error checking rate limits:`, error);
      return { canSend: false, reason: 'Rate limit check error' };
    }
  }

  /**
   * Get contact information
   */
  private async getContact(contactId: string): Promise<any> {
    console.log(`👤 SenderWorkerService: Getting contact information: ${contactId}`);
    
    try {
      const Contact = (await import('../models/contact.model')).default;
      const contact = await Contact.findById(contactId);
      
      if (!contact) {
        console.log(`❌ SenderWorkerService: Contact not found: ${contactId}`);
        return null;
      }

      console.log(`✅ SenderWorkerService: Contact found: ${contact.psid}`);
      return contact;
    } catch (error) {
      console.error(`❌ SenderWorkerService: Error getting contact:`, error);
      return null;
    }
  }

  /**
   * Handle errors for queue items
   */
  private async handleError(queueItem: IOutboundQueue, errorMessage: string): Promise<void> {
    console.log(`🔄 SenderWorkerService: Handling error for queue item: ${queueItem.id}`);
    
    try {
      // Increment attempt count
      const attempts = queueItem.metadata.attempts + 1;
      const maxAttempts = queueItem.metadata.maxAttempts || 3;
      
      console.log(`🔄 SenderWorkerService: Attempt ${attempts}/${maxAttempts} for queue item: ${queueItem.id}`);

      if (attempts >= maxAttempts) {
        // Mark as permanently failed
        await this.updateQueueItemStatus(queueItem.id, 'failed');
        console.log(`❌ SenderWorkerService: Queue item ${queueItem.id} permanently failed after ${maxAttempts} attempts`);
      } else {
        // Schedule retry
        const retryDelay = this.calculateRetryDelay(attempts, 'exponential');
        const nextAttempt = new Date(Date.now() + retryDelay);
        
        await OutboundQueue.findByIdAndUpdate(queueItem.id, {
          'metadata.attempts': attempts,
          'metadata.lastAttempt': new Date(),
          'metadata.nextAttempt': nextAttempt,
          'metadata.errorHistory': [
            ...(queueItem.metadata.errorHistory || []),
            {
              timestamp: new Date(),
              error: errorMessage,
              attempt: attempts
            }
          ]
        });

        console.log(`⏰ SenderWorkerService: Queue item ${queueItem.id} marked for retry at ${nextAttempt.toISOString()}`);
      }

    } catch (error) {
      console.error(`❌ SenderWorkerService: Error handling error for queue item ${queueItem.id}:`, error);
    }
  }

  /**
   * Calculate retry delay based on strategy
   */
  private calculateRetryDelay(attempt: number, strategy: string = 'exponential'): number {
    console.log(`⏰ SenderWorkerService: Calculating retry delay for attempt ${attempt}, strategy: ${strategy}`);
    
    let delay: number;
    
    switch (strategy) {
      case 'exponential':
        delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
        break;
      case 'linear':
        delay = 5000 * attempt; // 5s, 10s, 15s...
        break;
      case 'fixed':
        delay = 10000; // 10 seconds
        break;
      default:
        delay = 5000; // Default 5 seconds
    }

    console.log(`⏰ SenderWorkerService: Calculated retry delay: ${delay}ms`);
    return delay;
  }

  /**
   * Update message status
   */
  private async updateMessageStatus(messageId: string, status: string, externalId?: string): Promise<void> {
    console.log(`📝 SenderWorkerService: Updating message status: ${messageId} -> ${status}`);
    
    try {
      const updateData: any = { status };
      if (externalId) {
        updateData['metadata.externalId'] = externalId;
        updateData['metadata.deliveryConfirmed'] = true;
      }

      await Message.findByIdAndUpdate(messageId, updateData);
      console.log(`✅ SenderWorkerService: Message status updated: ${messageId}`);
    } catch (error) {
      console.error(`❌ SenderWorkerService: Error updating message status:`, error);
    }
  }

  /**
   * Update queue item status
   */
  private async updateQueueItemStatus(queueItemId: string, status: string): Promise<void> {
    console.log(`📝 SenderWorkerService: Updating queue item status: ${queueItemId} -> ${status}`);
    
    try {
      await OutboundQueue.findByIdAndUpdate(queueItemId, {
        status,
        'metadata.lastAttempt': new Date()
      });
      console.log(`✅ SenderWorkerService: Queue item status updated: ${queueItemId}`);
    } catch (error) {
      console.error(`❌ SenderWorkerService: Error updating queue item status:`, error);
    }
  }

  /**
   * Update conversation metadata
   */
  private async updateConversationMetadata(conversationId: string): Promise<void> {
    console.log(`📝 SenderWorkerService: Updating conversation metadata: ${conversationId}`);
    
    try {
      await Conversation.findByIdAndUpdate(conversationId, {
        'timestamps.lastActivity': new Date(),
        'metrics.responseCount': { $inc: 1 }
      });
      console.log(`✅ SenderWorkerService: Updated conversation metadata: ${conversationId}`);
    } catch (error) {
      console.error(`❌ SenderWorkerService: Error updating conversation metadata:`, error);
    }
  }

  /**
   * Handle retries of failed messages
   */
  private async handleRetries(): Promise<void> {
    console.log('🔄 SenderWorkerService: Starting retry of failed messages');
    
    try {
      const failedItems = await OutboundQueue.findNeedingRetry();
      console.log(`📋 SenderWorkerService: Found ${failedItems.length} failed items to retry`);

      let retryCount = 0;
      for (const item of failedItems) {
        if (item.metadata.nextAttempt && item.metadata.nextAttempt <= new Date()) {
          console.log(`🔄 SenderWorkerService: Retrying failed item: ${item.id}`);
          
          // Reset status to pending for retry
          await OutboundQueue.findByIdAndUpdate(item.id, {
            status: 'pending',
            'metadata.nextAttempt': null
          });
          
          retryCount++;
        }
      }

      if (retryCount > 0) {
        console.log(`✅ SenderWorkerService: Reset ${retryCount} failed items for retry`);
      }

    } catch (error) {
      console.error('❌ SenderWorkerService: Error handling retries:', error);
    }
  }

  /**
   * Clean up expired queue items
   */
  private async cleanupExpiredItems(): Promise<void> {
    console.log('🧹 SenderWorkerService: Starting cleanup of expired queue items');
    
    try {
      const expiredItems = await OutboundQueue.findExpired();
      console.log(`📋 SenderWorkerService: Found ${expiredItems.length} expired items to clean up`);

      let cleanupCount = 0;
      for (const item of expiredItems) {
        console.log(`🧹 SenderWorkerService: Cleaning up expired item: ${item.id}`);
        
        // Mark as cancelled
        await OutboundQueue.findByIdAndUpdate(item.id, {
          status: 'cancelled',
          'metadata.cancelledAt': new Date(),
          'metadata.cancelReason': 'Expired'
        });
        
        cleanupCount++;
      }

      if (cleanupCount > 0) {
        console.log(`✅ SenderWorkerService: Cleaned up ${cleanupCount} expired items`);
      }

    } catch (error) {
      console.error('❌ SenderWorkerService: Error cleaning up expired items:', error);
    }
  }
}

export default new SenderWorkerService();
