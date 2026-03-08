import crypto from 'crypto';
import Contact from '../models/contact.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import InstagramAccount from '../models/instagramAccount.model';
import InstagramComment from '../models/instagramComment.model';
import OutboundQueue from '../models/outboundQueue.model';
import KeywordActivationRule from '../models/keywordActivationRule.model';
import { IContact } from '../models/contact.model';
import { IConversation } from '../models/conversation.model';
import { IMessage } from '../models/message.model';
import debounceWorkerService from './debounceWorker.service';
import { notifyError } from '../utils/slack';

// Meta webhook payload interfaces
interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    messaging?: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        attachments?: Array<{
          type: string;
          payload: {
            url?: string;
            sticker_id?: number;
          };
        }>;
        quick_reply?: {
          payload: string;
        };
        reply_to?: {
          mid: string;
        };
      };
      postback?: {
        payload: string;
        title: string;
      };
      delivery?: {
        mids: string[];
        watermark: number;
      };
      read?: {
        watermark: number;
      };
    }>;
    messages?: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: string;
      message: {
        mid: string;
        text: string;
      };
    }>;
    changes?: Array<{
      field: string;
      value: any;
    }>;
  }>;
}

interface InstagramMessage {
  mid: string;
  psid: string;
  recipient?: { id: string };
  entryId?: string; // entry.id from webhook = our Instagram Professional account ID (Meta docs)
  text?: string;
  is_echo?: boolean; // Indicates if message was sent by your business account
  attachments?: Array<{
    type: string;
    url?: string;
    stickerId?: number;
  }>;
  quickReply?: string;
  replyTo?: string;
  timestamp: number;
  type: 'message' | 'postback' | 'delivery' | 'read';
}

export class InstagramWebhookService {
  private verifyToken: string;
  private appSecret: string;

  constructor() {
    this.verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || '';
    this.appSecret = process.env.INSTAGRAM_APP_SECRET || '';
  }

  /**
   * Verify webhook signature for security
   */
  async validateSignature(payload: string, signature: string): Promise<boolean> {
    try {
      if (!this.appSecret) {
        throw new Error('INSTAGRAM_APP_SECRET is not configured — refusing to process webhook without signature validation');
      }

      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', this.appSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('Error validating webhook signature:', error);
      return false;
    }
  }

  /**
   * Handle webhook verification challenge
   */
  handleVerification(mode: string, token: string, challenge: string): string | null {
    console.log('🔍 [Webhook Verification] Received:', { mode, token, challenge });
    console.log('🔍 [Webhook Verification] Expected token:', this.verifyToken || 'NOT SET');
    console.log('🔍 [Webhook Verification] Token match:', token === this.verifyToken);
    
    if (mode === 'subscribe' && token === this.verifyToken) {
      console.log('✅ Webhook verified successfully');
      return challenge;
    }
    
    console.error('❌ Webhook verification failed');
    return null;
  }

  /**
   * Process incoming webhook payload
   */
  async handleWebhook(payload: MetaWebhookPayload): Promise<void> {
    try {
      console.log('📥 Processing Instagram webhook payload');

      if (payload.object !== 'instagram' && payload.object !== 'page') {
        console.log('⚠️ Ignoring non-Instagram webhook');
        return;
      }

      for (const entry of payload.entry) {
        // Handle different types of Instagram webhook events
        if (entry.messaging) {
          // Direct messages (legacy format). entry.id = our Instagram Professional account ID per Meta docs.
          for (const messaging of entry.messaging) {
            await this.processMessaging(entry, messaging);
          }
        } else if (entry.changes) {
          // Comments and other changes
          for (const change of entry.changes) {
            await this.processChange(change, entry.id);
          }
        } else if (entry.messages) {
          // Direct messages (new format)
          for (const message of entry.messages) {
            await this.processMessageEvent(message);
          }
        } else {
          console.log('⚠️ Unknown entry structure detected');
        }
      }

      console.log('✅ Webhook processing completed');
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      notifyError({ service: 'Webhook', message: 'Error processing incoming webhook', error });
      throw error;
    }
  }

  /**
   * Process Instagram changes (comments, messages, etc.)
   */
  private async processChange(change: any, accountId: string): Promise<void> {
    try {
      console.log(`📝 Processing Instagram change: ${change.field} for account: ${accountId}`);

      if (change.field === 'comments') {
        await this.processComment(change.value, accountId);
      } else if (change.field === 'messages') {
        await this.processMessageChange(change.value);
      } else {
        console.log(`⚠️ Unhandled change field: ${change.field}`);
      }
    } catch (error) {
      console.error('❌ Error processing change:', error);
    }
  }

  /**
   * Process Instagram message change (from changes array)
   */
  private async processMessageChange(messageChange: any): Promise<void> {
    try {
      console.log(`📨 Processing message change from PSID: ${messageChange.sender?.id}`);

      const messageData: InstagramMessage = {
        mid: messageChange.message?.mid || `change_msg_${Date.now()}`,
        psid: messageChange.sender?.id || `change_user_${Date.now()}`,
        text: messageChange.message?.text || '',
        timestamp: parseInt(messageChange.timestamp) * 1000 || Date.now(), // Convert to milliseconds
        type: 'message'
      };

      // Process the message
      await this.processMessage(messageData);
    } catch (error) {
      console.error('❌ Error processing message change:', error);
    }
  }

