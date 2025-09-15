import Conversation, { IConversation } from '../models/conversation.model';
import Message, { IMessage } from '../models/message.model';
import InstagramAccount, { IInstagramAccount } from '../models/instagramAccount.model';
import GlobalAgentConfig, { IGlobalAgentConfig } from '../models/globalAgentConfig.model';
import Contact, { IContact } from '../models/contact.model';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface OverviewMetrics {
  totalConversations: number;
  activeConversations: number;
  averageLeadScore: number;
  responseSuccessRate: number;
  milestoneAchievementRate: number;
  totalMessages: number;
  averageResponseTime: number;
  agentDisablementRate: number;
}

export interface AgentPerformance {
  accountId: string;
  accountName: string;
  totalConversations: number;
  averageLeadScore: number;
  responseCount: number;
  errorCount: number;
  averageResponseTime: number;
  successRate: number;
  agentDisabledCount: number;
  milestoneAchievedCount: number;
}

export interface LeadScoringAnalytics {
  scoreDistribution: Array<{
    score: number;
    count: number;
    percentage: number;
    stepName: string;
  }>;
  averageScore: number;
  progressionRate: number;
  topPerformingScores: Array<{
    score: number;
    stepName: string;
    count: number;
  }>;
}

export interface ConversationAnalytics {
  totalConversations: number;
  conversationsByStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  averageConversationLength: number;
  averageMessagesPerConversation: number;
  conversationsByDay: Array<{
    date: string;
    count: number;
  }>;
  peakActivityHours: Array<{
    hour: number;
    count: number;
  }>;
}

export interface SystemHealthMetrics {
  totalAccounts: number;
  activeAccounts: number;
  totalContacts: number;
  totalMessages: number;
  averageProcessingTime: number;
  errorRate: number;
  queueStatus: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  globalAgentConfig: {
    responseLimitsEnabled: boolean;
    leadScoreAutoDisableEnabled: boolean;
    milestoneAutoDisableEnabled: boolean;
  };
}

export interface RealTimeMetrics {
  activeConversations: number;
  messagesLastHour: number;
  averageResponseTime: number;
  systemUptime: number;
  errorRate: number;
  queueStatus: {
    pending: number;
    processing: number;
  };
}

export class AnalyticsService {
  /**
   * Get overview metrics for the specified date range
   */
  static async getOverviewMetrics(dateRange: DateRange): Promise<OverviewMetrics> {
    try {
      console.log('📊 [AnalyticsService] Getting overview metrics for date range:', dateRange);

      const [
        totalConversations,
        activeConversations,
        averageLeadScore,
        responseSuccessRate,
        milestoneAchievementRate,
        totalMessages,
        averageResponseTime,
        agentDisablementRate
      ] = await Promise.all([
        this.getTotalConversations(dateRange),
        this.getActiveConversations(),
        this.getAverageLeadScore(dateRange),
        this.getResponseSuccessRate(dateRange),
        this.getMilestoneAchievementRate(dateRange),
        this.getTotalMessages(dateRange),
        this.getAverageResponseTime(dateRange),
        this.getAgentDisablementRate(dateRange)
      ]);

      const metrics: OverviewMetrics = {
        totalConversations,
        activeConversations,
        averageLeadScore,
        responseSuccessRate,
        milestoneAchievementRate,
        totalMessages,
        averageResponseTime,
        agentDisablementRate
      };

      console.log('✅ [AnalyticsService] Overview metrics calculated successfully');
      return metrics;

    } catch (error) {
      console.error('❌ [AnalyticsService] Error getting overview metrics:', error);
      throw error;
    }
  }

