import crypto from 'crypto';
import Contact from '../models/contact.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import InstagramAccount from '../models/instagramAccount.model';
import { IContact } from '../models/contact.model';
import { IConversation } from '../models/conversation.model';
import { IMessage } from '../models/message.model';

// Meta webhook payload interfaces
interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    messaging: Array<{
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
  }>;
}

interface InstagramMessage {
  mid: string;
  psid: string;
  text?: string;
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
        console.warn('No app secret configured, skipping signature validation');
        return true;
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
        for (const messaging of entry.messaging) {
          await this.processMessaging(messaging);
        }
      }

      console.log('✅ Webhook processing completed');
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      throw error;
    }
  }

  /**
   * Process individual messaging event
   */
  private async processMessaging(messaging: any): Promise<void> {
    try {
      const psid = messaging.sender.id;
      const recipientId = messaging.recipient.id;
      const timestamp = messaging.timestamp * 1000; // Convert to milliseconds

      // Determine message type and extract content
      let messageData: InstagramMessage | null = null;

      if (messaging.message) {
        messageData = {
          mid: messaging.message.mid,
          psid,
          text: messaging.message.text,
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

      // Check if message already exists (deduplication)
      const existingMessage = await Message.findOne({ mid: messageData.mid });
      if (existingMessage) {
        console.log(`⚠️ Message ${messageData.mid} already exists, skipping`);
        return;
      }

      // Get or create Instagram account
      const account = await this.getOrCreateInstagramAccount();
      if (!account) {
        console.error('❌ No Instagram account found for webhook processing');
        return;
      }

      // Get or create contact
      const contact = await this.upsertContact(messageData.psid, messageData);

      // Get or create conversation
      const conversation = await this.getOrCreateConversation(contact.id, account.id);

      // Create message record
      const message = await this.createMessage(messageData, conversation.id, contact.id, account.id);

      // Update conversation metadata
      await this.updateConversationMetadata(conversation.id, messageData);

      console.log(`✅ Message processed successfully: ${message.id}`);
    } catch (error) {
      console.error('❌ Error processing message:', error);
      throw error;
    }
  }

  /**
   * Get or create Instagram account for webhook processing
   */
  private async getOrCreateInstagramAccount(): Promise<any> {
    try {
      // For now, we'll use the first active account
      // In a multi-account setup, you'd determine which account based on recipient ID
      let account = await InstagramAccount.findOne({ isActive: true });

      if (!account) {
        console.warn('⚠️ No active Instagram account found, creating default account');
        
        // Create a default account for development/testing
        account = new InstagramAccount({
          accountId: 'default',
          accountName: 'Default Account',
          accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || 'dummy_token',
          tokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
          webhook: {
            verifyToken: this.verifyToken || 'default_verify_token',
            isActive: true
          }
        });

        await account.save();
        console.log('✅ Created default Instagram account');
      }

      return account;
    } catch (error) {
      console.error('❌ Error getting/creating Instagram account:', error);
      return null;
    }
  }

  /**
   * Upsert contact based on PSID
   */
  private async upsertContact(psid: string, messageData: InstagramMessage): Promise<IContact> {
    try {
      let contact = await Contact.findOne({ psid });

      if (!contact) {
        console.log(`👤 Creating new contact for PSID: ${psid}`);
        
        contact = new Contact({
          psid,
          metadata: {
            firstSeen: new Date(messageData.timestamp),
            lastSeen: new Date(messageData.timestamp),
            messageCount: 1,
            responseCount: 0,
            source: 'instagram_dm'
          },
          preferences: {
            language: 'es', // Default to Spanish
            timezone: 'America/Santiago',
            contactMethod: 'instagram'
          },
          status: 'active',
          lastActivity: new Date(messageData.timestamp)
        });

        await contact.save();
        console.log(`✅ Created new contact: ${contact.id}`);
      } else {
        console.log(`👤 Updating existing contact: ${contact.id}`);
        
        // Update last seen and message count
        contact.metadata.lastSeen = new Date(messageData.timestamp);
        contact.metadata.messageCount += 1;
        contact.lastActivity = new Date(messageData.timestamp);

        await contact.save();
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
            aiEnabled: true,
            priority: 'normal',
            businessHoursOnly: false
          },
          isActive: true,
          messageCount: 0,
          unreadCount: 0
        });

        await conversation.save();
        console.log(`✅ Created new conversation: ${conversation.id}`);
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
    accountId: string
  ): Promise<IMessage> {
    try {
      const message = new Message({
        mid: messageData.mid,
        conversationId,
        contactId,
        accountId,
        role: 'user',
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
          processingTime: 0
        },
        status: 'received',
        priority: 'normal',
        isRead: false,
        deliveryConfirmed: true // Instagram webhook confirms delivery
      });

      await message.save();
      console.log(`✅ Created message record: ${message.id}`);

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
}

export default InstagramWebhookService;