  /**
   * Process Instagram comment
   */
  private async processComment(comment: any, accountId: string): Promise<void> {
    try {
      console.log(`💬 Processing comment from user: ${comment.from?.username || comment.from?.id}`);
      console.log(`💬 Comment text: "${comment.text}"`);
      console.log(`💬 Media ID: ${comment.media?.id}`);
      console.log(`💬 Account ID from webhook: ${accountId}`);

      // Find the Instagram account using the account ID from the webhook
      // The webhook sends either the accountId or pageScopedId, so we need to check both
      const account = await InstagramAccount.findOne({ 
        $or: [
          { accountId: accountId, isActive: true },
          { pageScopedId: accountId, isActive: true }
        ]
      });
      if (!account) {
        console.error('❌ No Instagram account found for account ID:', accountId);
        console.error('❌ Searched both accountId and pageScopedId fields');
        return;
      }
      
      console.log(`✅ Found Instagram account: ${account.accountName} (${account.accountId})`);

      // Check if comment processing is enabled for this account
      if (!account.commentSettings?.enabled) {
        console.log(`⚠️ Comment processing disabled for account: ${account.accountName}`);
        return;
      }

      // BOT COMMENT DETECTION: Check if this is our own comment (infinite loop prevention)
      const isOurComment = comment.from?.id === account.accountId || 
                          comment.from?.username === account.accountName ||
                          comment.text === account.commentSettings?.commentMessage ||
                          comment.text?.includes('Gracias por tu comentario') ||
                          comment.text?.includes('Te contactaremos por DM') ||
                          comment.text?.includes('🙏') ||
                          comment.text?.includes('📩');
      
      if (isOurComment) {
        console.log(`🤖 [Bot Detection] Our own comment detected (${comment.from?.username || comment.from?.id}), skipping to prevent infinite loop`);
        return;
      }

      // ADDITIONAL SAFETY: Check if we've recently replied to this media (within last 5 minutes)
      const recentReply = await InstagramComment.findOne({
        mediaId: comment.media?.id,
        accountId: account.accountId,
        status: 'replied',
        replyTimestamp: { $gte: new Date(Date.now() - 300000) } // Within last 5 minutes
      });
      
      if (recentReply) {
        console.log(`⚠️ [Bot Detection] Recent reply found for media ${comment.media?.id} (${recentReply.replyTimestamp}), skipping to prevent spam`);
        return;
      }

      // ROBUST DEDUPLICATION: Check if comment already exists or is being processed
      const existingComment = await InstagramComment.findOne({ 
        $or: [
          { commentId: comment.id },
          { commentId: comment.id, status: { $in: ['pending', 'processing', 'replied'] } }
        ]
      });
      
      if (existingComment) {
        console.log(`⚠️ Comment ${comment.id} already exists with status: ${existingComment.status}, skipping`);
        return;
      }

      // ADDITIONAL SAFETY: Check for recent comments with same ID (within last 30 seconds)
      const recentComment = await InstagramComment.findOne({
        commentId: comment.id,
        createdAt: { $gte: new Date(Date.now() - 30000) } // Within last 30 seconds
      });
      
      if (recentComment) {
        console.log(`⚠️ Comment ${comment.id} was processed recently (${recentComment.createdAt}), skipping duplicate`);
        return;
      }

      // Create comment record
      // Validate and convert timestamp
      const timestampValue = comment.timestamp ? parseInt(comment.timestamp) : Math.floor(Date.now() / 1000);
      const timestamp = isNaN(timestampValue) ? new Date() : new Date(timestampValue * 1000);
      
      console.log(`💬 Comment timestamp: ${comment.timestamp} -> ${timestampValue} -> ${timestamp.toISOString()}`);

      const commentDoc = new InstagramComment({
        commentId: comment.id,
        accountId: account.accountId,
        mediaId: comment.media?.id,
        userId: comment.from?.id,
        username: comment.from?.username,
        text: comment.text,
        timestamp: timestamp,
        status: 'pending'
      });

      await commentDoc.save();
      console.log(`✅ Created comment record: ${commentDoc.id}`);

      // Process comment with fixed responses (if enabled)
      if (account.commentSettings?.autoReplyComment || account.commentSettings?.autoReplyDM) {
        // Import and use the comment service
        const { InstagramCommentService } = await import('./instagramComment.service');
        const commentService = new InstagramCommentService();
        
        try {
          await commentService.processComment(comment, account.accountId);
          console.log(`✅ Comment processed successfully: ${comment.id}`);
        } catch (error) {
          console.error('❌ Error processing comment with service:', error);
          // Update comment status to failed
          commentDoc.status = 'failed';
          await commentDoc.save();
        }
      }

    } catch (error) {
      console.error('❌ Error processing comment:', error);
    }
  }

  /**
   * Process Instagram message event (new format)
   */
  private async processMessageEvent(messageEvent: any): Promise<void> {
    try {
      console.log(`📨 Processing message event from PSID: ${messageEvent.sender.id}`);

      const messageData: InstagramMessage = {
        mid: messageEvent.message.mid,
        psid: messageEvent.sender.id,
        text: messageEvent.message.text,
        timestamp: parseInt(messageEvent.timestamp) * 1000, // Convert to milliseconds
        type: 'message'
      };

      // Process the message
      await this.processMessage(messageData);
    } catch (error) {
      console.error('❌ Error processing message event:', error);
    }
  }

  /**
   * Process individual messaging event
   * @param entry - Webhook entry; entry.id is our Instagram Professional account ID (Meta docs)
   */
  private async processMessaging(entry: { id: string }, messaging: any): Promise<void> {
    try {
      const psid = messaging.sender.id;
      const recipientId = messaging.recipient.id;
      const entryId = entry.id;
      const timestamp = messaging.timestamp * 1000; // Convert to milliseconds

      // Determine message type and extract content
      let messageData: InstagramMessage | null = null;

      if (messaging.message) {
        messageData = {
          mid: messaging.message.mid,
          psid,
          recipient: { id: recipientId },
          entryId,
          text: messaging.message.text,
          is_echo: messaging.message.is_echo === true,
          attachments: messaging.message.attachments?.map((att: any) => ({
            type: att.type,
            url: att.payload?.url,
            stickerId: att.payload?.sticker_id
          })),
          quickReply: messaging.message.quick_reply?.payload,
          replyTo: messaging.message.reply_to?.mid,
          timestamp,
          type: 'message'
        };
      } else if (messaging.postback) {
        messageData = {
          mid: `postback_${timestamp}_${psid}`,
          psid,
          recipient: { id: recipientId },
          entryId,
          text: messaging.postback.title,
          timestamp,
          type: 'postback'
        };
      } else if (messaging.delivery) {
        // Handle delivery receipts
        await this.processDeliveryReceipt(psid, messaging.delivery);
        return;
      } else if (messaging.read) {
        // Handle read receipts
        await this.processReadReceipt(psid, messaging.read);
        return;
      }

      if (messageData) {
        await this.processMessage(messageData);
      }
    } catch (error) {
      console.error('❌ Error processing messaging event:', error);
    }
  }

