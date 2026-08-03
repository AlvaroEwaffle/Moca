import OutboundQueue from '../models/outboundQueue.model';
import Message from '../models/message.model';
import Conversation from '../models/conversation.model';
import LeadFollowUp from '../models/leadFollowUp.model';
import { IOutboundQueue } from '../models/outboundQueue.model';
import { getChannelAdapter, ChannelSendError } from './channels';
import { ChannelAccount } from './channels/types';
import { resolveChannel } from '../types/channel';
import { notifyError } from '../utils/slack';

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
      notifyError({ service: 'SenderWorker', message: 'Error in outbound queue processing', error });
    }
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(queueItem: IOutboundQueue): Promise<boolean> {
    try {
      const channel = resolveChannel(queueItem.channel);
      const adapter = getChannelAdapter(channel);

      // Resolve the sending account through the adapter — Instagram reads
      // InstagramAccount, WhatsApp reads WhatsappAccount, and rate limiting
      // below no longer needs to know which.
      const account = await adapter.getAccount(queueItem.accountId);
      if (!account) {
        console.log(`❌ SenderWorkerService: ${channel} account not found for queue item ${queueItem.id}: ${queueItem.accountId}`);
        await this.handleError(queueItem, `${channel} account not found: ${queueItem.accountId}`);
        return false;
      }

      // Check rate limits
      const canSend = await this.checkRateLimits(queueItem, account);
      if (!canSend.canSend) {
        return false;
      }

      // Get contact information
      const contact = await this.getContact(queueItem.contactId);
      if (!contact) {
        console.log(`❌ SenderWorkerService: Contact not found for queue item ${queueItem.id}`);
        await this.handleError(queueItem, 'Contact not found');
        return false;
      }

      // Conversation is needed by adapters that enforce a service window
      // (WhatsApp reads timestamps.lastInboundAt off it).
      const conversation = await this.getConversation(queueItem.conversationId);

      // Send the message
      try {
        console.log(`📤 SenderWorkerService: Sending ${channel} message to ${adapter.describeRecipient(contact)}`);

        const result = await adapter.sendText({
          account,
          contact,
          conversation,
          text: queueItem.content.text
        });

        console.log(`✅ SenderWorkerService: Message sent successfully: ${result.externalId ?? 'no external id'}`);

        // Update message status
        await this.updateMessageStatus(queueItem.messageId, 'sent', result.externalId, adapter);

        // Update queue item status
        await this.updateQueueItemStatus(queueItem.id, 'sent');

        // Keep follow-up analytics/unblocking state in sync for synthetic follow-up messages
        await this.updateFollowUpRecord(queueItem, 'sent');

        // Update conversation metadata
        await this.updateConversationMetadata(queueItem.conversationId);

        return true; // Successfully processed

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ SenderWorkerService: Error sending message for queue item ${queueItem.id}:`, errorMessage);
        notifyError({
          service: 'SenderWorker',
          message: `Failed to send ${channel} message`,
          error,
          context: { queueItemId: queueItem.id, channel }
        });

        // Permanent failures are decided by the adapter, which knows its own
        // API's error semantics. Retrying them can never succeed.
        if (error instanceof ChannelSendError && error.permanent) {
          console.log(`🚫 SenderWorkerService: Permanent ${channel} failure (${error.code}) for ${adapter.describeRecipient(contact)} — not retrying`);
          await this.recordPermanentFailure(queueItem, error);
          return false;
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
   * Mark a queue item dead without consuming retries, keeping the reason.
   *
   * The old terminal path recorded no error at all, so the most relevant
   * failure — the last one — was exactly the one that vanished. Anything that
   * ends a message's life now writes down why.
   */
  private async recordPermanentFailure(queueItem: IOutboundQueue, error: ChannelSendError): Promise<void> {
    try {
      const historyEntry = {
        attempt: (queueItem.metadata?.attempts ?? 0) + 1,
        timestamp: new Date(),
        errorCode: error.code,
        errorMessage: error.message
      };

      await OutboundQueue.findByIdAndUpdate(queueItem.id, {
        'metadata.lastAttempt': new Date(),
        'metadata.errorHistory': [...(queueItem.metadata?.errorHistory || []), historyEntry]
      });
    } catch (updateError) {
      console.error('❌ SenderWorkerService: Error recording permanent failure:', updateError);
    }

    await this.updateQueueItemStatus(queueItem.id, 'failed');
    await this.updateMessageStatus(queueItem.messageId, 'failed');
    await this.updateFollowUpRecord(queueItem, 'failed');
  }

  /**
   * Check rate limits before sending
   */
  private async checkRateLimits(
    queueItem: IOutboundQueue,
    account: ChannelAccount
  ): Promise<{ canSend: boolean; reason?: string }> {
    try {
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

      console.log(`✅ SenderWorkerService: Contact found: ${contact.id}`);
      return contact;
    } catch (error) {
      console.error(`❌ SenderWorkerService: Error getting contact:`, error);
      return null;
    }
  }

  /**
   * Load the conversation for adapters that need its state.
   *
   * Returns null rather than throwing: synthetic follow-up queue items can
   * reference a conversation that no longer exists, and for Instagram the
   * conversation is not consulted at all.
   */
  private async getConversation(conversationId: string): Promise<any | null> {
    try {
      if (!conversationId) return null;
      return await Conversation.findById(conversationId);
    } catch (error) {
      console.error(`❌ SenderWorkerService: Error getting conversation ${conversationId}:`, error);
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

      // The schema field is `errorMessage`, not `error`. Writing `error` meant
      // mongoose stripped it and every history entry persisted as just
      // {attempt, timestamp} — a failure log that records THAT it failed but
      // never WHY. That is how @ewaffle.cl sat with a dead token for five months
      // without anyone being able to see the reason.
      const historyEntry = {
        attempt: attempts,
        timestamp: new Date(),
        errorCode: /token|OAuth|190|expired/i.test(errorMessage) ? 'auth' : 'send',
        errorMessage: String(errorMessage || 'unknown error'),
      };
      const errorHistory = [...(queueItem.metadata.errorHistory || []), historyEntry];

      if (attempts >= maxAttempts) {
        // Mark as permanently failed — and keep the reason. Previously the
        // terminal path recorded no error at all, so the LAST (most relevant)
        // failure was the one that vanished.
        await OutboundQueue.findByIdAndUpdate(queueItem.id, {
          'metadata.attempts': attempts,
          'metadata.lastAttempt': new Date(),
          'metadata.errorHistory': errorHistory,
        });
        await this.updateQueueItemStatus(queueItem.id, 'failed');
        await this.updateFollowUpRecord(queueItem, 'failed');
        console.log(`❌ SenderWorkerService: Queue item ${queueItem.id} permanently failed after ${maxAttempts} attempts: ${errorMessage}`);
      } else {
        // Schedule retry
        const retryDelay = this.calculateRetryDelay(attempts, 'exponential');
        const nextAttempt = new Date(Date.now() + retryDelay);

        await OutboundQueue.findByIdAndUpdate(queueItem.id, {
          'metadata.attempts': attempts,
          'metadata.lastAttempt': new Date(),
          'metadata.nextAttempt': nextAttempt,
          'metadata.errorHistory': errorHistory,
        });

        console.log(`⏰ SenderWorkerService: Queue item ${queueItem.id} retry at ${nextAttempt.toISOString()} — ${errorMessage}`);
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
  private async updateMessageStatus(
    messageId: string,
    status: string,
    externalId?: string,
    adapter?: { buildSentUpdate(externalId?: string): Record<string, any> }
  ): Promise<void> {
    console.log(`📝 SenderWorkerService: Updating message status: ${messageId} -> ${status}`);

    try {
      // Skip Message update for follow-up/rescue messages (they don't have a Message document)
      if (messageId.startsWith('followup_')) {
        console.log(`⏭️ SenderWorkerService: Skipping Message update for follow-up message: ${messageId}`);
        return;
      }

      // The adapter decides where the external id lands, so an Instagram
      // message_id never overwrites a wamid or vice versa.
      const updateData: any = { status, ...(adapter?.buildSentUpdate(externalId) ?? {}) };

      await Message.findByIdAndUpdate(messageId, updateData);
      console.log(`✅ SenderWorkerService: Message status updated: ${messageId}`);
    } catch (error) {
      console.error(`❌ SenderWorkerService: Error updating message status:`, error);
    }
  }

  /**
   * Update LeadFollowUp state for synthetic follow-up queue messages.
   */
  private async updateFollowUpRecord(queueItem: IOutboundQueue, status: 'sent' | 'failed'): Promise<void> {
    const followUpId = (queueItem.metadata as any)?.followUpId;
    if (!followUpId) {
      return;
    }

    try {
      const now = new Date();
      const updateData: any = {
        status,
        lastFollowUpAt: now
      };

      if (status === 'sent') {
        updateData.sentAt = now;
      }

      await LeadFollowUp.findByIdAndUpdate(followUpId, updateData);
      console.log(`✅ SenderWorkerService: Follow-up ${followUpId} marked as ${status}`);
    } catch (error) {
      console.error(`❌ SenderWorkerService: Error updating follow-up record:`, error);
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
