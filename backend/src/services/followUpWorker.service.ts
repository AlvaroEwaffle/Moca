import { FollowUpConfig, LeadFollowUp, Conversation, Contact, InstagramAccount, Message } from '../models';
import { OutboundQueue } from '../models';
import instagramApiService from './instagramApi.service';
import { generateFollowUpSuggestion } from './openai.service';

export class FollowUpWorkerService {
  private static instance: FollowUpWorkerService;

  public static getInstance(): FollowUpWorkerService {
    if (!FollowUpWorkerService.instance) {
      FollowUpWorkerService.instance = new FollowUpWorkerService();
    }
    return FollowUpWorkerService.instance;
  }

  /**
   * Main cron job handler - processes all follow-ups
   */
  async processFollowUps(): Promise<void> {
    try {
      console.log('🔄 [FollowUp Worker] Starting follow-up processing...');
      
      // Get all enabled follow-up configurations
      const configs = await FollowUpConfig.find({ enabled: true });
      console.log(`📊 [FollowUp Worker] Found ${configs.length} enabled configurations`);

      for (const config of configs) {
        try {
          await this.processAccountFollowUps(config);
        } catch (error) {
          console.error(`❌ [FollowUp Worker] Error processing account ${config.accountId}:`, error);
        }
      }

      console.log('✅ [FollowUp Worker] Follow-up processing completed');
    } catch (error) {
      console.error('❌ [FollowUp Worker] Error in processFollowUps:', error);
    }
  }

  /**
   * Process follow-ups for a specific account
   */
  private async processAccountFollowUps(config: any): Promise<void> {
    console.log(`🔄 [FollowUp Worker] Processing account ${config.accountId}...`);

    // Get leads that need follow-up
    const leads = await this.getLeadsForFollowUp(config);
    console.log(`📊 [FollowUp Worker] Found ${leads.length} leads for follow-up`);

    if (leads.length === 0) {
      console.log(`⏭️ [FollowUp Worker] No leads to process for account ${config.accountId}`);
      return;
    }

    console.log(`🚀 [FollowUp Worker] Starting to process ${leads.length} leads...`);
    
    for (const lead of leads) {
      try {
        console.log(`🔄 [FollowUp Worker] Processing lead ${lead._id} (${lead.contactId?.name || 'Unknown'})...`);
        await this.processLeadFollowUp(lead, config);
        console.log(`✅ [FollowUp Worker] Successfully processed lead ${lead._id}`);
      } catch (error) {
        console.error(`❌ [FollowUp Worker] Error processing lead ${lead._id}:`, error);
      }
    }
    
    console.log(`✅ [FollowUp Worker] Completed processing ${leads.length} leads for account ${config.accountId}`);
  }

  /**
   * Get leads that need follow-up based on configuration
   * Respects Instagram's 24-hour window rule
   */
  private async getLeadsForFollowUp(config: any): Promise<any[]> {
    const now = new Date();
    
    // Instagram allows messages only within 24 hours of last user message
    const instagramWindowStart = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24 hours ago
    
    // Exclude conversations that had activity in the last X hours (to give them time to respond)
    const excludeRecentActivity = new Date(now.getTime() - (config.timeSinceLastAnswer * 60 * 60 * 1000));
    
    console.log(`🔍 [FollowUp Worker] Searching for leads with Instagram 24h window constraint:`, {
      accountId: config.accountId,
      minLeadScore: config.minLeadScore,
      maxFollowUps: config.maxFollowUps,
      timeSinceLastAnswer: config.timeSinceLastAnswer,
      instagramWindowStart: instagramWindowStart.toISOString(),
      excludeRecentActivity: excludeRecentActivity.toISOString(),
      now: now.toISOString(),
      explanation: `Looking for conversations with activity between ${excludeRecentActivity.toISOString()} and ${instagramWindowStart.toISOString()}`
    });

    // Find conversations that meet the criteria
    // Must be within Instagram's 24-hour window but outside the "recent activity" window
    const conversations = await Conversation.find({
      accountId: config.accountId,
      'leadScoring.currentScore': { $gte: config.minLeadScore, $lt: 7 }, // Not converted yet
      'timestamps.lastActivity': { 
        $gte: instagramWindowStart,  // Within Instagram's 24-hour window
        $lt: excludeRecentActivity   // But not too recent (give them time to respond)
      },
      status: 'open' // Use 'open' status instead of 'active'
      // Note: We include both aiEnabled: true and false conversations
    }).populate('contactId');

    console.log(`🔍 [FollowUp Worker] Found ${conversations.length} conversations meeting criteria`);

    // Log details of each conversation found
    conversations.forEach((conv, index) => {
      console.log(`📊 [FollowUp Worker] Conversation ${index + 1}:`, {
        id: conv._id,
        accountId: conv.accountId,
        leadScore: conv.leadScoring?.currentScore,
        lastUserMessage: conv.timestamps?.lastUserMessage,
        lastActivity: conv.timestamps?.lastActivity,
        aiEnabled: conv.settings?.aiEnabled,
        status: conv.status,
        contactName: conv.contactId?.name || conv.contactId?.metadata?.instagramData?.username || 'Unknown'
      });
    });

    // Filter out conversations that already have max follow-ups
    const validLeads = [];
    for (const conversation of conversations) {
      const followUpCount = await LeadFollowUp.countDocuments({
        conversationId: conversation._id,
        status: { $in: ['sent', 'delivered'] }
      });

      console.log(`📈 [FollowUp Worker] Conversation ${conversation._id}: ${followUpCount}/${config.maxFollowUps} follow-ups sent`);

      if (followUpCount < config.maxFollowUps) {
        validLeads.push(conversation);
        console.log(`✅ [FollowUp Worker] Added to valid leads: ${conversation._id}`);
      } else {
        console.log(`❌ [FollowUp Worker] Skipped (max follow-ups reached): ${conversation._id}`);
      }
    }

    console.log(`✅ [FollowUp Worker] ${validLeads.length} leads ready for follow-up`);
    return validLeads;
  }

