import { FollowUpConfig, LeadFollowUp, Conversation, Contact, InstagramAccount } from '../models';
import { OutboundQueue } from '../models';
import instagramApiService from './instagramApi.service';

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

    for (const lead of leads) {
      try {
        await this.processLeadFollowUp(lead, config);
      } catch (error) {
        console.error(`❌ [FollowUp Worker] Error processing lead ${lead._id}:`, error);
      }
    }
  }

  /**
   * Get leads that need follow-up based on configuration
   */
  private async getLeadsForFollowUp(config: any): Promise<any[]> {
    const now = new Date();
    const timeThreshold = new Date(now.getTime() - (config.timeSinceLastAnswer * 60 * 60 * 1000));

    console.log(`🔍 [FollowUp Worker] Searching for leads with config:`, {
      accountId: config.accountId,
      minLeadScore: config.minLeadScore,
      maxFollowUps: config.maxFollowUps,
      timeSinceLastAnswer: config.timeSinceLastAnswer,
      timeThreshold: timeThreshold.toISOString(),
      now: now.toISOString()
    });

    // Find conversations that meet the criteria
    const conversations = await Conversation.find({
      accountId: config.accountId,
      'leadScoring.currentScore': { $gte: config.minLeadScore, $lt: 7 }, // Not converted yet
      'timestamps.lastUserMessage': { $lt: timeThreshold }, // No response in specified time
      'settings.aiEnabled': true, // Only active conversations
      status: 'active'
    }).populate('contactId');

    console.log(`🔍 [FollowUp Worker] Found ${conversations.length} conversations meeting criteria`);

    // Log details of each conversation found
    conversations.forEach((conv, index) => {
      console.log(`📊 [FollowUp Worker] Conversation ${index + 1}:`, {
        id: conv._id,
        accountId: conv.accountId,
        leadScore: conv.leadScoring?.currentScore,
        lastUserMessage: conv.timestamps?.lastUserMessage,
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
    console.log(`🔄 [FollowUp Worker] Processing lead ${lead._id}...`);

    // Check if there's already a pending follow-up for this conversation
    const existingFollowUp = await LeadFollowUp.findOne({
      conversationId: lead._id,
      status: 'pending'
    });

    if (existingFollowUp) {
      console.log(`⏭️ [FollowUp Worker] Skipping lead ${lead._id} - already has pending follow-up`);
      return;
    }

    // Generate follow-up message
    const message = await this.generateFollowUpMessage(lead, config);

    // Create follow-up record
    const followUp = new LeadFollowUp({
      conversationId: lead._id,
      contactId: lead.contactId._id,
      accountId: config.accountId,
      userId: config.userId,
      status: 'pending',
      scheduledAt: new Date(),
      followUpCount: 0,
      messageTemplate: config.messageTemplate
    });

    await followUp.save();

    // Add to outbound queue
    await this.addToOutboundQueue(lead, message, (followUp as any)._id.toString());

    console.log(`✅ [FollowUp Worker] Follow-up scheduled for lead ${lead._id}`);
  }

  /**
   * Generate personalized follow-up message
   */
  private async generateFollowUpMessage(lead: any, config: any): Promise<string> {
    let message = config.messageTemplate;

    // Basic personalization
    if (lead.contactId && lead.contactId.name) {
      message = message.replace(/\{name\}/g, lead.contactId.name);
    } else if (lead.contactId && lead.contactId.metadata?.instagramData?.username) {
      // Fallback to Instagram username if name not available
      message = message.replace(/\{name\}/g, `@${lead.contactId.metadata.instagramData.username}`);
    } else {
      // Remove {name} placeholder if no name available
      message = message.replace(/\{name\}/g, '');
    }

    // Add lead score context
    const leadScore = lead.leadScoring?.currentScore || 0;
    if (leadScore >= 3) {
      message += `\n\nVeo que ya has mostrado interés en nuestros servicios. ¿Te gustaría agendar una consulta?`;
    }

    return message;
  }

  /**
   * Add follow-up message to outbound queue
   */
  private async addToOutboundQueue(lead: any, message: string, followUpId: string): Promise<void> {
    const outboundMessage = new OutboundQueue({
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
    console.log(`📤 [FollowUp Worker] Follow-up message added to outbound queue`);
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
