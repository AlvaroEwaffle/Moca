import Contact from '../models/contact.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import OutboundQueue from '../models/outboundQueue.model';
import InstagramAccount from '../models/instagramAccount.model';
import { IContact } from '../models/contact.model';
import { IConversation } from '../models/conversation.model';
import { IMessage } from '../models/message.model';
import instagramService from './instagramApi.service';
import * as openaiService from './openai.service';

class DebounceWorkerService {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    console.log('🔧 DebounceWorkerService: Initializing service');
  }

  /**
   * Start the debounce worker service
   */
  async start(): Promise<void> {
    console.log('🚀 DebounceWorkerService: Starting debounce worker service');
    
    if (this.isRunning) {
      console.log('⚠️ DebounceWorkerService: Service is already running');
      return;
    }

    this.isRunning = true;
    console.log('✅ DebounceWorkerService: Service started successfully');

    // Process immediately on start
    await this.process();

    // Set up interval for periodic processing
    this.intervalId = setInterval(async () => {
      console.log('⏰ DebounceWorkerService: Periodic processing triggered');
      await this.process();
    }, 5000); // Process every 5 seconds

    console.log('⏰ DebounceWorkerService: Periodic processing scheduled every 5 seconds');
  }

  /**
   * Stop the debounce worker service
   */
  async stop(): Promise<void> {
    console.log('🛑 DebounceWorkerService: Stopping debounce worker service');
    
    if (!this.isRunning) {
      console.log('⚠️ DebounceWorkerService: Service is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏰ DebounceWorkerService: Periodic processing stopped');
    }

    console.log('✅ DebounceWorkerService: Service stopped successfully');
  }

  /**
   * Main processing function
   */
  async process(): Promise<void> {
    console.log('🔄 DebounceWorkerService: Starting debounce worker process');
    
    try {
      // Get all active conversations
      const activeConversations = await Conversation.find({ 
        status: 'open',
        isActive: true 
      }).populate('contactId');

      console.log(`📋 DebounceWorkerService: Found ${activeConversations.length} active conversations to process`);

      for (const conversation of activeConversations) {
        console.log(`📋 DebounceWorkerService: Processing conversation: ${conversation.id}`);
        await this.processConversation(conversation);
      }

      console.log('✅ DebounceWorkerService: Debounce worker process completed');
    } catch (error) {
      console.error('❌ DebounceWorkerService: Error in debounce worker process:', error);
    }
  }

  /**
   * Process a single conversation
   */
  private async processConversation(conversation: IConversation): Promise<void> {
    console.log(`💬 DebounceWorkerService: Processing conversation: ${conversation.id}`);
    
    try {
      // Check if conversation is in cooldown
      if (conversation.timestamps.cooldownUntil && conversation.timestamps.cooldownUntil > new Date()) {
        const remainingSeconds = Math.ceil((conversation.timestamps.cooldownUntil.getTime() - Date.now()) / 1000);
        console.log(`⏰ DebounceWorkerService: Conversation ${conversation.id} is in cooldown, skipping (${remainingSeconds}s remaining)`);
        return;
      }

      // Get recent unprocessed messages
      const recentMessages = await Message.find({
        conversationId: conversation.id,
        role: 'user',
        status: 'received',
        'metadata.processed': { $ne: true }
      }).sort({ 'metadata.timestamp': 1 });

      console.log(`📨 DebounceWorkerService: Found ${recentMessages.length} unprocessed messages for conversation: ${conversation.id}`);

      if (recentMessages.length === 0) {
        console.log(`📭 DebounceWorkerService: No unprocessed messages for conversation: ${conversation.id}`);
        return;
      }

      // Check if we should consolidate messages
      const debounceWindow = 4000; // 4 seconds
      const now = Date.now();
      const messagesInWindow = recentMessages.filter(msg => 
        now - msg.metadata.timestamp.getTime() < debounceWindow
      );

      if (messagesInWindow.length > 1) {
        console.log(`🔗 DebounceWorkerService: Consolidating ${recentMessages.length} messages for conversation: ${conversation.id}`);
        await this.consolidateMessages(conversation, recentMessages);
      } else {
        console.log(`📝 DebounceWorkerService: Processing ${recentMessages.length} individual messages for conversation: ${conversation.id}`);
        await this.processIndividualMessages(conversation, recentMessages);
      }

    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error processing conversation ${conversation.id}:`, error);
    }
  }

  /**
   * Consolidate multiple messages into one response
   */
  private async consolidateMessages(conversation: IConversation, messages: IMessage[]): Promise<void> {
    console.log(`🔗 DebounceWorkerService: Consolidating ${messages.length} messages for conversation: ${conversation.id}`);
    
    try {
      // Combine all message texts
      const combinedText = messages.map(msg => msg.content.text).join('\n\n');
      console.log(`🔗 DebounceWorkerService: Combined text: "${combinedText}"`);

      // Create a consolidated message record
      const consolidatedMessage = new Message({
        mid: `consolidated_${Date.now()}`,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        accountId: conversation.accountId,
        role: 'user',
        content: {
          text: combinedText,
          type: 'text'
        },
        metadata: {
          timestamp: new Date(),
          consolidated: true,
          originalMessageIds: messages.map(msg => msg.id),
          processed: false
        }
      });

      await consolidatedMessage.save();
      console.log(`✅ DebounceWorkerService: Created consolidated message: ${consolidatedMessage.id}`);

      // Process the consolidated message
      await this.processMessage(conversation, consolidatedMessage);

      // Mark original messages as processed
      const messageIds = messages.map(msg => msg.id);
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { 'metadata.processed': true }
      );

      console.log(`✅ DebounceWorkerService: Marked ${messageIds.length} original messages as processed`);

    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error consolidating messages for conversation ${conversation.id}:`, error);
    }
  }

  /**
   * Process individual messages
   */
  private async processIndividualMessages(conversation: IConversation, messages: IMessage[]): Promise<void> {
    console.log(`📝 DebounceWorkerService: Processing ${messages.length} individual messages for conversation: ${conversation.id}`);
    
    for (const message of messages) {
      console.log(`📝 DebounceWorkerService: Processing message: ${message.id} for conversation: ${conversation.id}`);
      await this.processMessage(conversation, message);
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(conversation: IConversation, message: IMessage): Promise<void> {
    console.log(`📝 DebounceWorkerService: Processing message: ${message.id} for conversation: ${conversation.id}`);
    
    try {
      // Check if we should respond to this message
      if (!this.shouldRespondToMessage(message)) {
        console.log(`⏭️ DebounceWorkerService: Skipping response for message: ${message.id}`);
        await Message.findByIdAndUpdate(message.id, { 'metadata.processed': true });
        return;
      }

      // Generate response
      const response = await this.generateResponse(conversation, message);
      
      if (response) {
        console.log(`✅ DebounceWorkerService: Response generated and queued for message: ${message.id}`);
        await this.queueResponse(conversation, response);
      } else {
        console.log(`⚠️ DebounceWorkerService: No response generated for message: ${message.id}`);
      }

      // Mark message as processed
      await Message.findByIdAndUpdate(message.id, { 'metadata.processed': true });

    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error processing message ${message.id}:`, error);
    }
  }

  /**
   * Check if we should respond to a message
   */
  private shouldRespondToMessage(message: IMessage): boolean {
    console.log(`🔍 DebounceWorkerService: Checking if should respond to message: ${message.id}`);
    
    // Don't respond to system messages
    if (message.role === 'system') {
      console.log(`⏭️ DebounceWorkerService: Skipping system message: ${message.id}`);
      return false;
    }

    // Don't respond to bot messages
    if (message.role === 'assistant') {
      console.log(`⏭️ DebounceWorkerService: Skipping bot message: ${message.id}`);
      return false;
    }

    // Check if message has content
    if (!message.content?.text || message.content.text.trim() === '') {
      console.log(`⏭️ DebounceWorkerService: Skipping empty message: ${message.id}`);
      return false;
    }

    console.log(`✅ DebounceWorkerService: Should respond to message: ${message.id}`);
    return true;
  }

  /**
   * Generate a response for a message
   */
  private async generateResponse(conversation: IConversation, message: IMessage): Promise<string | null> {
    console.log(`🤖 DebounceWorkerService: Generating response for message: ${message.id}`);
    
    try {
      // Check business hours
      if (!this.isWithinBusinessHours(conversation)) {
        console.log(`🏢 DebounceWorkerService: Outside business hours for conversation: ${conversation.id}`);
        return null;
      }

      // Get conversation history for context
      const history = await this.getConversationHistory(conversation.id);
      console.log(`📚 DebounceWorkerService: Retrieved ${history.length} messages from conversation history`);

      // Generate AI response
      const response = await openaiService.generateInstagramResponse({
        conversationHistory: history,
        userIntent: 'general',
        conversationTopic: conversation.context?.topic || 'general',
        userSentiment: 'neutral',
        businessContext: {
          company: 'Moca',
          sector: 'Digital Services',
          services: ['web', 'marketing', 'consulting']
        },
        language: 'es'
      });

      if (response) {
        console.log(`✅ DebounceWorkerService: AI response generated: "${response}"`);
        return response;
      } else {
        console.log(`⚠️ DebounceWorkerService: No AI response generated, falling back to rule-based response`);
        return this.generateFallbackResponse(message.content.text);
      }

    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error generating response for message ${message.id}:`, error);
      console.log('🔄 DebounceWorkerService: Falling back to rule-based response');
      return this.generateFallbackResponse(message.content.text);
    }
  }

  /**
   * Check if current time is within business hours
   */
  private isWithinBusinessHours(conversation: IConversation): boolean {
    console.log(`🕐 DebounceWorkerService: Checking business hours for conversation: ${conversation.id}`);
    
    // For now, always return true - business hours logic can be implemented later
    console.log(`✅ DebounceWorkerService: Business hours check passed for conversation: ${conversation.id}`);
    return true;
  }

  /**
   * Get conversation history for context
   */
  private async getConversationHistory(conversationId: string): Promise<Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>> {
    console.log(`📚 DebounceWorkerService: Getting conversation history for: ${conversationId}`);
    
    try {
      const messages = await Message.find({
        conversationId,
        role: { $in: ['user', 'assistant'] }
      })
      .sort({ 'metadata.timestamp': -1 })
      .limit(10); // Last 10 messages for context

      const history = messages.reverse().map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content.text,
        timestamp: msg.metadata.timestamp
      }));

      console.log(`📚 DebounceWorkerService: Retrieved ${history.length} messages from history`);
      return history;
    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error getting conversation history:`, error);
      return [];
    }
  }

  /**
   * Generate a fallback response when AI is not available
   */
  private generateFallbackResponse(userMessage: string): string {
    console.log('🔄 DebounceWorkerService: Falling back to rule-based response');
    
    const message = userMessage.toLowerCase();
    
    if (message.includes('hola') || message.includes('hello')) {
      console.log('🔄 DebounceWorkerService: Generated greeting response');
      return '¡Hola! Gracias por contactarnos. ¿En qué puedo ayudarte hoy?';
    }
    
    if (message.includes('precio') || message.includes('costo') || message.includes('price')) {
      console.log('🔄 DebounceWorkerService: Generated pricing response');
      return 'Te ayudo con información sobre nuestros precios. ¿Qué tipo de proyecto tienes en mente?';
    }
    
    if (message.includes('servicio') || message.includes('service')) {
      console.log('🔄 DebounceWorkerService: Generated service response');
      return 'Ofrecemos servicios de desarrollo web, móvil y consultoría. ¿Qué te interesa más?';
    }
    
    console.log('🔄 DebounceWorkerService: Generated default response');
    return 'Gracias por tu mensaje. Un miembro de nuestro equipo te responderá pronto.';
  }

  /**
   * Queue a response for sending
   */
  private async queueResponse(conversation: IConversation, responseText: string): Promise<void> {
    console.log(`📬 DebounceWorkerService: Queuing response for conversation: ${conversation.id}`);
    
    try {
      // Create bot message record
      const botMessage = new Message({
        mid: `bot_${Date.now()}`,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        accountId: conversation.accountId,
        role: 'assistant',
        content: {
          text: responseText,
          type: 'text'
        },
        metadata: {
          timestamp: new Date(),
          aiGenerated: true,
          processed: false
        }
      });

      await botMessage.save();
      console.log(`✅ DebounceWorkerService: Created bot message: ${botMessage.id}`);

      // Add to outbound queue
      const queueItem = new OutboundQueue({
        messageId: botMessage.id,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        accountId: conversation.accountId,
        priority: 'normal',
        content: {
          type: 'text',
          text: responseText
        },
        metadata: {
          scheduledFor: new Date(),
          attempts: 0,
          maxAttempts: 3
        }
      });

      await queueItem.save();
      console.log(`✅ DebounceWorkerService: Added message to outbound queue: ${queueItem.id}`);

      // Update conversation cooldown
      const cooldownEnd = new Date(Date.now() + 3000); // 3 second cooldown
      await Conversation.findByIdAndUpdate(conversation.id, {
        'timestamps.cooldownUntil': cooldownEnd,
        'timestamps.lastActivity': new Date()
      });

      console.log(`⏰ DebounceWorkerService: Updated cooldown for conversation: ${conversation.id} until ${cooldownEnd.toISOString()}`);

    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error queuing response for conversation ${conversation.id}:`, error);
    }
  }

  /**
   * Mark messages as processed
   */
  private async markMessagesAsProcessed(messageIds: string[]): Promise<void> {
    console.log(`✅ DebounceWorkerService: Marking ${messageIds.length} messages as processed`);
    
    try {
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { 'metadata.processed': true }
      );
      console.log(`✅ DebounceWorkerService: Marked ${messageIds.length} messages as processed`);
    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error marking messages as processed:`, error);
    }
  }
}

export default new DebounceWorkerService();