  /**
   * Process follow-up for a specific lead
   */
  private async processLeadFollowUp(lead: any, config: any): Promise<void> {
    console.log(`🔄 [FollowUp Worker] Processing lead ${lead._id} (${lead.contactId?.name || 'Unknown'})...`);

    // Check if there's already a pending follow-up for this conversation
    const existingFollowUp = await LeadFollowUp.findOne({
      conversationId: lead._id,
      status: 'pending'
    });

    if (existingFollowUp) {
      console.log(`⏭️ [FollowUp Worker] Skipping lead ${lead._id} - already has pending follow-up (ID: ${existingFollowUp._id})`);
      return;
    }

    // Check if we've already sent the maximum number of follow-ups
    const sentFollowUps = await LeadFollowUp.countDocuments({
      conversationId: lead._id,
      status: { $in: ['sent', 'delivered', 'responded'] }
    });

    if (sentFollowUps >= config.maxFollowUps) {
      console.log(`⏭️ [FollowUp Worker] Skipping lead ${lead._id} - already sent ${sentFollowUps}/${config.maxFollowUps} follow-ups`);
      return;
    }

    console.log(`📝 [FollowUp Worker] Generating follow-up message for lead ${lead._id}...`);
    
    // Generate follow-up message
    const message = await this.generateFollowUpMessage(lead, config);
    console.log(`📝 [FollowUp Worker] Generated message: "${message.substring(0, 50)}..."`);

    console.log(`💾 [FollowUp Worker] Creating follow-up record for lead ${lead._id}...`);
    
    // Create follow-up record (store actual message sent for audit)
    const followUp = new LeadFollowUp({
      conversationId: lead._id,
      contactId: lead.contactId._id,
      accountId: config.accountId,
      userId: config.userId,
      status: 'pending',
      scheduledAt: new Date(),
      followUpCount: 0,
      messageTemplate: message // Store the actual generated message (template or AI)
    });

    await followUp.save();
    console.log(`💾 [FollowUp Worker] Follow-up record created: ${followUp._id}`);

    console.log(`📤 [FollowUp Worker] Adding to outbound queue for lead ${lead._id}...`);
    
    // Add to outbound queue
    await this.addToOutboundQueue(lead, message, (followUp as any)._id.toString());

    console.log(`✅ [FollowUp Worker] Follow-up scheduled for lead ${lead._id}`);
  }

  /**
   * Generate personalized follow-up message (template or AI-suggested)
   */
  private async generateFollowUpMessage(lead: any, config: any): Promise<string> {
    const messageMode = config.messageMode || 'template';

    if (messageMode === 'ai') {
      return this.generateAiFollowUpMessage(lead, config);
    }

    // Template mode
    let message = config.messageTemplate || '';

    // Basic personalization
    if (lead.contactId && lead.contactId.name) {
      message = message.replace(/\{name\}/g, lead.contactId.name);
    } else if (lead.contactId && lead.contactId.metadata?.instagramData?.username) {
      message = message.replace(/\{name\}/g, `@${lead.contactId.metadata.instagramData.username}`);
    } else {
      message = message.replace(/\{name\}/g, '');
    }

    const leadScore = lead.leadScoring?.currentScore || 0;
    if (leadScore >= 3) {
      message += `\n\nVeo que ya has mostrado interés en nuestros servicios. ¿Te gustaría agendar una consulta?`;
    }

    return message;
  }

