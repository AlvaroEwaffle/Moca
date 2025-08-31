import Contact from '../models/contact.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import OutboundQueue from '../models/outboundQueue.model';
import InstagramAccount from '../models/instagramAccount.model';
import { IContact } from '../models/contact.model';
import { IConversation } from '../models/conversation.model';
import { IMessage } from '../models/message.model';

// Debounce window configuration
interface DebounceConfig {
  windowMs: number; // Time window in milliseconds to consolidate messages
  userCooldown: number; // Seconds between bot responses to same user
  maxConsolidatedLength: number; // Maximum length of consolidated message
}

export class DebounceWorkerService {
  private config: DebounceConfig;

  constructor() {
    this.config = {
      windowMs: parseInt(process.env.DEBOUNCE_WINDOW_MS || '4000'), // 4 seconds
      userCooldown: parseInt(process.env.USER_COOLDOWN_SECONDS || '3'), // 3 seconds
      maxConsolidatedLength: 1000 // Maximum characters in consolidated message
    };
  }

  /**
   * Process debounced messages for all active conversations
   */
  async processDebouncedMessages(): Promise<void> {
    try {
      console.log('🔄 Starting debounce worker process');

      // Find all active conversations
      const activeConversations = await Conversation.find({
        status: 'open',
        isActive: true
      });

      console.log(`📋 Found ${activeConversations.length} active conversations to process`);

      for (const conversation of activeConversations) {
        try {
          await this.processConversationDebounce(conversation);
        } catch (error) {
          console.error(`❌ Error processing conversation ${conversation.id}:`, error);
        }
      }

      console.log('✅ Debounce worker process completed');
    } catch (error) {
      console.error('❌ Error in debounce worker process:', error);
      throw error;
    }
  }

  /**
   * Process debounce for a specific conversation
   */
  private async processConversationDebounce(conversation: IConversation): Promise<void> {
    try {
      const contact = await Contact.findById(conversation.contactId);
      if (!contact) {
        console.warn(`⚠️ Contact not found for conversation: ${conversation.id}`);
        return;
      }

      // Check if conversation is in cooldown
      if (await this.isInCooldown(conversation.id)) {
        console.log(`⏰ Conversation ${conversation.id} is in cooldown, skipping`);
        return;
      }

      // Get recent unprocessed user messages
      const recentMessages = await this.getRecentUnprocessedMessages(conversation.id);

      if (recentMessages.length === 0) {
        return; // No messages to process
      }

      // Check if we should consolidate messages
      if (recentMessages.length > 1) {
        const shouldConsolidate = this.shouldConsolidateMessages(recentMessages);
        
        if (shouldConsolidate) {
          console.log(`🔗 Consolidating ${recentMessages.length} messages for conversation: ${conversation.id}`);
          await this.consolidateMessages(conversation, recentMessages);
        } else {
          console.log(`📝 Processing ${recentMessages.length} individual messages for conversation: ${conversation.id}`);
          for (const message of recentMessages) {
            await this.processSingleMessage(conversation, message);
          }
        }
      } else {
        // Single message, process normally
        await this.processSingleMessage(conversation, recentMessages[0]);
      }

      // Mark messages as processed
      await this.markMessagesAsProcessed(recentMessages.map(m => m.id));

    } catch (error) {
      console.error(`❌ Error processing conversation debounce: ${conversation.id}`, error);
      throw error;
    }
  }