  /**
   * Process incoming message
   */
  private async processMessage(messageData: InstagramMessage): Promise<void> {
    try {
      console.log(`📨 Processing message from PSID: ${messageData.psid}, MID: ${messageData.mid}`);
      console.log(`🔧 [Webhook] Message recipient ID: ${messageData.recipient?.id || 'NOT PROVIDED'}`);
      console.log(`🔧 [Webhook] Is Echo (Bot Message): ${messageData.is_echo || false}`);
      console.log(`🔧 [Webhook] Processing message from PSID: ${messageData.psid || 'unknown'}`);

      // CRITICAL: Check if message already exists FIRST (before account identification)
      // This prevents processing the same message twice when Instagram sends multiple webhooks
      // with the same MID but different sender/recipient perspectives
      const existingMessage = await Message.findOne({ mid: messageData.mid });
      if (existingMessage) {
        console.log(`⚠️ [Deduplication] Message ${messageData.mid} already exists with role=${existingMessage.role}, skipping duplicate webhook`);
        return;
      }

      // IMPROVED: Check if this is a message we sent by searching in multiple places
      // 1. Check Message collection by Instagram response messageId (primary check)
      const sentMessage = await Message.findOne({ 
        'metadata.instagramResponse.messageId': messageData.mid,
        role: 'assistant'
      });
      
      if (sentMessage) {
        console.log(`🤖 [Bot Detection] Bot message detected by Message ID in Message collection, skipping processing to avoid loops: ${messageData.mid}`);
        return;
      }

      // 2. IMPROVED: Check OutboundQueue for recently sent messages that might match
      // Look for messages in the queue that were sent recently (within last 2 minutes)
      // and check if any sent message has the same MID stored
      const recentQueueItems = await OutboundQueue.find({
        status: 'sent',
        'metadata.lastAttempt': { 
          $gte: new Date(Date.now() - 120000) // Check last 2 minutes
        }
      }).limit(10); // Limit to recent items only
      
      // For each queue item, check if the associated message has this MID
      for (const queueItem of recentQueueItems) {
        const associatedMessage = await Message.findById(queueItem.messageId);
        if (associatedMessage && associatedMessage.metadata?.instagramResponse?.messageId === messageData.mid) {
          console.log(`🤖 [Bot Detection] Bot message detected by matching MID in OutboundQueue/Message, skipping: ${messageData.mid}`);
          return;
        }
      }

      // 3. Check is_echo flag (Instagram's own indicator)
      const isEchoFlag = messageData.is_echo === true;
      
      // 4. Additional bot detection: Check if this is a comment-related DM response
      const isCommentRelatedDM = Boolean(messageData.text && (
        messageData.text.includes('Thanks for commenting') ||
        messageData.text.includes('DM us for more info') ||
        messageData.text.includes('How can we help you today')
      ));
      
      const isBotMessageByFlags = isEchoFlag || isCommentRelatedDM;
      console.log(`🤖 [Bot Detection] Flags: is_echo=${messageData.is_echo}, isCommentRelatedDM=${isCommentRelatedDM}, isBotMessageByFlags=${isBotMessageByFlags}`);
      
      // Identify account: use recipient.id and/or entry.id (entry.id = our Instagram Professional account ID per Meta docs)
      const accountResult = await this.identifyAccountByPSID(messageData.psid, messageData.recipient?.id, isBotMessageByFlags, messageData.entryId);
      if (!accountResult) {
        if (isBotMessageByFlags) {
          // Echo messages from unregistered accounts are expected until the account re-authenticates via OAuth
          console.warn(`⚠️ [Echo Skip] Outgoing echo from unregistered account PSID ${messageData.psid} — connect this account via OAuth to register its webhook ID`);
        } else {
          console.error('❌ [CRITICAL ERROR] Cannot process message - account identification failed');
          console.error('❌ [CRITICAL ERROR] PSID:', messageData.psid);
          console.error('❌ [CRITICAL ERROR] Recipient ID:', messageData.recipient?.id || 'NOT PROVIDED');
          console.error('❌ [CRITICAL ERROR] Message MID:', messageData.mid);
          console.error('❌ [CRITICAL ERROR] Message text:', messageData.text?.substring(0, 100) || 'NO TEXT');
          console.error('❌ [CRITICAL ERROR] Message will be SKIPPED to prevent incorrect account assignment');
          notifyError({
            service: 'Webhook',
            message: 'CRITICAL: Account identification failed — message skipped',
            context: { psid: messageData.psid, recipientId: messageData.recipient?.id, mid: messageData.mid }
          });
        }
        return;
      }

      const { account: instagramAccount, isBotMessage: isBotMessageFromAccount } = accountResult;
      
      // CRITICAL FIX #1: Check if sender is our account - if so, create message but don't trigger AI response
      const senderIsOurAccount = messageData.psid === instagramAccount.pageScopedId;
      console.log(`🔍 [Bot Detection - Account Check] Checking if sender is our account:`);
      console.log(`🔍 [Bot Detection - Account Check] Sender PSID: ${messageData.psid}`);
      console.log(`🔍 [Bot Detection - Account Check] Account pageScopedId: ${instagramAccount.pageScopedId}`);
      console.log(`🔍 [Bot Detection - Account Check] Account accountId: ${instagramAccount.accountId}`);
      console.log(`🔍 [Bot Detection - Account Check] Account name: ${instagramAccount.accountName}`);
      console.log(`🔍 [Bot Detection - Account Check] Comparison result: senderIsOurAccount = ${senderIsOurAccount}`);
      
      if (senderIsOurAccount) {
        console.log(`🤖 [Bot Detection] Message sent FROM our own account (${instagramAccount.accountName}).`);
        console.log(`🤖 [Bot Detection] Sender PSID (${messageData.psid}) matches account pageScopedId (${instagramAccount.pageScopedId}).`);
        console.log(`🤖 [Bot Detection] This is our own message - will create message with role='assistant' but won't trigger AI response.`);
        console.log(`🤖 [Bot Detection] Message MID: ${messageData.mid}, Text: ${messageData.text?.substring(0, 50) || 'NO TEXT'}...`);
        
        // Check if message already exists (deduplication)
        const existingMessage = await Message.findOne({ mid: messageData.mid });
        if (existingMessage) {
          console.log(`⚠️ Message ${messageData.mid} already exists, skipping`);
          return;
        }
        
        // When we send a message, the recipientId is the lead's PSID
        // We need to find/create the contact and conversation based on recipientId
        if (!messageData.recipient?.id) {
          console.warn(`⚠️ [Manual Message] No recipient ID found for our own message, cannot create conversation. Skipping.`);
          return;
        }
        
        const recipientPSID = messageData.recipient.id;
        console.log(`🤖 [Manual Message] Our message sent TO lead PSID: ${recipientPSID}`);
        
        // Get or create contact based on recipient PSID
        const contact = await this.upsertContact(recipientPSID, {
          ...messageData,
          psid: recipientPSID // Use recipient as the contact PSID
        } as InstagramMessage, instagramAccount);
        console.log(`🤖 [Manual Message] Using contact: ${contact.id} for recipient PSID: ${recipientPSID}`);
        
        // Get or create conversation
        const conversation = await this.getOrCreateConversation(contact.id, instagramAccount.accountId);
        console.log(`🤖 [Manual Message] Using conversation: ${conversation.id}`);
        
        // Create message with role='assistant' so it appears on the right side in UI
        // Mark it as manual message (isManual=true) to identify it was sent by owner
        const message = await this.createMessage(
          messageData,
          conversation.id,
          contact.id,
          instagramAccount.accountId,
          instagramAccount,
          true // isManual = true (this message was sent manually by owner)
        );
        console.log(`✅ [Manual Message] Created message record with role='assistant': ${message.id}`);
        console.log(`✅ [Manual Message] Message will appear in UI but won't trigger AI response.`);
        
        // Update conversation metadata but don't trigger AI response
        conversation.timestamps.lastBotMessage = new Date(messageData.timestamp || Date.now());
        conversation.timestamps.lastActivity = new Date(messageData.timestamp || Date.now());
        conversation.metrics.totalMessages += 1;
        conversation.metrics.botMessages += 1;
        
        // Check for keyword activation in manual messages (e.g., if owner sends "LANDING" message)
        // This allows the owner to activate the agent by sending a keyword manually
        if (messageData.text && !conversation.settings?.activatedByKeyword) {
          const keywordDetectionResult = await this.checkKeywordActivation(
            messageData.text,
            instagramAccount.accountId,
            conversation,
            true // senderIsOurAccount = true (this is our message)
          );
          
          if (keywordDetectionResult.activated) {
            console.log(`✅ [Keyword Activation - Manual Message] Conversation ${conversation.id} activated by keyword in manual message: "${keywordDetectionResult.keyword}"`);
            console.log(`✅ [Keyword Activation - Manual Message] Bot will now respond to messages in this conversation`);
            // Initialize settings if not present
            if (!conversation.settings) {
              conversation.settings = {
                aiEnabled: true,
                responseCounter: {
                  totalResponses: 0,
                  lastResetAt: new Date(),
                  disabledByResponseLimit: false,
                  disabledByLeadScore: false,
                  disabledByMilestone: false
                }
              };
            }
            conversation.settings.activatedByKeyword = true;
            conversation.settings.activationKeyword = keywordDetectionResult.keyword;
            conversation.settings.aiEnabled = true; // Ensure AI is enabled
          }
        }
        
        await conversation.save();
        
        return; // STOP - Don't trigger AI response for our own messages
      } else {
        console.log(`✅ [Bot Detection - Account Check] Sender is NOT our account - continuing with normal processing.`);
      }

      // Additional check: if account identification marked this as a bot message
      if (isBotMessageFromAccount || isBotMessageByFlags) {
        console.log(`🤖 [Bot Detection] Bot message detected by account identification or flags, skipping processing to avoid loops: ${messageData.mid}`);
        return;
      }
      
      console.log(`✅ Using Instagram account: ${instagramAccount.accountName} (${instagramAccount.userEmail})`);

      // Check if we have a recent message with same text from same user (Meta duplicate webhook)
      const recentDuplicate = await Message.findOne({
        'content.text': messageData.text,
        psid: messageData.psid,
        role: 'user',
        'metadata.timestamp': { 
          $gte: new Date(Date.now() - 10000) // Within last 10 seconds
        }
      });

      if (recentDuplicate) {
        console.log(`⚠️ Duplicate message content from same user within 10s, skipping: "${messageData.text}"`);
        return;
      }

      // Additional check: Look for any message with same MID in the last 30 seconds (extra safety)
      const recentMessageByMid = await Message.findOne({
        mid: messageData.mid,
        'metadata.timestamp': { 
          $gte: new Date(Date.now() - 30000) // Within last 30 seconds
        }
      });

      if (recentMessageByMid) {
        console.log(`⚠️ Message with same MID processed recently, skipping: ${messageData.mid}`);
        return;
      }

      // Determine which PSID to use for contact
      // At this point, we know senderIsOurAccount is FALSE (we already checked and returned if true)
      // So this is a normal message from a lead
      const contactPSID = messageData.psid;
        console.log(`📥 [Contact Selection] Message received from lead. Using sender PSID as contact: ${contactPSID}`);

      // Get or create contact
      const contact = await this.upsertContact(contactPSID, messageData, instagramAccount);
      console.log(`🔍 [Message Processing] Using contact: ${contact.id} for PSID: ${contactPSID}`);

      // Get or create conversation
      const conversation = await this.getOrCreateConversation(contact.id, instagramAccount.accountId);
      console.log(`🔍 [Message Processing] Using conversation: ${conversation.id} for contact: ${contact.id}`);

      // Check for keyword activation (works for both lead and owner messages)
      // Only check if conversation is not already activated by keyword
      if (messageData.text && !conversation.settings?.activatedByKeyword) {
        const keywordDetectionResult = await this.checkKeywordActivation(
          messageData.text,
          instagramAccount.accountId,
          conversation,
          senderIsOurAccount
        );
        
        if (keywordDetectionResult.activated) {
          console.log(`✅ [Keyword Activation] Conversation ${conversation.id} activated by keyword: "${keywordDetectionResult.keyword}"`);
          console.log(`✅ [Keyword Activation] Bot will now respond to messages in this conversation`);
          // Conversation is now activated, will be saved with keyword info
          if (!conversation.settings) {
            conversation.settings = {
              aiEnabled: true,
              responseCounter: {
                totalResponses: 0,
                lastResetAt: new Date(),
                disabledByResponseLimit: false,
                disabledByLeadScore: false,
                disabledByMilestone: false
              }
            };
          }
          conversation.settings.activatedByKeyword = true;
          conversation.settings.activationKeyword = keywordDetectionResult.keyword;
          conversation.settings.aiEnabled = true; // Ensure AI is enabled
          await conversation.save();
        }
      }

      // Create message record (pass instagramAccount to avoid extra query)
      const message = await this.createMessage(messageData, conversation.id, contact.id, instagramAccount.accountId, instagramAccount);

      // Update conversation metadata
      await this.updateConversationMetadata(conversation.id, messageData);

      // Trigger message collection for batching (SAFE: preserves all bot detection logic)
      try {
        await debounceWorkerService.triggerMessageCollection(conversation.id, message);
        console.log(`🎯 Webhook: Triggered message collection for batching: ${message.id}`);
      } catch (error) {
        console.error(`❌ Webhook: Error triggering message collection:`, error);
        // Don't fail the webhook if batching fails - fallback to immediate processing
      }

      console.log(`✅ User message processed successfully: ${message.id}`);
    } catch (error) {
      console.error('❌ Error processing message:', error);
      notifyError({ service: 'Webhook', message: 'Error processing incoming message', error });
      throw error;
    }
  }

