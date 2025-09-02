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
    try {
      // Get all active conversations
      const activeConversations = await Conversation.find({ 
        status: 'open',
        isActive: true 
      }).populate('contactId');

      let processedCount = 0;
      for (const conversation of activeConversations) {
        const wasProcessed = await this.processConversation(conversation);
        if (wasProcessed) processedCount++;
      }

      if (processedCount > 0) {
        console.log(`✅ DebounceWorkerService: Processed ${processedCount} conversations`);
      }
    } catch (error) {
      console.error('❌ DebounceWorkerService: Error in debounce worker process:', error);
    }
  }

  /**
   * Process a single conversation
   */
  private async processConversation(conversation: IConversation): Promise<boolean> {
    try {
      // Check conversation state - don't respond if we're waiting for user
      if (conversation.status === 'closed') {
        return false;
      }

      // Check if conversation is in cooldown
      if (conversation.timestamps.cooldownUntil && conversation.timestamps.cooldownUntil > new Date()) {
        return false;
      }

      // Check if we already sent a response recently (within last 30 seconds)
      const lastBotMessage = await Message.findOne({
        conversationId: conversation.id,
        role: 'assistant',
        status: 'sent'
      }).sort({ 'metadata.timestamp': -1 });

      if (lastBotMessage && (Date.now() - lastBotMessage.metadata.timestamp.getTime()) < 30000) {
        return false;
      }

      // Get recent unprocessed messages
      const recentMessages = await Message.find({
        conversationId: conversation.id,
        role: 'user',
        status: 'received',
        'metadata.processed': { $ne: true }
      }).sort({ 'metadata.timestamp': 1 });

      // Check if we already have a response (even if it failed to send)
      const existingResponse = await Message.findOne({
        conversationId: conversation.id,
        role: 'assistant',
        'metadata.timestamp': { 
          $gte: new Date(Date.now() - 60000) // Within last minute
        }
      });

      if (existingResponse) {
        console.log(`⏭️ DebounceWorkerService: Response already exists for conversation ${conversation.id}, skipping`);
        // Mark all unprocessed messages as processed since we already tried to respond
        const messageIds = recentMessages.map(msg => msg.id);
        await this.markMessagesAsProcessed(messageIds);
        return false;
      }

      if (recentMessages.length === 0) {
        return false;
      }

      // Group messages by text content to handle Meta's duplicate webhooks
      const uniqueMessages = this.groupMessagesByContent(recentMessages);

      if (uniqueMessages.length > 1) {
        console.log(`🔗 DebounceWorkerService: Consolidating ${uniqueMessages.length} message groups for conversation: ${conversation.id}`);
        await this.consolidateMessages(conversation, uniqueMessages);
      } else {
        console.log(`📝 DebounceWorkerService: Processing message for conversation: ${conversation.id}`);
        await this.processIndividualMessages(conversation, uniqueMessages);
      }

      return true; // Conversation was processed

    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error processing conversation ${conversation.id}:`, error);
      return false;
    }
  }

  /**
   * Consolidate multiple message groups into one response
   */
  private async consolidateMessages(conversation: IConversation, messageGroups: IMessage[][]): Promise<void> {
    console.log(`🔗 DebounceWorkerService: Consolidating ${messageGroups.length} message groups for conversation: ${conversation.id}`);
    
    try {
      // Combine all unique message texts (one from each group)
      const uniqueTexts = messageGroups.map(group => group[0].content.text);
      const combinedText = uniqueTexts.join('\n\n');
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
          originalMessageIds: messageGroups.flat().map(msg => msg.id),
          processed: false
        }
      });

      await consolidatedMessage.save();
      console.log(`✅ DebounceWorkerService: Created consolidated message: ${consolidatedMessage.id}`);

      // Process the consolidated message
      await this.processMessage(conversation, consolidatedMessage);

      // Mark all original messages as processed
      const allMessageIds = messageGroups.flat().map(msg => msg.id);
      await Message.updateMany(
        { _id: { $in: allMessageIds } },
        { 'metadata.processed': true }
      );

      console.log(`✅ DebounceWorkerService: Marked ${allMessageIds.length} original messages as processed`);

    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error consolidating messages for conversation ${conversation.id}:`, error);
    }
  }

  /**
   * Group messages by content to handle Meta's duplicate webhooks
   */
  private groupMessagesByContent(messages: IMessage[]): IMessage[][] {
    const groups: { [key: string]: IMessage[] } = {};
    
    messages.forEach(message => {
      const text = message.content?.text || '';
      if (!groups[text]) {
        groups[text] = [];
      }
      groups[text].push(message);
    });
    
    return Object.values(groups);
  }

  /**
   * Process individual message groups
   */
  private async processIndividualMessages(conversation: IConversation, messageGroups: IMessage[][]): Promise<void> {
    console.log(`📝 DebounceWorkerService: Processing ${messageGroups.length} message groups for conversation: ${conversation.id}`);
    
    for (const messageGroup of messageGroups) {
      // Process the first message in each group (they have same content)
      const message = messageGroup[0];
      console.log(`📝 DebounceWorkerService: Processing message: ${message.id} for conversation: ${conversation.id}`);
      await this.processMessage(conversation, message);
      
      // Mark all messages in this group as processed
      const messageIds = messageGroup.map(msg => msg.id);
      await this.markMessagesAsProcessed(messageIds);
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
    console.log(`🤖 DebounceWorkerService: Generating mock response for message: ${message.id}`);
    
    try {
      // Check business hours
      if (!this.isWithinBusinessHours(conversation)) {
        console.log(`🏢 DebounceWorkerService: Outside business hours for conversation: ${conversation.id}`);
        return null;
      }

      // Return mock response instead of calling AI
      const mockResponse = "This would be an AI generated message";
      console.log(`✅ DebounceWorkerService: Mock response generated: "${mockResponse}"`);
      return mockResponse;

    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error generating response for message ${message.id}:`, error);
      return "This would be an AI generated message";
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
      // Check if we already have a pending queue item for this conversation
      const existingQueueItem = await OutboundQueue.findOne({
        conversationId: conversation.id,
        status: { $in: ['pending', 'processing'] }
      });

      if (existingQueueItem) {
        console.log(`⚠️ DebounceWorkerService: Queue item already exists for conversation ${conversation.id}, skipping`);
        return;
      }

      // Additional check: Look for recent queue items with same content and contact
      const recentQueueItem = await OutboundQueue.findOne({
        contactId: conversation.contactId,
        'content.text': responseText,
        status: { $in: ['pending', 'processing', 'sent'] },
        createdAt: { $gte: new Date(Date.now() - 60000) } // Within last minute
      });

      if (recentQueueItem) {
        console.log(`⚠️ DebounceWorkerService: Recent queue item with same content exists for contact ${conversation.contactId}, skipping`);
        console.log(`🔍 Existing queue item details: ID=${recentQueueItem.id}, AccountId=${recentQueueItem.accountId}, Status=${recentQueueItem.status}`);
        return;
      }

      // Log all existing queue items for this conversation for debugging
      const allQueueItems = await OutboundQueue.find({
        conversationId: conversation.id
      }).sort({ createdAt: -1 });
      
      console.log(`🔍 All queue items for conversation ${conversation.id}:`, allQueueItems.map(item => ({
        id: item.id,
        accountId: item.accountId,
        status: item.status,
        createdAt: (item as any).createdAt,
        content: item.content.text
      })));

      // Create bot message record
      console.log(`🔍 Creating bot message for conversation ${conversation.id} with accountId: ${conversation.accountId}`);
      
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