  /**
   * Generate AI-suggested follow-up based on conversation and system prompt
   */
  private async generateAiFollowUpMessage(lead: any, config: any): Promise<string> {
    try {
      // Fetch conversation messages
      const messages = await Message.find({
        conversationId: lead._id,
        role: { $in: ['user', 'assistant'] }
      })
        .sort({ 'metadata.timestamp': 1 })
        .lean();

      const conversationHistory = messages.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content?.text || ''
      }));

      // Get account agent behavior (system prompt)
      const instagramAccount = await InstagramAccount.findOne({ accountId: config.accountId, isActive: true });
      const agentBehavior = instagramAccount?.settings
        ? {
            systemPrompt: instagramAccount.settings.systemPrompt,
            toneOfVoice: instagramAccount.settings.toneOfVoice,
            keyInformation: instagramAccount.settings.keyInformation
          }
        : undefined;

      const lastActivity = lead.timestamps?.lastActivity
        ? new Date(lead.timestamps.lastActivity)
        : new Date();
      const hoursSinceLastActivity = Math.floor(
        (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60)
      );

      const message = await generateFollowUpSuggestion({
        conversationHistory,
        hoursSinceLastActivity,
        leadScore: lead.leadScoring?.currentScore,
        agentBehavior
      });

      return message;
    } catch (error: any) {
      console.error(`❌ [FollowUp Worker] AI follow-up failed for lead ${lead._id}:`, error);
      // Fallback to template if AI fails
      const fallback = config.messageTemplate || 'Hola! 👋 Vi que te interesó nuestro servicio. ¿Te gustaría que te cuente más detalles?';
      return fallback.replace(/\{name\}/g, lead.contactId?.name || lead.contactId?.metadata?.instagramData?.username || '');
    }
  }

  /**
   * Add follow-up message to outbound queue
   */
  private async addToOutboundQueue(lead: any, message: string, followUpId: string): Promise<void> {
    try {
      // Generate a unique message ID for the follow-up
      const messageId = `followup_${followUpId}_${Date.now()}`;
      
      console.log(`📤 [FollowUp Worker] Creating outbound queue message for follow-up ${followUpId}...`);
      
      const outboundMessage = new OutboundQueue({
        messageId: messageId,
        conversationId: lead._id,
        contactId: lead.contactId._id,
        accountId: lead.accountId,
        priority: 'normal',
        status: 'pending',
        content: {
          text: message
        },
        metadata: {
          createdAt: new Date(),
          scheduledFor: new Date(),
          attempts: 0,
          maxAttempts: 3,
          followUpId: followUpId
        }
      });

      await outboundMessage.save();
      console.log(`📤 [FollowUp Worker] Follow-up message added to outbound queue with ID: ${messageId}`);
      
      // Update the LeadFollowUp record with the messageId
      await LeadFollowUp.findByIdAndUpdate(followUpId, {
        messageId: outboundMessage._id
      });
      console.log(`📤 [FollowUp Worker] Updated LeadFollowUp record with messageId: ${outboundMessage._id}`);
      
    } catch (error) {
      console.error(`❌ [FollowUp Worker] Error adding follow-up to outbound queue:`, error);
      throw error;
    }
  }

  /**
   * Update follow-up status when message is sent
   */
  async updateFollowUpStatus(followUpId: string, status: string, messageId?: string): Promise<void> {
    const updateData: any = {
      status,
      lastFollowUpAt: new Date()
    };

    if (status === 'sent') {
      updateData.sentAt = new Date();
      updateData.messageId = messageId;
    } else if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    }

    await LeadFollowUp.findByIdAndUpdate(followUpId, updateData);
    console.log(`✅ [FollowUp Worker] Updated follow-up ${followUpId} status to ${status}`);
  }

  /**
   * Get follow-up statistics for an account
   */
  async getFollowUpStats(accountId: string): Promise<any> {
    const stats = await LeadFollowUp.aggregate([
      { $match: { accountId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalFollowUps = await LeadFollowUp.countDocuments({ accountId });
    const todayFollowUps = await LeadFollowUp.countDocuments({
      accountId,
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });

    return {
      total: totalFollowUps,
      today: todayFollowUps,
      byStatus: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    };
  }
}

export const followUpWorkerService = FollowUpWorkerService.getInstance();