  /**
   * Get or create Instagram account for webhook processing
   */
  private async getOrCreateInstagramAccount(recipientId?: string): Promise<any> {
    try {
      console.log(`🔧 [Webhook] Searching for Instagram account with recipientId: ${recipientId}`);
      
      // First, try to find account by recipient ID (Instagram account ID)
      let account = null;
      
      if (recipientId) {
        account = await InstagramAccount.findOne({ 
          accountId: recipientId,
          isActive: true 
        });
        console.log(`🔧 [Webhook] Account search by recipientId result:`, account ? 'Found' : 'Not found');
      }
      
      // If not found by recipientId, try to find any active account
      if (!account) {
        console.log('🔧 [Webhook] Searching for any active Instagram account...');
        const allAccounts = await InstagramAccount.find({ isActive: true });
        console.log(`🔧 [Webhook] Found ${allAccounts.length} active accounts:`, allAccounts.map(acc => ({
          accountId: acc.accountId,
          accountName: acc.accountName,
          userId: acc.userId,
          userEmail: acc.userEmail
        })));
        
        account = allAccounts[0]; // Use the first active account
        if (account) {
          console.log(`⚠️ [Webhook] Using first active account: ${account.accountName} (${account.userEmail})`);
        }
      }

      if (!account) {
        console.error('❌ [Webhook] No active Instagram account found in database!');
        console.error('❌ [Webhook] This means no user has connected their Instagram account yet.');
        console.error('❌ [Webhook] Webhook cannot process messages without a valid Instagram account.');
        return null;
      }

      console.log(`✅ [Webhook] Found account: ${account.accountName} (User: ${account.userEmail})`);
      console.log(`🔧 [Webhook] Account details:`, {
        accountId: account.accountId,
        userId: account.userId,
        hasValidToken: !!account.accessToken && account.accessToken !== 'dummy_token',
        tokenExpiry: account.tokenExpiry
      });
      
      // Validate that we have a real token, not dummy_token
      if (!account.accessToken || account.accessToken === 'dummy_token') {
        console.error('❌ [Webhook] Account has invalid token (dummy_token or empty)!');
        console.error('❌ [Webhook] This account cannot send messages. User needs to reconnect Instagram.');
        return null;
      }
      
      return account;
    } catch (error) {
      console.error('❌ Error getting Instagram account:', error);
      return null;
    }
  }

