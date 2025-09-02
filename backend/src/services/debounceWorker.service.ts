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
    }, 15000); // Process every 15 seconds

    console.log('⏰ DebounceWorkerService: Periodic processing scheduled every 15 seconds');
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
      console.log('🔄 DebounceWorkerService: Starting context-aware batching processing');
      
      // Find all conversations with unprocessed messages
      const conversations = await this.getConversationsWithUnprocessedMessages();
      
      console.log(`📊 DebounceWorkerService: Found ${conversations.length} conversations with unprocessed messages`);

      let processedCount = 0;
      for (const conversation of conversations) {
        const wasProcessed = await this.processConversationBatch(conversation);
        if (wasProcessed) {
          processedCount++;
        }
      }

      if (processedCount > 0) {
        console.log(`✅ DebounceWorkerService: Processed ${processedCount} conversations`);
      }
    } catch (error) {
      console.error('❌ DebounceWorkerService: Error in debounce worker process:', error);
    }
  }

  /**
   * Get conversations with unprocessed messages
   */
  private async getConversationsWithUnprocessedMessages(): Promise<IConversation[]> {
    const conversationIds = await Message.distinct('conversationId', { 
      role: 'user', 
      'metadata.processed': { $ne: true } 
    });
    
    console.log(`🔍 DebounceWorkerService: Found ${conversationIds.length} conversations with unprocessed user messages:`, conversationIds);
    
    const conversations = await Conversation.find({
      _id: { $in: conversationIds },
      status: 'open',
      isActive: true
    });
    
    console.log(`🔍 DebounceWorkerService: Returning ${conversations.length} active conversations`);
    return conversations;
  }

  /**
   * Process a conversation batch with context-aware responses
   */
  private async processConversationBatch(conversation: IConversation): Promise<boolean> {
    try {
      // Check if there's already a pending response for this conversation
      const existingQueueItem = await OutboundQueue.findOne({
        conversationId: conversation.id,
        status: { $in: ['pending', 'processing'] }
      });

      if (existingQueueItem) {
        console.log(`⚠️ DebounceWorkerService: Response already pending for conversation ${conversation.id}, skipping`);
        return false;
      }

      // Get unprocessed messages for this conversation
      const unprocessedMessages = await this.getUnprocessedMessages(conversation.id);
      
      if (unprocessedMessages.length === 0) {
        return false;
      }

      console.log(`📝 DebounceWorkerService: Processing ${unprocessedMessages.length} unprocessed messages for conversation ${conversation.id}`);

      // Mark messages as processed FIRST to prevent race conditions
      await this.markMessagesAsProcessed(unprocessedMessages.map(msg => msg.id));

      // Generate response with full conversation context
      const response = await this.generateResponse(conversation, unprocessedMessages);
      
      if (!response) {
        console.log(`⚠️ DebounceWorkerService: No response generated for conversation ${conversation.id}`);
        return false;
      }
      
      // Queue response
      await this.queueResponse(conversation, response, unprocessedMessages.map(msg => msg.mid));
      
      console.log(`✅ DebounceWorkerService: Successfully processed conversation ${conversation.id}`);
      return true;

    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error processing conversation batch ${conversation.id}:`, error);
      return false;
    }
  }

  /**
   * Get unprocessed messages for a conversation
   */
  private async getUnprocessedMessages(conversationId: string): Promise<IMessage[]> {
    const messages = await Message.find({
      conversationId,
      role: 'user',
      'metadata.processed': { $ne: true }
    }).sort({ 'metadata.timestamp': 1 });
    
    console.log(`🔍 DebounceWorkerService: Found ${messages.length} unprocessed user messages for conversation ${conversationId}:`, 
      messages.map(m => ({ id: m.id, mid: m.mid, text: m.content.text, processed: (m.metadata as any).processed })));
    
    return messages;
  }





  /**
   * Generate a response for a message
   */
  private async generateResponse(conversation: IConversation, newMessages: IMessage[]): Promise<string | null> {
    console.log(`🤖 DebounceWorkerService: Generating context-aware response for ${newMessages.length} messages`);
    
    try {
      // Check business hours
      if (!this.isWithinBusinessHours(conversation)) {
        console.log(`🏢 DebounceWorkerService: Outside business hours for conversation: ${conversation.id}`);
        return null;
      }

      // Get full conversation history for context
      const conversationHistory = await this.getConversationHistory(conversation.id);
      
      // Get user context and business information
      const userContext = await this.getUserContext(conversation.contactId, conversation.accountId);
      
      // Generate response with full context
      const response = await this.generateContextualResponse(
        conversationHistory, 
        newMessages, 
        userContext
      );
      
      console.log(`✅ DebounceWorkerService: Context-aware response generated: "${response}"`);
      return response;

    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error generating context-aware response:`, error);
      return "Gracias por tu mensaje. Un miembro de nuestro equipo te responderá pronto.";
    }
  }

  /**
   * Get full conversation history for context
   */
  private async getConversationHistory(conversationId: string): Promise<IMessage[]> {
    return await Message.find({
      conversationId,
      role: { $in: ['user', 'assistant'] }
    }).sort({ 'metadata.timestamp': 1 });
  }

  /**
   * Get user context and business information
   */
  private async getUserContext(contactId: string, accountId: string): Promise<any> {
    try {
      const contact = await Contact.findById(contactId);
      if (!contact) {
        console.log(`⚠️ DebounceWorkerService: Contact not found for ID: ${contactId}`);
        return {};
      }

      // Get Instagram account settings for agent behavior
      const instagramAccount = await InstagramAccount.findOne({ accountId, isActive: true });
      let agentSettings = {};
      
      if (instagramAccount && instagramAccount.settings) {
        agentSettings = {
          systemPrompt: instagramAccount.settings.systemPrompt,
          toneOfVoice: instagramAccount.settings.toneOfVoice,
          keyInformation: instagramAccount.settings.keyInformation,
          fallbackRules: instagramAccount.settings.fallbackRules
        };
        console.log(`✅ DebounceWorkerService: Found agent settings for account: ${instagramAccount.accountName}`);
      } else {
        console.log(`⚠️ DebounceWorkerService: No agent settings found for account: ${accountId}`);
      }

      return {
        contactName: contact.name,
        contactEmail: contact.email,
        businessName: contact.businessInfo?.company || 'Business',
        specialization: contact.businessInfo?.sector || 'General',
        preferences: contact.preferences || {},
        agentBehavior: agentSettings
      };
    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error getting user context:`, error);
      return {};
    }
  }

  /**
   * Generate contextual response using AI service
   */
  private async generateContextualResponse(
    conversationHistory: IMessage[], 
    newMessages: IMessage[], 
    userContext: any
  ): Promise<string> {
    try {
      // Combine new messages into a single text
      const newMessageText = newMessages.map(msg => msg.content.text).join('\n\n');
      
      // Create context for AI service
      const context = {
        conversationHistory: conversationHistory
          .filter(msg => msg.role !== 'system')
          .map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content.text,
            timestamp: msg.metadata.timestamp
          })),
        newMessages: newMessageText,
        userContext: userContext,
        businessInfo: userContext.businessName,
        agentBehavior: userContext.agentBehavior
      };

      // Call OpenAI service with full context including agent behavior
      const response = await openaiService.generateInstagramResponse({
        conversationHistory: context.conversationHistory,
        userIntent: 'general_inquiry',
        conversationTopic: 'general',
        userSentiment: 'neutral',
        businessContext: {
          company: context.businessInfo,
          sector: userContext.specialization,
          services: ['desarrollo web', 'marketing digital', 'consultoría']
        },
        language: 'es',
        agentBehavior: userContext.agentBehavior
      });
      
      return response || "Gracias por tu mensaje. Un miembro de nuestro equipo te responderá pronto.";
      
    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error generating contextual response:`, error);
      return "Gracias por tu mensaje. Un miembro de nuestro equipo te responderá pronto.";
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
   * Queue a response for sending
   */
  private async queueResponse(conversation: IConversation, responseText: string, originalMids?: string[]): Promise<void> {
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
          processed: false,
          originalMids: originalMids || []
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
      // First, let's check if the messages exist and their current structure
      const existingMessages = await Message.find({ _id: { $in: messageIds } });
      console.log(`🔍 DebounceWorkerService: Found ${existingMessages.length} existing messages out of ${messageIds.length} requested`);
      
      if (existingMessages.length > 0) {
        console.log(`🔍 DebounceWorkerService: Sample message structure:`, {
          id: existingMessages[0].id,
          metadata: existingMessages[0].metadata,
          hasProcessedField: 'processed' in existingMessages[0].metadata
        });
      }
      
      const result = await Message.updateMany(
        { _id: { $in: messageIds } },
        { $set: { 'metadata.processed': true } }
      );
      
      console.log(`✅ DebounceWorkerService: Marked ${result.modifiedCount} messages as processed (requested: ${messageIds.length})`);
      console.log(`🔍 DebounceWorkerService: Update result details:`, {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        acknowledged: result.acknowledged
      });
      
      if (result.modifiedCount !== messageIds.length) {
        console.error(`❌ DebounceWorkerService: Failed to mark all messages as processed. Expected: ${messageIds.length}, Actual: ${result.modifiedCount}`);
        console.error(`❌ DebounceWorkerService: Message IDs that failed to update:`, messageIds);
        throw new Error(`Failed to mark all messages as processed. Expected: ${messageIds.length}, Actual: ${result.modifiedCount}`);
      }
    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error marking messages as processed:`, error);
      throw error; // Re-throw to prevent further processing
    }
  }
}

export default new DebounceWorkerService();