  /**
   * Check if conversation is in cooldown
   */
  private async isInCooldown(conversationId: string): Promise<boolean> {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return false;

      if (!conversation.timestamps.cooldownUntil) {
        return false;
      }

      const now = new Date();
      const isInCooldown = now < conversation.timestamps.cooldownUntil;

      if (isInCooldown) {
        const remainingSeconds = Math.ceil(
          (conversation.timestamps.cooldownUntil.getTime() - now.getTime()) / 1000
        );
        console.log(`⏰ Conversation ${conversationId} in cooldown for ${remainingSeconds} more seconds`);
      }

      return isInCooldown;
    } catch (error) {
      console.error('❌ Error checking cooldown:', error);
      return false;
    }
  }

  /**
   * Get recent unprocessed user messages
   */
  private async getRecentUnprocessedMessages(conversationId: string): Promise<IMessage[]> {
    try {
      const cutoffTime = new Date(Date.now() - this.config.windowMs);
      
      const messages = await Message.find({
        conversationId,
        role: 'user',
        status: 'received',
        'metadata.timestamp': { $gte: cutoffTime }
      }).sort({ 'metadata.timestamp': 1 });

      return messages;
    } catch (error) {
      console.error('❌ Error getting recent messages:', error);
      return [];
    }
  }

  /**
   * Determine if messages should be consolidated
   */
  private shouldConsolidateMessages(messages: IMessage[]): boolean {
    if (messages.length < 2) return false;

    const firstMessageTime = messages[0].metadata.timestamp.getTime();
    const lastMessageTime = messages[messages.length - 1].metadata.timestamp.getTime();
    const timeSpan = lastMessageTime - firstMessageTime;

    // Consolidate if messages are within the debounce window
    return timeSpan <= this.config.windowMs;
  }

  /**
   * Consolidate multiple messages into one
   */
  private async consolidateMessages(conversation: IConversation, messages: IMessage[]): Promise<void> {
    try {
      // Create consolidated message content
      const consolidatedText = this.createConsolidatedText(messages);
      
      // Create a consolidated message record
      const consolidatedMessage = new Message({
        mid: `consolidated_${Date.now()}_${conversation.id}`,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        accountId: conversation.accountId,
        role: 'user',
        content: {
          text: consolidatedText,
          attachments: [],
          quickReplies: [],
          buttons: []
        },
        metadata: {
          timestamp: new Date(),
          isConsolidated: true,
          originalMids: messages.map(m => m.mid),
          aiGenerated: false,
          processingTime: 0
        },
        status: 'received',
        priority: 'normal',
        tags: ['consolidated'],
        notes: [`Consolidated ${messages.length} messages`]
      });

      await consolidatedMessage.save();
      console.log(`✅ Created consolidated message: ${consolidatedMessage.id}`);

      // Process the consolidated message
      await this.processSingleMessage(conversation, consolidatedMessage);

    } catch (error) {
      console.error('❌ Error consolidating messages:', error);
      throw error;
    }
  }

  /**
   * Create consolidated text from multiple messages
   */
  private createConsolidatedText(messages: IMessage[]): string {
    try {
      const texts = messages
        .map(m => m.content.text)
        .filter(text => text && text.trim().length > 0);

      if (texts.length === 0) {
        return 'Mensaje consolidado';
      }

      if (texts.length === 1) {
        return texts[0];
      }

      // Join messages with separators
      let consolidated = texts.join(' | ');
      
      // Truncate if too long
      if (consolidated.length > this.config.maxConsolidatedLength) {
        consolidated = consolidated.substring(0, this.config.maxConsolidatedLength - 3) + '...';
      }

      return consolidated;
    } catch (error) {
      console.error('❌ Error creating consolidated text:', error);
      return 'Mensaje consolidado';
    }
  }

  /**
   * Process a single message (consolidated or individual)
   */
  private async processSingleMessage(conversation: IConversation, message: IMessage): Promise<void> {
    try {
      console.log(`📝 Processing message: ${message.id} for conversation: ${conversation.id}`);

      // Check if we should respond to this message
      const shouldRespond = await this.shouldRespondToMessage(conversation, message);
      
      if (!shouldRespond) {
        console.log(`⏭️ Skipping response for message: ${message.id}`);
        return;
      }

      // Generate response
      const response = await this.generateResponse(conversation, message);
      
      if (response) {
        // Create bot message
        const botMessage = await this.createBotMessage(conversation, response, message);
        
        // Add to outbound queue
        await this.addToOutboundQueue(conversation, botMessage);
        
        // Update conversation cooldown
        await this.updateConversationCooldown(conversation.id);
        
        console.log(`✅ Response generated and queued for message: ${message.id}`);
      } else {
        console.log(`⚠️ No response generated for message: ${message.id}`);
      }

    } catch (error) {
      console.error(`❌ Error processing single message: ${message.id}`, error);
      throw error;
    }
  }

  /**
   * Determine if we should respond to a message
   */
  private async shouldRespondToMessage(conversation: IConversation, message: IMessage): Promise<boolean> {
    try {
      // Check if auto-respond is enabled
      if (!conversation.settings.autoRespond) {
        return false;
      }

      // Check if message is from user
      if (message.role !== 'user') {
        return false;
      }

      // Check if message has content
      if (!message.content.text || message.content.text.trim().length === 0) {
        return false;
      }

      // Check business hours if enabled
      if (conversation.settings.businessHoursOnly) {
        const isBusinessHours = await this.isBusinessHours(conversation);
        if (!isBusinessHours) {
          console.log(`🏢 Outside business hours for conversation: ${conversation.id}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Error checking if should respond:', error);
      return false;
    }
  }

  /**
   * Check if current time is within business hours
   */
  private async isBusinessHours(conversation: IConversation): Promise<boolean> {
    try {
      // For now, return true (always business hours)
      // In production, you'd check the account's business hours configuration
      return true;
    } catch (error) {
      console.error('❌ Error checking business hours:', error);
      return true; // Default to business hours
    }
  }

  /**
   * Generate response using AI or fallback rules
   */
  private async generateResponse(conversation: IConversation, message: IMessage): Promise<string | null> {
    try {
      if (!conversation.settings.aiEnabled) {
        return this.generateFallbackResponse(message);
      }

      // Use enhanced OpenAI service for AI responses
      const { generateInstagramResponse, analyzeUserIntent } = await import('./openai.service');
      
      // Get conversation history for context
      const conversationHistory = await this.getConversationHistory(conversation.id);
      
      // Analyze user intent
      const intentAnalysis = await analyzeUserIntent(message.content.text || '');
      
      // Generate AI response
      const aiResponse = await generateInstagramResponse({
        conversationHistory,
        userIntent: intentAnalysis.intent,
        conversationTopic: conversation.context.topic,
        userSentiment: intentAnalysis.sentiment,
        businessContext: {
          company: conversation.context.category || 'General',
          sector: conversation.context.category || 'General',
          services: ['web', 'marketing', 'consulting']
        },
        language: conversation.context.language || 'es'
      });

      // Update conversation context with AI insights
      await this.updateConversationContext(conversation.id, intentAnalysis);

      return aiResponse;

    } catch (error) {
      console.error('❌ Error generating AI response:', error);
      console.log('🔄 Falling back to rule-based response');
      return this.generateFallbackResponse(message);
    }
  }

  /**
   * Get conversation history for AI context
   */
  private async getConversationHistory(conversationId: string): Promise<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>> {
    try {
      const messages = await Message.find({
        conversationId,
        role: { $in: ['user', 'assistant'] }
      })
      .sort({ 'metadata.timestamp': 1 })
      .limit(10); // Last 10 messages for context

      return messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content.text || '',
          timestamp: msg.metadata.timestamp
        }));
    } catch (error) {
      console.error('❌ Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Update conversation context with AI insights
   */
  private async updateConversationContext(conversationId: string, intentAnalysis: any): Promise<void> {
    try {
      await Conversation.findByIdAndUpdate(conversationId, {
        'context.intent': intentAnalysis.intent,
        'context.sentiment': intentAnalysis.sentiment,
        'context.urgency': intentAnalysis.urgency,
        'context.keywords': intentAnalysis.keywords
      });
    } catch (error) {
      console.error('❌ Error updating conversation context:', error);
    }
  }

  /**
   * Generate fallback response using simple rules
   */
  private generateFallbackResponse(message: IMessage): string {
    try {
      const text = message.content.text?.toLowerCase() || '';
      
      // Simple keyword-based responses
      if (text.includes('hola') || text.includes('buenos días') || text.includes('buenas')) {
        return '¡Hola! Gracias por contactarnos. ¿En qué puedo ayudarte hoy?';
      }
      
      if (text.includes('precio') || text.includes('costo') || text.includes('cotización')) {
        return 'Te ayudo con información sobre precios. ¿Podrías contarme más sobre tu proyecto?';
      }
      
      if (text.includes('soporte') || text.includes('ayuda') || text.includes('problema')) {
        return 'Entiendo que necesitas ayuda. Un agente se pondrá en contacto contigo pronto.';
      }
      
      if (text.includes('gracias') || text.includes('thanks')) {
        return '¡De nada! Estoy aquí para ayudarte. ¿Hay algo más en lo que pueda asistirte?';
      }
      
      // Default response
      return 'Gracias por tu mensaje. Un agente revisará tu consulta y te responderá pronto.';
      
    } catch (error) {
      console.error('❌ Error generating fallback response:', error);
      return 'Gracias por contactarnos. Te responderemos pronto.';
    }
  }

  /**
   * Create bot message record
   */
  private async createBotMessage(
    conversation: IConversation, 
    response: string, 
    originalMessage: IMessage
  ): Promise<IMessage> {
    try {
      const botMessage = new Message({
        mid: `bot_${Date.now()}_${conversation.id}`,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        accountId: conversation.accountId,
        role: 'assistant',
        content: {
          text: response,
          attachments: [],
          quickReplies: [],
          buttons: []
        },
        metadata: {
          timestamp: new Date(),
          isConsolidated: false,
          originalMids: [],
          aiGenerated: false, // Will be true when AI is implemented
          processingTime: 0
        },
        status: 'queued',
        priority: 'normal',
        tags: ['bot_response'],
        notes: [`Response to message: ${originalMessage.id}`]
      });

      await botMessage.save();
      console.log(`✅ Created bot message: ${botMessage.id}`);

      return botMessage;
    } catch (error) {
      console.error('❌ Error creating bot message:', error);
      throw error;
    }
  }

  /**
   * Add message to outbound queue
   */
  private async addToOutboundQueue(conversation: IConversation, message: IMessage): Promise<void> {
    try {
      const queueItem = new OutboundQueue({
        messageId: message.id,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        accountId: conversation.accountId,
        priority: message.priority,
        status: 'pending',
        content: {
          text: message.content.text,
          attachments: message.content.attachments,
          quickReplies: message.content.quickReplies,
          buttons: message.content.buttons
        },
        tags: ['auto_response'],
        notes: ['Automatically generated response']
      });

      await queueItem.save();
      console.log(`✅ Added message to outbound queue: ${message.id}`);

    } catch (error) {
      console.error('❌ Error adding to outbound queue:', error);
      throw error;
    }
  }

  /**
   * Update conversation cooldown
   */
  private async updateConversationCooldown(conversationId: string): Promise<void> {
    try {
      const cooldownEnd = new Date(Date.now() + (this.config.userCooldown * 1000));
      
      await Conversation.findByIdAndUpdate(conversationId, {
        'timestamps.cooldownUntil': cooldownEnd
      });

      console.log(`⏰ Updated cooldown for conversation: ${conversationId} until ${cooldownEnd.toISOString()}`);
    } catch (error) {
      console.error('❌ Error updating conversation cooldown:', error);
    }
  }

  /**
   * Mark messages as processed
   */
  private async markMessagesAsProcessed(messageIds: string[]): Promise<void> {
    try {
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { status: 'processed' }
      );

      console.log(`✅ Marked ${messageIds.length} messages as processed`);
    } catch (error) {
      console.error('❌ Error marking messages as processed:', error);
    }
  }
}

export default DebounceWorkerService;