  /**
   * Validate and fix corrupted timestamps
   */
  private validateTimestamp(timestamp: any): Date {
    try {
      const date = new Date(timestamp);
      
      // Check if date is valid and not corrupted (not in far future or past)
      const now = new Date();
      const year = date.getFullYear();
      
      // If year is before 2020 or after 2030, it's likely corrupted
      if (year < 2020 || year > 2030) {
        console.warn(`⚠️ [Timestamp Fix] Corrupted timestamp detected: ${timestamp}, using current time`);
        return new Date();
      }
      
      return date;
    } catch (error) {
      console.warn(`⚠️ [Timestamp Fix] Invalid timestamp: ${timestamp}, using current time`);
      return new Date();
    }
  }

  /**
   * Upsert contact based on PSID
   */
  private async upsertContact(psid: string, messageData: InstagramMessage, instagramAccount?: any): Promise<IContact> {
    try {
      console.log(`🔍 [Contact Lookup] Looking for contact with PSID: ${psid}`);
      // Try to find contact by psid and channel first (new format), then fallback to psid only (backward compatibility)
      let contact = await Contact.findOne({ psid, channel: 'instagram' }) || await Contact.findOne({ psid });
      console.log(`🔍 [Contact Lookup] Found contact:`, contact ? contact.id : 'null');

      if (!contact) {
        console.log(`👤 Creating new contact for PSID: ${psid}`);
        
        // Fetch Instagram username if account is available
        let instagramData = undefined;
        if (instagramAccount?.accessToken) {
          const username = await this.getInstagramUsername(psid, instagramAccount.accessToken);
          if (username) {
            instagramData = {
              username,
              lastFetched: new Date(),
              // isVerified removed from simplified model
              isPrivate: false
            };
          }
        }
        
        // Validate and fix timestamp
        const messageTimestamp = this.validateTimestamp(messageData.timestamp);
        
        contact = new Contact({
          psid,
          channel: 'instagram', // Set channel for new contacts
          metadata: {
            firstSeen: messageTimestamp,
            lastSeen: messageTimestamp,
            messageCount: 1,
            responseCount: 0,
            source: 'instagram_dm',
            instagramData
          },
          preferences: {
            language: 'es', // Default to Spanish
            timezone: 'America/Santiago',
            contactMethod: 'instagram'
          },
          status: 'active',
          lastActivity: messageTimestamp
        });

        console.log(`🔍 [Contact Creation] Instagram data being saved:`, instagramData);
        await contact.save();
        console.log(`✅ Created new contact: ${contact.id}`);
        console.log(`🔍 [Contact Creation] Saved contact metadata:`, contact.metadata);
      } else {
        console.log(`👤 Updating existing contact: ${contact.id}`);
        
        // Ensure channel is set for backward compatibility (migrate old contacts)
        if (!contact.channel) {
          contact.channel = 'instagram';
        }
        
        // Update last seen and message count with validated timestamp
        const messageTimestamp = this.validateTimestamp(messageData.timestamp);
        contact.metadata.lastSeen = messageTimestamp;
        contact.metadata.messageCount += 1;
        contact.lastActivity = messageTimestamp;

        // Fetch username if not already stored or if it's been a while
        if (instagramAccount?.accessToken && (!contact.metadata.instagramData?.username || 
            (Date.now() - contact.metadata.instagramData.lastFetched.getTime()) > 24 * 60 * 60 * 1000)) { // 24 hours
          console.log(`🔍 [Contact Update] Fetching username for existing contact: ${contact.id}`);
          const username = await this.getInstagramUsername(psid, instagramAccount.accessToken);
          if (username) {
            console.log(`🔍 [Contact Update] Username fetched: ${username}`);
            contact.metadata.instagramData = {
              username,
              lastFetched: new Date(),
              // isVerified removed from simplified model
              // isPrivate removed from simplified model
              ...contact.metadata.instagramData
            };
            console.log(`🔍 [Contact Update] Updated instagramData:`, contact.metadata.instagramData);
          }
        }

        await contact.save();
        console.log(`🔍 [Contact Update] Saved contact metadata for PSID: ${psid}`);
      }

      return contact;
    } catch (error) {
      console.error('❌ Error upserting contact:', error);
      throw error;
    }
  }

  /**
   * Get or create conversation for contact
   */
  private async getOrCreateConversation(contactId: string, accountId: string): Promise<IConversation> {
    try {
      let conversation = await Conversation.findOne({
        contactId,
        accountId,
        status: { $in: ['open', 'scheduled'] }
      });

      if (!conversation) {
        console.log(`💬 Creating new conversation for contact: ${contactId}`);
        
        // Get account to check defaultAgentEnabled setting
        const account = await InstagramAccount.findOne({ accountId, isActive: true });
        const defaultAgentEnabled = account?.settings?.defaultAgentEnabled ?? false; // Default to false if not set
        
        console.log(`🔧 [New Conversation] Account defaultAgentEnabled: ${defaultAgentEnabled} (account: ${account?.accountName || accountId})`);
        
        conversation = new Conversation({
          contactId,
          accountId,
          status: 'open',
          timestamps: {
            createdAt: new Date(),
            lastUserMessage: new Date(),
            lastActivity: new Date()
          },
          context: {
            sentiment: 'neutral',
            urgency: 'medium',
            language: 'es',
            timezone: 'America/Santiago'
          },
          metrics: {
            totalMessages: 0,
            userMessages: 0,
            botMessages: 0,
            responseRate: 0,
            engagementScore: 0,
            satisfactionScore: 0,
            conversionProbability: 0
          },
          settings: {
            autoRespond: true,
            aiEnabled: defaultAgentEnabled, // Use account's default setting
            priority: 'normal',
            businessHoursOnly: false
          },
          isActive: true,
          messageCount: 0,
          unreadCount: 0
        });

        await conversation.save();
        console.log(`✅ Created new conversation: ${conversation.id} with aiEnabled: ${defaultAgentEnabled}`);
      } else {
        console.log(`💬 Using existing conversation: ${conversation.id}`);
      }

      return conversation;
    } catch (error) {
      console.error('❌ Error getting/creating conversation:', error);
      throw error;
    }
  }

