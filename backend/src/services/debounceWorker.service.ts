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
import { generateStructuredResponse } from './openai.service';
import { 
  ConversationContext, 
  AIResponseConfig, 
  StructuredResponse,
  LEAD_SCORING_STEPS
} from '../types/aiResponse';
import { LeadScoringService } from './leadScoring.service';
import { GlobalAgentRulesService } from './globalAgentRules.service';

class DebounceWorkerService {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private messageCollectionWindow: number = 5000; // 5 seconds for message collection
  private pendingMessages: Map<string, { messages: IMessage[], timer: NodeJS.Timeout }> = new Map();

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

    // Clear all pending message collections
    for (const [conversationId, collection] of this.pendingMessages) {
      clearTimeout(collection.timer);
      console.log(`🧹 DebounceWorkerService: Cleared pending collection for conversation ${conversationId}`);
    }
    this.pendingMessages.clear();

    console.log('✅ DebounceWorkerService: Service stopped successfully');
  }

  /**
   * Trigger message collection for batching (called from webhook service)
   */
  async triggerMessageCollection(conversationId: string, message: IMessage): Promise<void> {
    console.log(`🎯 DebounceWorkerService: Triggering message collection for conversation ${conversationId}`);
    
    try {
      // Add message to collection window
      this.addMessageToCollection(conversationId, message);
      
      console.log(`✅ DebounceWorkerService: Message collection triggered for conversation ${conversationId}`);
    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error triggering message collection:`, error);
    }
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
  private async processConversationBatch(conversation: IConversation, preCollectedMessages?: IMessage[]): Promise<boolean> {
    try {
      // Check if AI is enabled for this conversation
      if (conversation.settings?.aiEnabled === false) {
        console.log(`🤖 DebounceWorkerService: AI disabled for conversation ${conversation.id}, skipping automatic response`);
        return false;
      }

      // Check global agent rules (response limits, lead score, milestones)
      const globalConfig = await GlobalAgentRulesService.getGlobalConfig();
      if (globalConfig) {
        const shouldDisable = await GlobalAgentRulesService.shouldDisableAgent(conversation, globalConfig);
        if (shouldDisable.shouldDisable) {
          console.log(`🚫 DebounceWorkerService: Agent disabled by global rule for conversation ${conversation.id}: ${shouldDisable.reason}`);
          
          // Mark conversation as disabled by the specific rule
          await GlobalAgentRulesService.markDisabledByRule(conversation, shouldDisable.ruleType!);
          await conversation.save();
          
          return false;
        }
      }

      // Check milestone status - if achieved, skip processing (legacy check)
      if (conversation.milestone?.status === 'achieved') {
        console.log(`🎯 DebounceWorkerService: Milestone already achieved for conversation ${conversation.id}, skipping automatic response`);
        return false;
      }

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
      let unprocessedMessages: IMessage[];
      
      if (preCollectedMessages) {
        // Use pre-collected messages (from batching)
        unprocessedMessages = preCollectedMessages;
        console.log(`📦 DebounceWorkerService: Using ${unprocessedMessages.length} pre-collected messages for conversation ${conversation.id}`);
      } else {
        // Get unprocessed messages from database (immediate processing)
        unprocessedMessages = await this.getUnprocessedMessages(conversation.id);
        console.log(`📝 DebounceWorkerService: Processing ${unprocessedMessages.length} unprocessed messages for conversation ${conversation.id}`);
      }
      
      if (unprocessedMessages.length === 0) {
        return false;
      }

      // Mark messages as processed FIRST to prevent race conditions
      await this.markMessagesAsProcessed(unprocessedMessages.map(msg => msg.id));

      // Generate structured response with full conversation context
      const responseData = await this.generateStructuredResponseForConversation(conversation, unprocessedMessages);
      
      if (!responseData) {
        console.log(`⚠️ DebounceWorkerService: No response generated for conversation ${conversation.id}`);
        return false;
      }

      const response = responseData.responseText;

      // Check for milestone achievement in new messages
      await this.checkMilestoneAchievement(conversation, unprocessedMessages);

      // Increment response counter
      await GlobalAgentRulesService.incrementResponseCounter(conversation);
      await conversation.save();

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
   * Add message to collection window for batching
   */
  private addMessageToCollection(conversationId: string, message: IMessage): void {
    console.log(`📥 DebounceWorkerService: Adding message to collection window for conversation ${conversationId}`);
    
    // Check if we already have a collection window for this conversation
    const existing = this.pendingMessages.get(conversationId);
    
    if (existing) {
      // Add message to existing collection
      existing.messages.push(message);
      console.log(`📥 DebounceWorkerService: Added message to existing collection. Total messages: ${existing.messages.length}`);
    } else {
      // Create new collection window
      const messages = [message];
      const timer = setTimeout(() => {
        this.processCollectedMessages(conversationId);
      }, this.messageCollectionWindow);
      
      this.pendingMessages.set(conversationId, { messages, timer });
      console.log(`📥 DebounceWorkerService: Created new collection window for conversation ${conversationId}. Will process in ${this.messageCollectionWindow}ms`);
    }
  }

  /**
   * Process collected messages for a conversation
   */
  private async processCollectedMessages(conversationId: string): Promise<void> {
    console.log(`⏰ DebounceWorkerService: Processing collected messages for conversation ${conversationId}`);
    
    const collection = this.pendingMessages.get(conversationId);
    if (!collection) {
      console.log(`⚠️ DebounceWorkerService: No collection found for conversation ${conversationId}`);
        return;
      }

    // Remove from pending messages
    this.pendingMessages.delete(conversationId);
    
    const messages = collection.messages;
    console.log(`📦 DebounceWorkerService: Processing ${messages.length} collected messages for conversation ${conversationId}`);

    if (messages.length === 0) {
      console.log(`⚠️ DebounceWorkerService: No messages to process for conversation ${conversationId}`);
      return;
    }

    // Get conversation details
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      console.error(`❌ DebounceWorkerService: Conversation not found: ${conversationId}`);
      return;
    }

    // Process the batch
    await this.processConversationBatch(conversation, messages);
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
   * Generate structured response for a message
   */
  private async generateStructuredResponseForConversation(
    conversation: IConversation, 
    newMessages: IMessage[]
  ): Promise<{ responseText: string; structuredResponse?: StructuredResponse } | null> {
    console.log(`🤖 DebounceWorkerService: Generating structured response for ${newMessages.length} messages`);
    
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
      
      // Create conversation context for structured response
      const conversationContext: ConversationContext = {
        businessName: userContext.businessName || 'Business',
        conversationHistory: conversationHistory
          .filter(msg => msg.role !== 'system')
          .map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content.text,
            timestamp: msg.metadata.timestamp
          })),
        lastMessage: newMessages.map(msg => msg.content.text).join('\n\n'),
        timeSinceLastMessage: this.calculateTimeSinceLastMessage(conversationHistory),
        repetitionPatterns: [],
        leadHistory: conversation.leadScoring?.scoreHistory?.map(h => h.score) || []
      };

      // Create AI response config
      const aiConfig: AIResponseConfig = {
        useStructuredResponse: true,
        enableLeadScoring: true,
        enableRepetitionPrevention: true,
        enableContextAwareness: true,
        customInstructions: userContext.agentBehavior?.systemPrompt,
        businessContext: {
          company: userContext.businessName || 'Business',
          sector: userContext.specialization || 'General',
          services: ['desarrollo web', 'marketing digital', 'consultoría']
        }
      };

      // Generate structured response
      const structuredResponse = await generateStructuredResponse(conversationContext, aiConfig);
      
      // Update conversation with structured response data
      await this.updateConversationWithStructuredResponse(conversation.id, structuredResponse);
      
      console.log(`✅ DebounceWorkerService: Structured response generated: "${structuredResponse.responseText}"`);
      return {
        responseText: structuredResponse.responseText,
        structuredResponse
      };

    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error generating structured response:`, error);
      return {
        responseText: "Gracias por tu mensaje. Un miembro de nuestro equipo te responderá pronto."
      };
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
      
      // Create conversation context for structured response
      const conversationContext: ConversationContext = {
        businessName: userContext.businessName || 'Business',
        conversationHistory: conversationHistory
          .filter(msg => msg.role !== 'system')
          .map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content.text,
            timestamp: msg.metadata.timestamp
          })),
        lastMessage: newMessageText,
        timeSinceLastMessage: this.calculateTimeSinceLastMessage(conversationHistory),
        repetitionPatterns: [],
        leadHistory: [] // Will be populated from conversation data
      };

      // Create AI response config
      const aiConfig: AIResponseConfig = {
        useStructuredResponse: true,
        enableLeadScoring: true,
        enableRepetitionPrevention: true,
        enableContextAwareness: true,
        customInstructions: userContext.agentBehavior?.systemPrompt,
        businessContext: {
          company: userContext.businessName || 'Business',
          sector: userContext.specialization || 'General',
          services: ['desarrollo web', 'marketing digital', 'consultoría']
        }
      };

      // Generate structured response
      const structuredResponse = await generateStructuredResponse(conversationContext, aiConfig);
      
      console.log('✅ DebounceWorkerService: Structured response generated:', {
        leadScore: structuredResponse.leadScore,
        intent: structuredResponse.intent,
        nextAction: structuredResponse.nextAction
      });
      
      return structuredResponse.responseText;

    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error generating contextual response:`, error);
      return "Gracias por tu mensaje. Un miembro de nuestro equipo te responderá pronto.";
    }
  }

  /**
   * Calculate time since last message in minutes
   */
  private calculateTimeSinceLastMessage(conversationHistory: IMessage[]): number {
    if (conversationHistory.length === 0) return 0;
    
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    const lastMessageTime = new Date(lastMessage.metadata.timestamp);
    const now = new Date();
    
    return Math.floor((now.getTime() - lastMessageTime.getTime()) / (1000 * 60));
  }

  /**
   * Update conversation with structured response data
   */
  private async updateConversationWithStructuredResponse(
    conversationId: string,
    structuredResponse: StructuredResponse
  ): Promise<void> {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        console.warn(`⚠️ DebounceWorkerService: Conversation not found for ID: ${conversationId}`);
        return;
      }

      // Update lead scoring
      const previousScore = conversation.leadScoring?.currentScore || 1;
      const stepInfo = LEAD_SCORING_STEPS[structuredResponse.leadScore as keyof typeof LEAD_SCORING_STEPS];
      
      conversation.leadScoring = {
        currentScore: structuredResponse.leadScore,
        previousScore: previousScore,
        progression: structuredResponse.metadata.leadProgression || 'maintained',
        scoreHistory: [
          ...(conversation.leadScoring?.scoreHistory || []),
          {
            score: structuredResponse.leadScore,
            timestamp: new Date(),
            reason: `Intent: ${structuredResponse.intent}, Action: ${structuredResponse.nextAction}`,
            stepName: stepInfo?.name || 'Contact Received'
          }
        ],
        lastScoredAt: new Date(),
        confidence: structuredResponse.confidence,
        currentStep: {
          stepNumber: structuredResponse.leadScore,
          stepName: stepInfo?.name || 'Contact Received',
          stepDescription: stepInfo?.description || 'Initial contact from customer'
        }
      };

      // Update AI response metadata
      conversation.aiResponseMetadata = {
        lastResponseType: 'structured',
        lastIntent: structuredResponse.intent,
        lastNextAction: structuredResponse.nextAction,
        repetitionDetected: false, // Not available in simplified structure
        contextAwareness: structuredResponse.metadata.previousContextReferenced,
        businessNameUsed: structuredResponse.metadata.businessNameUsed,
        responseQuality: structuredResponse.confidence
      };

      // Update analytics
      const leadProgression = LeadScoringService.analyzeLeadProgression({
        businessName: conversation.contactId?.name || 'Business',
        conversationHistory: [],
        lastMessage: '',
        timeSinceLastMessage: 0,
        repetitionPatterns: [],
        leadHistory: conversation.leadScoring?.scoreHistory?.map(h => h.score) || []
      });

      conversation.analytics = {
        leadProgression: {
          trend: leadProgression.trend,
          averageScore: leadProgression.averageScore,
          peakScore: leadProgression.peakScore,
          progressionRate: leadProgression.progressionRate
        },
        repetitionPatterns: [], // Not available in simplified structure
        conversationFlow: {
          totalTurns: conversation.metrics.totalMessages,
          averageTurnLength: 0, // Will be calculated elsewhere
          questionCount: 0, // Will be calculated elsewhere
          responseCount: conversation.metrics.botMessages
        }
      };

      await conversation.save();
      console.log('✅ DebounceWorkerService: Conversation updated with structured response data');

    } catch (error) {
      console.error('❌ DebounceWorkerService: Error updating conversation with structured response:', error);
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

      // Check for existing queue items
      const allQueueItems = await OutboundQueue.find({
        conversationId: conversation.id
      }).sort({ createdAt: -1 });
      
      console.log(`🔍 All queue items for conversation ${conversation.id}: [${allQueueItems.length} items]`);

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
        console.log(`🔍 DebounceWorkerService: Sample message structure: [${existingMessages.length} messages]`);
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

  /**
   * Check for milestone achievement in new messages
   */
  private async checkMilestoneAchievement(conversation: IConversation, newMessages: IMessage[]): Promise<void> {
    try {
      // Only check if there's a milestone set and it's not already achieved
      if (!conversation.milestone?.target || conversation.milestone.status === 'achieved') {
        return;
      }

      console.log(`🎯 DebounceWorkerService: Checking milestone achievement for conversation ${conversation.id}`);
      console.log(`🎯 DebounceWorkerService: Target milestone: ${conversation.milestone.target}`);

      const messageTexts = newMessages.map(msg => msg.content.text).join(' ').toLowerCase();
      let isAchieved = false;
      let achievementReason = '';

      // Check for different milestone types
      switch (conversation.milestone.target) {
        case 'link_shared':
          if (this.detectLinkShared(messageTexts)) {
            isAchieved = true;
            achievementReason = 'Link detected in user message';
          }
          break;
        
        case 'meeting_scheduled':
          if (this.detectMeetingScheduled(messageTexts)) {
            isAchieved = true;
            achievementReason = 'Meeting scheduling detected in user message';
          }
          break;
        
        case 'demo_booked':
          if (this.detectDemoBooked(messageTexts)) {
            isAchieved = true;
            achievementReason = 'Demo booking detected in user message';
          }
          break;
        
        case 'custom':
          if (conversation.milestone.customTarget) {
            if (this.detectCustomMilestone(messageTexts, conversation.milestone.customTarget)) {
              isAchieved = true;
              achievementReason = `Custom milestone achieved: ${conversation.milestone.customTarget}`;
            }
          }
          break;
      }

      if (isAchieved) {
        console.log(`🎯 DebounceWorkerService: Milestone achieved for conversation ${conversation.id}: ${achievementReason}`);
        
        // Update milestone status
        conversation.milestone.status = 'achieved';
        conversation.milestone.achievedAt = new Date();
        conversation.milestone.notes = achievementReason;

        // Auto-disable agent if configured
        if (conversation.milestone.autoDisableAgent) {
          console.log(`🎯 DebounceWorkerService: Auto-disabling agent for conversation ${conversation.id}`);
          if (!conversation.settings) {
            conversation.settings = {
              autoRespond: true,
              aiEnabled: true,
              priority: 'normal',
              tags: [],
              notes: [],
              followUpRequired: false,
              businessHoursOnly: false,
              responseCounter: {
                totalResponses: 0,
                lastResetAt: new Date(),
                disabledByResponseLimit: false,
                disabledByLeadScore: false,
                disabledByMilestone: false
              }
            };
          }
          conversation.settings.aiEnabled = false;
        }

        await conversation.save();
        console.log(`✅ DebounceWorkerService: Milestone marked as achieved for conversation ${conversation.id}`);
      }

    } catch (error) {
      console.error(`❌ DebounceWorkerService: Error checking milestone achievement:`, error);
    }
  }

  /**
   * Detect if a link was shared
   */
  private detectLinkShared(messageText: string): boolean {
    // Common link patterns
    const linkPatterns = [
      /https?:\/\/[^\s]+/g,
      /www\.[^\s]+/g,
      /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/[^\s]*/g,
      /instagram\.com\/[^\s]+/g,
      /facebook\.com\/[^\s]+/g,
      /linkedin\.com\/[^\s]+/g,
      /youtube\.com\/[^\s]+/g,
      /tiktok\.com\/[^\s]+/g
    ];

    return linkPatterns.some(pattern => pattern.test(messageText));
  }

  /**
   * Detect if a meeting was scheduled
   */
  private detectMeetingScheduled(messageText: string): boolean {
    const meetingKeywords = [
      'meeting', 'reunión', 'cita', 'agendar', 'schedule', 'calendar',
      'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo',
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      'mañana', 'tarde', 'noche', 'morning', 'afternoon', 'evening',
      'zoom', 'teams', 'google meet', 'skype', 'videollamada', 'call',
      'confirmo', 'confirm', 'acepto', 'accept', 'perfecto', 'perfect'
    ];

    return meetingKeywords.some(keyword => messageText.includes(keyword));
  }

  /**
   * Detect if a demo was booked
   */
  private detectDemoBooked(messageText: string): boolean {
    const demoKeywords = [
      'demo', 'demostración', 'presentación', 'presentation',
      'muestra', 'show', 'ver', 'see', 'conocer', 'know',
      'producto', 'product', 'servicio', 'service',
      'agendar demo', 'schedule demo', 'book demo'
    ];

    return demoKeywords.some(keyword => messageText.includes(keyword));
  }

  /**
   * Detect custom milestone achievement
   */
  private detectCustomMilestone(messageText: string, customTarget: string): boolean {
    // Simple keyword matching for custom milestones
    const keywords = customTarget.toLowerCase().split(' ').filter(word => word.length > 2);
    return keywords.some(keyword => messageText.includes(keyword));
  }
}

export default new DebounceWorkerService();




