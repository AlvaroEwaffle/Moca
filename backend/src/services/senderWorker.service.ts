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
    }, 30000); // Process every 30 seconds

    console.log('⏰ SenderWorkerService: Periodic processing scheduled every 30 seconds');
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
    try {
      console.log(`🔍 SenderWorkerService: Looking for queue items ready to process...`);
      
      // Get queue items ready to process
      const queueItems = await OutboundQueue.findReadyToProcess();
      console.log(`📋 SenderWorkerService: Found ${queueItems.length} queue items ready to process`);
      
      if (queueItems.length > 0) {
        console.log(`📋 SenderWorkerService: Queue items:`, queueItems.map(item => ({
          id: item.id,
          accountId: item.accountId,
          contactId: item.contactId,
          status: item.status,
          attempts: item.metadata.attempts
        })));
      }
      
      let processedCount = 0;
      for (const queueItem of queueItems) {
        console.log(`🔄 SenderWorkerService: Processing queue item: ${queueItem.id}`);
        const wasProcessed = await this.processQueueItem(queueItem);
        if (wasProcessed) processedCount++;
      }

      // Handle retries and cleanup
      const retryCount = await this.handleRetries();
      const cleanupCount = await this.cleanupExpiredItems();

      if (processedCount > 0 || retryCount > 0 || cleanupCount > 0) {
        console.log(`📤 SenderWorkerService: Processed ${processedCount} items, retried ${retryCount}, cleaned ${cleanupCount}`);
      }

    } catch (error) {
      console.error('❌ SenderWorkerService: Error in outbound queue processing:', error);
    }
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(queueItem: IOutboundQueue): Promise<boolean> {
    try {
      // Check rate limits
      const canSend = await this.checkRateLimits(queueItem);
      if (!canSend.canSend) {
        return false;
      }

      // Initialize Instagram service
      console.log(`🔧 SenderWorkerService: Initializing Instagram service for account: ${queueItem.accountId}`);
      const initialized = await instagramService.initialize(queueItem.accountId);
      if (!initialized) {
        console.log(`❌ SenderWorkerService: Failed to initialize Instagram service for queue item ${queueItem.id}`);
        await this.handleError(queueItem, 'Instagram service initialization failed');
        return false;
      }
      console.log(`✅ SenderWorkerService: Instagram service initialized successfully for account: ${queueItem.accountId}`);

      // Get contact information
      const contact = await this.getContact(queueItem.contactId);
      if (!contact) {
        console.log(`❌ SenderWorkerService: Contact not found for queue item ${queueItem.id}`);
        await this.handleError(queueItem, 'Contact not found');
        return false;
      }

      // Send the message
      let response;
      try {
        console.log(`📤 SenderWorkerService: Sending message to PSID: ${contact.psid}`);
        
        // For now, just send text messages
        response = await instagramService.sendTextMessage(contact.psid, queueItem.content.text);

        console.log(`✅ SenderWorkerService: Message sent successfully: ${response.message_id}`);
        
        // Update message status
        await this.updateMessageStatus(queueItem.messageId, 'sent', response.message_id);
        
        // Update queue item status
        await this.updateQueueItemStatus(queueItem.id, 'sent');
        
        // Update conversation metadata
        await this.updateConversationMetadata(queueItem.conversationId);

        return true; // Successfully processed

      } catch (error) {
        console.error(`❌ SenderWorkerService: Error sending message for queue item ${queueItem.id}:`, error instanceof Error ? error.message : String(error));
        
        // Check if this is a "user not found" error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('The requested user cannot be found')) {
          console.log(`🚫 SenderWorkerService: User not found for PSID ${contact.psid}, marking as failed permanently`);
          await this.updateQueueItemStatus(queueItem.id, 'failed');
          await this.updateMessageStatus(queueItem.messageId, 'failed');
          return false; // Don't retry for user not found errors
        }
        
        await this.handleError(queueItem, errorMessage);
        return false;
      }

    } catch (error) {
      console.error(`❌ SenderWorkerService: Error processing queue item ${queueItem.id}:`, error);
      await this.handleError(queueItem, error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Check rate limits before sending
   */
  private async checkRateLimits(queueItem: IOutboundQueue): Promise<{ canSend: boolean; reason?: string }> {
    try {
      // Get account rate limits
      const account = await InstagramAccount.findOne({ accountId: queueItem.accountId });
      if (!account) {
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
        updateData['metadata.instagramResponse.messageId'] = externalId;
        updateData['metadata.instagramResponse.status'] = 'sent';
        updateData['metadata.instagramResponse.timestamp'] = new Date();
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
  private async handleRetries(): Promise<number> {
    try {
      const failedItems = await OutboundQueue.findNeedingRetry();

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

      return retryCount;

    } catch (error) {
      console.error('❌ SenderWorkerService: Error handling retries:', error);
      return 0;
    }
  }

  /**
   * Clean up expired queue items
   */
  private async cleanupExpiredItems(): Promise<number> {
    try {
      const expiredItems = await OutboundQueue.findExpired();

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

      return cleanupCount;

    } catch (error) {
      console.error('❌ SenderWorkerService: Error cleaning up expired items:', error);
      return 0;
    }
  }
}

export default new SenderWorkerService();