  /**
   * Create message record
   */
  private async createMessage(
    messageData: InstagramMessage, 
    conversationId: string, 
    contactId: string, 
    accountId: string,
    instagramAccount?: any, // Optional: pass account to avoid extra query
    isManual?: boolean // Optional: true if message was sent manually by owner
  ): Promise<IMessage> {
    try {
      // CRITICAL FIX #2: Get the InstagramAccount to compare with pageScopedId (not accountId)
      // Use passed account if available, otherwise query
      const account = instagramAccount || await InstagramAccount.findOne({ accountId });
      if (!account) {
        throw new Error(`Account not found: ${accountId}`);
      }

      // Determine if this message is from our bot or from a user
      // Compare sender PSID with account's pageScopedId (not accountId - they are different!)
      const isBotMessage = messageData.psid === account.pageScopedId;
      const messageRole = isBotMessage ? 'assistant' : 'user';
      
      console.log(`🔍 [Message Role Detection] Creating message record:`);
      console.log(`🔍 [Message Role Detection] PSID=${messageData.psid}`);
      console.log(`🔍 [Message Role Detection] AccountID=${accountId}`);
      console.log(`🔍 [Message Role Detection] Account pageScopedId=${account.pageScopedId}`);
      console.log(`🔍 [Message Role Detection] Comparison: ${messageData.psid} === ${account.pageScopedId} = ${isBotMessage}`);
      console.log(`🔍 [Message Role Detection] Determined role: ${messageRole}`);
      
      // Additional safety check: if role is assistant but we're processing it, log warning
      // This should NOT happen if our early checks are working, but it's a safety net
      // EXCEPT if this is a manual message (isManual=true), in which case it's intentional
      if (isBotMessage && !isManual) {
        console.warn(`⚠️ [Message Role Detection] CRITICAL WARNING: Detected bot message being created!`);
        console.warn(`⚠️ [Message Role Detection] This should have been caught earlier by senderIsOurAccount check.`);
        console.warn(`⚠️ [Message Role Detection] PSID: ${messageData.psid}, pageScopedId: ${account.pageScopedId}, Account: ${account.accountName}`);
        console.warn(`⚠️ [Message Role Detection] Message will be created with role='assistant' but should not trigger AI response.`);
      } else if (isBotMessage && isManual) {
        console.log(`✅ [Message Role Detection] Creating manual message with role='assistant' (intentional)`);
      }
      
      console.log(`💾 [Message Creation] Storing recipientId: ${messageData.recipient?.id}`);
      
      const message = new Message({
        mid: messageData.mid,
        conversationId,
        contactId,
        accountId,
        recipientId: messageData.recipient?.id,
        role: messageRole,
        content: {
          text: messageData.text || messageData.type,
          attachments: messageData.attachments?.map(att => ({
            type: att.type as any,
            url: att.url || '',
            caption: undefined
          })) || []
        },
        metadata: {
          timestamp: new Date(messageData.timestamp),
          isConsolidated: false,
          originalMids: [messageData.mid],
          aiGenerated: false,
          isManual: isManual || false, // Mark as manual if sent by owner
          processingTime: 0
        },
        status: 'received',
        priority: 'normal',
        isRead: false,
        deliveryConfirmed: true // Instagram webhook confirms delivery
      });

      await message.save();
      console.log(`✅ Created message record: ${message.id}`);
      console.log(`✅ [Message Saved] recipientId stored: ${message.recipientId}`);

      return message;
    } catch (error) {
      console.error('❌ Error creating message:', error);
      throw error;
    }
  }