  /**
   * Get agent performance metrics
   */
  static async getAgentPerformance(accountId?: string): Promise<AgentPerformance[]> {
    try {
      console.log('📊 [AnalyticsService] Getting agent performance for account:', accountId || 'all');

      const pipeline: any[] = [
        { $match: accountId ? { accountId } : {} },
        {
          $group: {
            _id: '$accountId',
            totalConversations: { $sum: 1 },
            averageLeadScore: { $avg: '$leadScoring.currentScore' },
            responseCount: { $sum: '$metrics.botMessages' },
            errorCount: { $sum: '$metrics.errorCount' },
            averageResponseTime: { $avg: '$metrics.averageResponseTime' },
            agentDisabledCount: {
              $sum: {
                $cond: [
                  { $eq: ['$settings.aiEnabled', false] },
                  1,
                  0
                ]
              }
            },
            milestoneAchievedCount: {
              $sum: {
                $cond: [
                  { $eq: ['$milestone.status', 'achieved'] },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $lookup: {
            from: 'instagramaccounts',
            localField: '_id',
            foreignField: 'accountId',
            as: 'account'
          }
        },
        {
          $unwind: {
            path: '$account',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            accountId: '$_id',
            accountName: { $ifNull: ['$account.name', 'Unknown Account'] },
            totalConversations: 1,
            averageLeadScore: { $round: ['$averageLeadScore', 2] },
            responseCount: 1,
            errorCount: 1,
            averageResponseTime: { $round: ['$averageResponseTime', 2] },
            successRate: {
              $round: [
                {
                  $multiply: [
                    {
                      $divide: [
                        { $subtract: ['$responseCount', '$errorCount'] },
                        { $max: ['$responseCount', 1] }
                      ]
                    },
                    100
                  ]
                },
                2
              ]
            },
            agentDisabledCount: 1,
            milestoneAchievedCount: 1
          }
        },
        { $sort: { totalConversations: -1 } }
      ];

      const performance = await Conversation.aggregate(pipeline);
      console.log('✅ [AnalyticsService] Agent performance calculated successfully');
      return performance;

    } catch (error) {
      console.error('❌ [AnalyticsService] Error getting agent performance:', error);
      throw error;
    }
  }

  /**
   * Get lead scoring analytics
   */
  static async getLeadScoringAnalytics(dateRange: DateRange): Promise<LeadScoringAnalytics> {
    try {
      console.log('📊 [AnalyticsService] Getting lead scoring analytics for date range:', dateRange);

      const pipeline: any[] = [
        {
          $match: {
            'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end }
          }
        },
        {
          $group: {
            _id: '$leadScoring.currentScore',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ];

      const scoreDistribution = await Conversation.aggregate(pipeline);
      const totalConversations = scoreDistribution.reduce((sum: number, item: any) => sum + item.count, 0);

      // Calculate percentages and add step names
      const distributionWithPercentages = scoreDistribution.map((item: any) => {
        const stepName = this.getStepName(item._id);
        return {
          score: item._id,
          count: item.count,
          percentage: totalConversations > 0 ? Math.round((item.count / totalConversations) * 100) : 0,
          stepName
        };
      });

      // Calculate average score
      const averageScore = totalConversations > 0 
        ? scoreDistribution.reduce((sum: number, item: any) => sum + (item._id * item.count), 0) / totalConversations
        : 0;

      // Calculate progression rate (conversations that moved up in score)
      const progressionPipeline = [
        {
          $match: {
            'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end },
            'leadScoring.progression': 'increased'
          }
        },
        { $count: 'increased' }
      ];

      const progressionResult = await Conversation.aggregate(progressionPipeline);
      const progressionRate = totalConversations > 0 
        ? Math.round(((progressionResult[0]?.increased || 0) / totalConversations) * 100)
        : 0;

      // Get top performing scores
      const topPerformingScores = distributionWithPercentages
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 3)
        .map((item: any) => ({
          score: item.score,
          stepName: item.stepName,
          count: item.count
        }));

      const analytics: LeadScoringAnalytics = {
        scoreDistribution: distributionWithPercentages,
        averageScore: Math.round(averageScore * 100) / 100,
        progressionRate,
        topPerformingScores
      };

      console.log('✅ [AnalyticsService] Lead scoring analytics calculated successfully');
      return analytics;

    } catch (error) {
      console.error('❌ [AnalyticsService] Error getting lead scoring analytics:', error);
      throw error;
    }
  }

  /**
   * Get conversation analytics
   */
  static async getConversationAnalytics(dateRange: DateRange): Promise<ConversationAnalytics> {
    try {
      console.log('📊 [AnalyticsService] Getting conversation analytics for date range:', dateRange);

      const [
        totalConversations,
        conversationsByStatus,
        averageConversationLength,
        averageMessagesPerConversation,
        conversationsByDay,
        peakActivityHours
      ] = await Promise.all([
        this.getTotalConversations(dateRange),
        this.getConversationsByStatus(dateRange),
        this.getAverageConversationLength(dateRange),
        this.getAverageMessagesPerConversation(dateRange),
        this.getConversationsByDay(dateRange),
        this.getPeakActivityHours(dateRange)
      ]);

      const analytics: ConversationAnalytics = {
        totalConversations,
        conversationsByStatus,
        averageConversationLength,
        averageMessagesPerConversation,
        conversationsByDay,
        peakActivityHours
      };

      console.log('✅ [AnalyticsService] Conversation analytics calculated successfully');
      return analytics;

    } catch (error) {
      console.error('❌ [AnalyticsService] Error getting conversation analytics:', error);
      throw error;
    }
  }

  /**
   * Get system health metrics
   */
  static async getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
    try {
      console.log('📊 [AnalyticsService] Getting system health metrics');

      const [
        totalAccounts,
        activeAccounts,
        totalContacts,
        totalMessages,
        averageProcessingTime,
        errorRate,
        globalAgentConfig
      ] = await Promise.all([
        this.getTotalAccounts(),
        this.getActiveAccounts(),
        this.getTotalContacts(),
        this.getTotalMessages({ start: new Date(Date.now() - 24 * 60 * 60 * 1000), end: new Date() }),
        this.getAverageProcessingTime(),
        this.getErrorRate(),
        this.getGlobalAgentConfig()
      ]);

      const metrics: SystemHealthMetrics = {
        totalAccounts,
        activeAccounts,
        totalContacts,
        totalMessages,
        averageProcessingTime,
        errorRate,
        queueStatus: {
          pending: 0, // Will be implemented with queue system
          processing: 0,
          completed: 0,
          failed: 0
        },
        globalAgentConfig: {
          responseLimitsEnabled: globalAgentConfig?.systemSettings?.enableResponseLimits || false,
          leadScoreAutoDisableEnabled: globalAgentConfig?.systemSettings?.enableLeadScoreAutoDisable || false,
          milestoneAutoDisableEnabled: globalAgentConfig?.systemSettings?.enableMilestoneAutoDisable || false
        }
      };

      console.log('✅ [AnalyticsService] System health metrics calculated successfully');
      return metrics;

    } catch (error) {
      console.error('❌ [AnalyticsService] Error getting system health metrics:', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics
   */
  static async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    try {
      console.log('📊 [AnalyticsService] Getting real-time metrics');

      const [
        activeConversations,
        messagesLastHour,
        averageResponseTime,
        errorRate
      ] = await Promise.all([
        this.getActiveConversations(),
        this.getMessagesLastHour(),
        this.getAverageResponseTime({ start: new Date(Date.now() - 60 * 60 * 1000), end: new Date() }),
        this.getErrorRate()
      ]);

      const metrics: RealTimeMetrics = {
        activeConversations,
        messagesLastHour,
        averageResponseTime,
        systemUptime: process.uptime(),
        errorRate,
        queueStatus: {
          pending: 0, // Will be implemented with queue system
          processing: 0
        }
      };

      console.log('✅ [AnalyticsService] Real-time metrics calculated successfully');
      return metrics;

    } catch (error) {
      console.error('❌ [AnalyticsService] Error getting real-time metrics:', error);
      throw error;
    }
  }

  // Helper methods
  private static async getTotalConversations(dateRange: DateRange): Promise<number> {
    return await Conversation.countDocuments({
      'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end }
    });
  }

  private static async getActiveConversations(): Promise<number> {
    return await Conversation.countDocuments({
      status: 'active'
    });
  }

  private static async getAverageLeadScore(dateRange: DateRange): Promise<number> {
    const result = await Conversation.aggregate([
      {
        $match: {
          'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$leadScoring.currentScore' }
        }
      }
    ]);

    return result[0]?.averageScore || 0;
  }

  private static async getResponseSuccessRate(dateRange: DateRange): Promise<number> {
    const result = await Conversation.aggregate([
      {
        $match: {
          'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: null,
          totalResponses: { $sum: '$metrics.botMessages' },
          errorCount: { $sum: '$metrics.errorCount' }
        }
      }
    ]);

    const data = result[0];
    if (!data || data.totalResponses === 0) return 0;

    return Math.round(((data.totalResponses - data.errorCount) / data.totalResponses) * 100);
  }

  private static async getMilestoneAchievementRate(dateRange: DateRange): Promise<number> {
    const total = await Conversation.countDocuments({
      'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end }
    });

    const achieved = await Conversation.countDocuments({
      'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end },
      'milestone.status': 'achieved'
    });

    return total > 0 ? Math.round((achieved / total) * 100) : 0;
  }

  private static async getTotalMessages(dateRange: DateRange): Promise<number> {
    return await Message.countDocuments({
      timestamp: { $gte: dateRange.start, $lte: dateRange.end }
    });
  }

  private static async getAverageResponseTime(dateRange: DateRange): Promise<number> {
    const result = await Conversation.aggregate([
      {
        $match: {
          'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: null,
          averageResponseTime: { $avg: '$metrics.averageResponseTime' }
        }
      }
    ]);

    return result[0]?.averageResponseTime || 0;
  }

  private static async getAgentDisablementRate(dateRange: DateRange): Promise<number> {
    const total = await Conversation.countDocuments({
      'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end }
    });

    const disabled = await Conversation.countDocuments({
      'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end },
      'settings.aiEnabled': false
    });

    return total > 0 ? Math.round((disabled / total) * 100) : 0;
  }

  private static async getConversationsByStatus(dateRange: DateRange) {
    const result = await Conversation.aggregate([
      {
        $match: {
          'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = result.reduce((sum: number, item: any) => sum + item.count, 0);
    return result.map((item: any) => ({
      status: item._id,
      count: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
    }));
  }

  private static async getAverageConversationLength(dateRange: DateRange): Promise<number> {
    const result = await Conversation.aggregate([
      {
        $match: {
          'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: null,
          averageLength: { $avg: '$messageCount' }
        }
      }
    ]);

    return result[0]?.averageLength || 0;
  }

  private static async getAverageMessagesPerConversation(dateRange: DateRange): Promise<number> {
    const result = await Conversation.aggregate([
      {
        $match: {
          'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: null,
          averageMessages: { $avg: '$messageCount' }
        }
      }
    ]);

    return result[0]?.averageMessages || 0;
  }

  private static async getConversationsByDay(dateRange: DateRange) {
    const result = await Conversation.aggregate([
      {
        $match: {
          'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamps.createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return result.map((item: any) => ({
      date: item._id,
      count: item.count
    }));
  }

  private static async getPeakActivityHours(dateRange: DateRange) {
    const result = await Conversation.aggregate([
      {
        $match: {
          'timestamps.createdAt': { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: {
            $hour: '$timestamps.createdAt'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    return result.map((item: any) => ({
      hour: item._id,
      count: item.count
    }));
  }

  private static async getTotalAccounts(): Promise<number> {
    return await InstagramAccount.countDocuments();
  }

  private static async getActiveAccounts(): Promise<number> {
    return await InstagramAccount.countDocuments({ isActive: true });
  }

  private static async getTotalContacts(): Promise<number> {
    return await Contact.countDocuments();
  }

  private static async getAverageProcessingTime(): Promise<number> {
    const result = await Conversation.aggregate([
      {
        $group: {
          _id: null,
          averageProcessingTime: { $avg: '$metrics.averageResponseTime' }
        }
      }
    ]);

    return result[0]?.averageProcessingTime || 0;
  }

  private static async getErrorRate(): Promise<number> {
    const result = await Conversation.aggregate([
      {
        $group: {
          _id: null,
          totalResponses: { $sum: '$metrics.botMessages' },
          errorCount: { $sum: '$metrics.errorCount' }
        }
      }
    ]);

    const data = result[0];
    if (!data || data.totalResponses === 0) return 0;

    return Math.round((data.errorCount / data.totalResponses) * 100);
  }

  private static async getGlobalAgentConfig(): Promise<IGlobalAgentConfig | null> {
    return await GlobalAgentConfig.findOne();
  }

  private static async getMessagesLastHour(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return await Message.countDocuments({
      timestamp: { $gte: oneHourAgo }
    });
  }

  private static getStepName(score: number): string {
    const steps = {
      1: 'Contact Received',
      2: 'Answers 1 Question',
      3: 'Confirms Interest',
      4: 'Milestone Met',
      5: 'Reminder Sent',
      6: 'Reminder Answered',
      7: 'Sales Done'
    };
    return steps[score as keyof typeof steps] || 'Unknown';
  }
}