  /**
   * Update conversation metadata after new message
   */
  private async updateConversationMetadata(conversationId: string, messageData: InstagramMessage): Promise<void> {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      // Update timestamps
      conversation.timestamps.lastUserMessage = new Date(messageData.timestamp);
      conversation.timestamps.lastActivity = new Date(messageData.timestamp);

      // Update metrics
      conversation.metrics.totalMessages += 1;
      conversation.metrics.userMessages += 1;
      conversation.messageCount += 1;
      conversation.unreadCount += 1;

      // Update context based on message content
      if (messageData.text) {
        const text = messageData.text.toLowerCase();
        
        // Simple keyword analysis for context
        if (text.includes('urgente') || text.includes('asap') || text.includes('inmediato')) {
          conversation.context.urgency = 'high';
        }
        
        if (text.includes('precio') || text.includes('costo') || text.includes('cotización')) {
          conversation.context.topic = 'pricing';
          conversation.context.category = 'sales';
        }
        
        if (text.includes('soporte') || text.includes('ayuda') || text.includes('problema')) {
          conversation.context.topic = 'support';
          conversation.context.category = 'customer_service';
        }
      }

      await conversation.save();
      console.log(`✅ Updated conversation metadata: ${conversationId}`);
    } catch (error) {
      console.error('❌ Error updating conversation metadata:', error);
    }
  }

  /**
   * Process delivery receipts
   */
  private async processDeliveryReceipt(psid: string, delivery: any): Promise<void> {
    try {
      console.log(`📬 Processing delivery receipt for PSID: ${psid}`);
      
      // Update message delivery status
      for (const mid of delivery.mids) {
        const message = await Message.findOne({ mid });
        if (message) {
          message.status = 'delivered';
          message.deliveryConfirmed = true;
          message.deliveryConfirmedAt = new Date();
          await message.save();
          console.log(`✅ Updated message delivery status: ${mid}`);
        }
      }
    } catch (error) {
      console.error('❌ Error processing delivery receipt:', error);
    }
  }

  /**
   * Process read receipts
   */
  private async processReadReceipt(psid: string, read: any): Promise<void> {
    try {
      console.log(`👁️ Processing read receipt for PSID: ${psid}`);
      
      // Update message read status
      const conversation = await Conversation.findOne({
        contactId: psid,
        status: { $in: ['open', 'scheduled'] }
      });

      if (conversation) {
        // Mark all messages in conversation as read
        await Message.updateMany(
          { conversationId: conversation.id, role: 'assistant', isRead: false },
          { isRead: true, readAt: new Date() }
        );

        conversation.unreadCount = 0;
        await conversation.save();
        console.log(`✅ Updated read status for conversation: ${conversation.id}`);
      }
    } catch (error) {
      console.error('❌ Error processing read receipt:', error);
    }
  }

  /**
   * Build list of candidate IDs for webhook matching (recipient.id / sender.id).
   * Meta can send pageScopedId, accountId, appScopedId, pageId, or IGSID - we match against all.
   */
  private getRecipientIdCandidates(account: any): string[] {
    const candidates: string[] = [];
    if (account.pageScopedId) candidates.push(String(account.pageScopedId));
    if (account.accountId) candidates.push(String(account.accountId));
    if (account.appScopedId) candidates.push(String(account.appScopedId));
    if (account.pageId) candidates.push(String(account.pageId));
    const alternates = account.alternateRecipientIds || [];
    alternates.forEach((id: string) => candidates.push(String(id)));
    return candidates;
  }

  /**
   * Resolve unknown recipientId via Instagram Graph API and cache for future matching.
   * Tries GET /{recipientId} with each account's token; if response identifies that account, save and return it.
   */
  private async resolveRecipientIdViaApiAndCache(recipientId: string): Promise<{ account: any; isBotMessage: false } | null> {
    const allAccounts = await InstagramAccount.find({ isActive: true });
    console.log(`🔍 [Resolve API] Attempting to resolve recipientId ${recipientId} via Instagram Graph API (trying ${allAccounts.length} accounts)`);
    for (const account of allAccounts) {
      if (!account.accessToken) {
        console.log(`🔍 [Resolve API] Skipping ${account.accountName}: no accessToken`);
        continue;
      }
      try {
        const res = await fetch(`https://graph.instagram.com/v25.0/${recipientId}?fields=id,username&access_token=${account.accessToken}`);
        const status = res.status;
        if (!res.ok) {
          const body = await res.text();
          console.log(`🔍 [Resolve API] ${account.accountName} GET /${recipientId} → ${status} ${body.substring(0, 200)}`);
          continue;
        }
        const data = await res.json();
        console.log(`🔍 [Resolve API] ${account.accountName} GET /${recipientId} → 200 id=${data.id} username=${data.username}`);
        const matchesAccount = data.id === String(account.accountId) ||
          ((account as any).appScopedId && data.id === String((account as any).appScopedId)) ||
          (data.username && data.username === account.accountName);
        if (matchesAccount) {
          const existing = account.alternateRecipientIds || [];
          if (!existing.includes(recipientId)) {
            const updated = [...existing, recipientId];
            await InstagramAccount.findByIdAndUpdate(account._id, { alternateRecipientIds: updated });
            console.log(`✅ [Account Identification] Resolved recipientId ${recipientId} via API and cached for ${account.accountName}`);
          }
          const fresh = await InstagramAccount.findById(account._id);
          return { account: fresh || account, isBotMessage: false };
        }
        console.log(`🔍 [Resolve API] ${account.accountName} response does not match (expected id=${account.accountId} or username=${account.accountName})`);
      } catch (err) {
        console.log(`🔍 [Resolve API] ${account.accountName} error:`, err instanceof Error ? err.message : err);
      }
    }
    console.log(`🔍 [Resolve API] No account resolved recipientId ${recipientId}`);
    return null;
  }

  /**
   * Identify Instagram account by PSID matching (flexible: pageScopedId, accountId, entryId, pageId, alternateRecipientIds).
   * Meta docs: entry.id = our Instagram Professional account ID. We use it when recipient.id doesn't match (dynamic recipient ID).
   */
  private async identifyAccountByPSID(psid: string, recipientId?: string, isBotMessage?: boolean, entryId?: string): Promise<any> {
    try {
      console.log(`🔍 [Account Identification] Starting account lookup - Sender PSID: ${psid}, Recipient ID: ${recipientId}, Entry ID: ${entryId ?? 'n/a'}`);
      
      const allAccounts = await InstagramAccount.find({ isActive: true });
      console.log(`🔍 [Account Identification] Found ${allAccounts.length} active accounts in database`);
      
      if (isBotMessage) {
        console.log(`🤖 [PSID Matching] Bot message detected by is_echo flag`);
        console.log(`🤖 [PSID Matching] Looking for PSID ${psid} in ${allAccounts.length} accounts:`);
        for (const account of allAccounts) {
          const candidates = this.getRecipientIdCandidates(account);
          console.log(`🤖 [PSID Matching] ${account.accountName}: candidates=${JSON.stringify(candidates)}`);
          if (candidates.includes(psid)) {
            console.log(`🤖 [PSID Matching] Bot message from account: ${account.accountName} (${account.userEmail}) - matched by PSID ${psid}`);
            return { account, isBotMessage: true };
          }
        }
        // ID match failed — resolve via API (tries username match + caches the ID for future webhooks)
        console.log(`⚠️ [PSID Matching] Bot message PSID ${psid} not found by ID — attempting username resolution via API`);
        const resolved = await this.resolveRecipientIdViaApiAndCache(psid);
        if (resolved) {
          console.log(`🤖 [PSID Matching] Bot message resolved via username for account: ${resolved.account.accountName} — PSID ${psid} cached in alternateRecipientIds`);
          return { account: resolved.account, isBotMessage: true };
        }
        console.warn(`⚠️ [PSID Matching] Bot message PSID ${psid} not found in active accounts — ignoring echo (not an error, reconnect account via OAuth to register its webhook ID)`);
        return null;
      } else {
        // 1) Try match by entry.id first (Meta docs: entry.id = our Instagram Professional account ID)
        if (entryId) {
          for (const account of allAccounts) {
            const candidates = this.getRecipientIdCandidates(account);
            if (candidates.includes(entryId)) {
              const matchType = entryId === account.pageScopedId ? 'pageScopedId' : entryId === String(account.accountId) ? 'accountId' : (account as any).appScopedId && entryId === String((account as any).appScopedId) ? 'appScopedId' : (account.pageId && entryId === String(account.pageId)) ? 'pageId' : 'alternateRecipientIds';
              console.log(`👤 [Account Identification] Matched by entry.id: ${account.accountName} (${account.userEmail}) - ${matchType}`);
              if (recipientId && recipientId !== entryId) {
                const existing = (account as any).alternateRecipientIds || [];
                if (!existing.includes(recipientId)) {
                  const updated = [...existing, recipientId];
                  await InstagramAccount.findByIdAndUpdate(account._id, { alternateRecipientIds: updated });
                  console.log(`✅ [Account Identification] Cached recipient.id ${recipientId} in alternateRecipientIds for future webhooks`);
                }
              }
              const fresh = await InstagramAccount.findById(account._id);
              return { account: fresh || account, isBotMessage: false };
            }
          }
        }

        if (recipientId) {
          console.log(`🔍 [Account Identification] User message - looking for which account received this message: ${recipientId}`);
          
          // Match by any candidate ID (pageScopedId, accountId, pageId, alternateRecipientIds)
          for (const account of allAccounts) {
            const candidates = this.getRecipientIdCandidates(account);
            if (candidates.includes(recipientId)) {
              const matchType = recipientId === account.pageScopedId ? 'pageScopedId' : recipientId === String(account.accountId) ? 'accountId' : (account.pageId && recipientId === String(account.pageId)) ? 'pageId' : 'alternateRecipientIds';
              console.log(`👤 [Account Identification] User message to account: ${account.accountName} (${account.userEmail}) - matched by ${matchType}`);
              return { account, isBotMessage: false };
            }
          }
          
          // Resolve unknown recipientId via API and cache
          console.log(`🔍 [Account Identification] No candidate match for recipientId ${recipientId}; trying resolve via API...`);
          const resolved = await this.resolveRecipientIdViaApiAndCache(recipientId);
          if (resolved) return resolved;
          console.log(`🔍 [Account Identification] Resolve API returned no account for recipientId ${recipientId}.`);

          // Fallback: when only one active account, assume message is for that account and cache recipientId
          // (Instagram sometimes sends recipient.id that doesn't match /me user_id and isn't resolvable via GET /{id})
          if (allAccounts.length === 1) {
            const account = allAccounts[0];
            const existing = (account as any).alternateRecipientIds || [];
            if (!existing.includes(recipientId)) {
              const updated = [...existing, recipientId];
              await InstagramAccount.findByIdAndUpdate(account._id, { alternateRecipientIds: updated });
              console.log(`✅ [Account Identification] Single-account fallback: assigned recipientId ${recipientId} to ${account.accountName} and cached for future webhooks`);
            }
            const fresh = await InstagramAccount.findById(account._id);
            return { account: fresh || account, isBotMessage: false };
          }

          // Fallback: sender (PSID) has existing conversation(s) with exactly one account → use that account and cache recipientId
          const contactByPsid = await Contact.findOne({ psid, channel: 'instagram' }) || await Contact.findOne({ psid });
          if (contactByPsid) {
            const convos = await Conversation.find({ contactId: contactByPsid._id }).select('accountId').lean();
            const uniqueAccountIds = [...new Set(convos.map((c: any) => String(c.accountId)))];
            if (uniqueAccountIds.length === 1) {
              const account = allAccounts.find((a: any) => String(a.accountId) === uniqueAccountIds[0]);
              if (account) {
                const existing = (account as any).alternateRecipientIds || [];
                if (!existing.includes(recipientId)) {
                  const updated = [...existing, recipientId];
                  await InstagramAccount.findByIdAndUpdate(account._id, { alternateRecipientIds: updated });
                  console.log(`✅ [Account Identification] Conversation fallback: sender PSID has conversation with ${account.accountName}, cached recipientId ${recipientId}`);
                }
                const fresh = await InstagramAccount.findById(account._id);
                return { account: fresh || account, isBotMessage: false };
              }
            }
          }

          // Fallback: match by SENDER PSID (our message sent manually)
          console.warn(`⚠️ [Account Identification] Recipient ID ${recipientId} not found. Trying to match by sender PSID...`);
          for (const account of allAccounts) {
            const candidates = this.getRecipientIdCandidates(account);
            if (candidates.includes(psid)) {
              console.log(`🤖 [Account Identification] Matched by sender PSID: ${account.accountName} (${account.userEmail}) - this is OUR message (owner sent manually)`);
              return { account, isBotMessage: true };
            }
          }
          
          console.error(`❌ [Account Identification] CRITICAL: Cannot identify account for message!`);
          console.error(`❌ [Account Identification] Recipient ID: ${recipientId} - NOT FOUND`);
          console.error(`❌ [Account Identification] Sender PSID: ${psid} - NOT FOUND`);
          console.error(`❌ [Account Identification] Available accounts:`, allAccounts.map(acc => ({
            accountName: acc.accountName,
            pageScopedId: acc.pageScopedId,
            accountId: acc.accountId,
            pageId: acc.pageId,
            alternateRecipientIds: (acc as any).alternateRecipientIds
          })));
          console.error(`❌ [Account Identification] Message will NOT be processed to prevent incorrect account assignment`);
          return null;
        } else {
          console.warn(`⚠️ [PSID Matching] No recipient ID provided for user message`);
          for (const account of allAccounts) {
            const candidates = this.getRecipientIdCandidates(account);
            if (candidates.includes(psid)) {
              console.log(`🤖 [Account Identification] Matched by sender PSID (no recipient ID): ${account.accountName} (${account.userEmail}) - this is OUR message`);
              return { account, isBotMessage: true };
            }
          }
          console.error(`❌ [Account Identification] CRITICAL: No recipient ID and sender PSID ${psid} not found`);
          console.error(`❌ [Account Identification] Available accounts:`, allAccounts.map(acc => ({
            accountName: acc.accountName,
            pageScopedId: acc.pageScopedId,
            accountId: acc.accountId
          })));
          return null;
        }
      }
      
      console.error('❌ [PSID Matching] Unexpected code path - no account identification logic matched');
      return null;
    } catch (error) {
      console.error('❌ Error identifying Instagram account by PSID:', error);
      return null;
    }
  }

  /**
   * Fetch Business Account ID from Page-Scoped ID using Instagram Graph API
   */
  private async fetchBusinessAccountIdFromPageScopedId(pageScopedId: string): Promise<string | null> {
    try {
      // We need to use any active account's access token to make this API call
      const activeAccount = await InstagramAccount.findOne({ isActive: true });
      if (!activeAccount) {
        console.error('❌ No active Instagram account found for API call');
        return null;
      }

      console.log(`🔍 [API Call] Fetching Business Account ID for Page-Scoped ID: ${pageScopedId}`);
      
      const response = await fetch(`https://graph.instagram.com/v25.0/${pageScopedId}?fields=id,username&access_token=${activeAccount.accessToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ [API Call] Instagram API response:`, data);
        return data.id; // This should be the Business Account ID
      } else {
        console.error(`❌ [API Call] Instagram API error: ${response.status}`, await response.text());
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching Business Account ID from Page-Scoped ID:', error);
      return null;
    }
  }

  /**
   * Cache Page-Scoped ID for future webhook matching
   */
  private async cachePageScopedId(accountId: string, pageScopedId: string): Promise<void> {
    try {
      console.log(`💾 [Cache] Caching Page-Scoped ID ${pageScopedId} for account ${accountId}`);
      
      await InstagramAccount.findByIdAndUpdate(accountId, {
        pageScopedId: pageScopedId
      });
      
      console.log(`✅ [Cache] Successfully cached Page-Scoped ID ${pageScopedId} for account ${accountId}`);
    } catch (error) {
      console.error(`❌ [Cache] Error caching Page-Scoped ID:`, error);
    }
  }

  /**
   * Check if message text contains any enabled keyword activation rules
   * Returns the matched keyword if found, or null if no match
   */
  private async checkKeywordActivation(
    messageText: string,
    accountId: string,
    conversation: IConversation,
    senderIsOurAccount: boolean
  ): Promise<{ activated: boolean; keyword?: string }> {
    try {
      // Normalize message text: lowercase + strip diacritics (accents) so e.g. "Lánding" matches keyword "landing"
      const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normalizedText = stripAccents(messageText.toLowerCase().trim());

      if (!normalizedText || normalizedText.length === 0) {
        return { activated: false };
      }

      // Get all enabled keyword activation rules for this account
      const enabledRules = await KeywordActivationRule.find({
        accountId,
        enabled: true
      });

      if (enabledRules.length === 0) {
        console.log(`🔍 [Keyword Activation] No enabled keyword rules found for account ${accountId}`);
        return { activated: false };
      }

      console.log(`🔍 [Keyword Activation] Checking ${enabledRules.length} enabled keyword rules for account ${accountId}`);
      console.log(`🔍 [Keyword Activation] Message text: "${messageText.substring(0, 100)}"`);
      console.log(`🔍 [Keyword Activation] Sender is our account: ${senderIsOurAccount}`);
      console.log(`🔍 [Keyword Activation] Conversation already activated: ${conversation.settings?.activatedByKeyword || false}`);

      // Check each enabled keyword rule — normalize stored keyword too so rules created with accents also work
      for (const rule of enabledRules) {
        const normalizedKeyword = stripAccents(rule.keyword.toLowerCase());
        if (normalizedText.includes(normalizedKeyword)) {
          console.log(`✅ [Keyword Activation] Keyword "${rule.keyword}" matched in message!`);
          console.log(`✅ [Keyword Activation] Activating conversation ${conversation.id} with keyword: "${rule.keyword}"`);
          return {
            activated: true,
            keyword: rule.keyword
          };
        }
      }

      console.log(`ℹ️ [Keyword Activation] No keyword matches found in message`);
      return { activated: false };
    } catch (error) {
      console.error('❌ [Keyword Activation] Error checking keyword activation:', error);
      return { activated: false };
    }
  }

  /**
   * Get Instagram username for a PSID
   */
  private async getInstagramUsername(psid: string, accessToken: string): Promise<string | null> {
    try {
      console.log(`🔍 [Username] Fetching Instagram username for PSID: ${psid}`);
      
      const response = await fetch(`https://graph.instagram.com/v25.0/${psid}?fields=username&access_token=${accessToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ [Username] Instagram username fetched: ${data.username}`);
        return data.username;
      } else {
        console.warn(`⚠️ [Username] Failed to fetch username for PSID ${psid}: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ [Username] Error fetching Instagram username:`, error);
      return null;
    }
  }

}

export default InstagramWebhookService;
