/**
 * Global Agent Rules Service for Moca Instagram DM Agent
 * 
 * Handles global agent configuration rules including:
 * - Response limits per conversation
 * - Lead score-based auto-disable
 * - Milestone-based auto-disable
 */

import { IConversation } from '../models/conversation.model';
import { IGlobalAgentConfig } from '../models/globalAgentConfig.model';
import { LEAD_SCORING_STEPS } from '../types/aiResponse';

export class GlobalAgentRulesService {
  
  /**
   * Check if agent should be disabled based on global rules
   */
  static async shouldDisableAgent(
    conversation: IConversation,
    globalConfig: IGlobalAgentConfig
  ): Promise<{
    shouldDisable: boolean;
    reason?: string;
    ruleType?: 'response_limit' | 'lead_score' | 'milestone';
  }> {
    
    // Check response limit rule
    if (globalConfig.systemSettings.enableResponseLimits) {
      const responseLimitResult = this.checkResponseLimit(conversation, globalConfig);
      if (responseLimitResult.shouldDisable) {
        return responseLimitResult;
      }
    }
    
    // Check lead score rule
    if (globalConfig.systemSettings.enableLeadScoreAutoDisable) {
      const leadScoreResult = this.checkLeadScoreRule(conversation, globalConfig);
      if (leadScoreResult.shouldDisable) {
        return leadScoreResult;
      }
    }
    
    // Check milestone rule
    if (globalConfig.systemSettings.enableMilestoneAutoDisable) {
      const milestoneResult = this.checkMilestoneRule(conversation, globalConfig);
      if (milestoneResult.shouldDisable) {
        return milestoneResult;
      }
    }
    
    return { shouldDisable: false };
  }
  
  /**
   * Check response limit rule
   */
  private static checkResponseLimit(
    conversation: IConversation,
    globalConfig: IGlobalAgentConfig
  ): { shouldDisable: boolean; reason?: string; ruleType?: 'response_limit' } {
    
    const maxResponses = globalConfig.responseLimits.maxResponsesPerConversation;
    const currentResponses = conversation.settings?.responseCounter?.totalResponses || 0;
    
    if (currentResponses >= maxResponses) {
      return {
        shouldDisable: true,
        reason: `Response limit reached (${currentResponses}/${maxResponses})`,
        ruleType: 'response_limit'
      };
    }
    
    return { shouldDisable: false };
  }
  
  /**
   * Check lead score rule
   */
  private static checkLeadScoreRule(
    conversation: IConversation,
    globalConfig: IGlobalAgentConfig
  ): { shouldDisable: boolean; reason?: string; ruleType?: 'lead_score' } {
    
    const autoDisableScore = globalConfig.leadScoring.autoDisableOnScore;
    if (!autoDisableScore) {
      return { shouldDisable: false };
    }
    
    const currentScore = conversation.leadScoring?.currentScore || 1;
    
    if (currentScore >= autoDisableScore) {
      const stepInfo = LEAD_SCORING_STEPS[currentScore as keyof typeof LEAD_SCORING_STEPS];
      return {
        shouldDisable: true,
        reason: `Lead score milestone reached (${currentScore}/7: ${stepInfo?.name})`,
        ruleType: 'lead_score'
      };
    }
    
    return { shouldDisable: false };
  }
  
  /**
   * Check milestone rule
   */
  private static checkMilestoneRule(
    conversation: IConversation,
    globalConfig: IGlobalAgentConfig
  ): { shouldDisable: boolean; reason?: string; ruleType?: 'milestone' } {
    
    if (!globalConfig.leadScoring.autoDisableOnMilestone) {
      return { shouldDisable: false };
    }
    
    const milestone = conversation.milestone;
    if (milestone && milestone.status === 'achieved' && milestone.autoDisableAgent) {
      return {
        shouldDisable: true,
        reason: `Conversation milestone achieved: ${milestone.target}`,
        ruleType: 'milestone'
      };
    }
    
    return { shouldDisable: false };
  }
  
  /**
   * Increment response counter for a conversation
   */
  static async incrementResponseCounter(conversation: IConversation): Promise<void> {
    if (!conversation.settings) {
      conversation.settings = {
        // autoRespond removed from simplified model
        aiEnabled: true,
        // priority removed from simplified model
        // tags removed from simplified model
        // notes removed from simplified model
        // followUpRequired removed from simplified model
        // businessHoursOnly removed from simplified model
        responseCounter: {
          totalResponses: 0,
          lastResetAt: new Date(),
          disabledByResponseLimit: false,
          disabledByLeadScore: false,
          disabledByMilestone: false
        }
      };
    }
    
    if (!conversation.settings.responseCounter) {
      conversation.settings.responseCounter = {
        totalResponses: 0,
        lastResetAt: new Date(),
        disabledByResponseLimit: false,
        disabledByLeadScore: false,
        disabledByMilestone: false
      };
    }
    
    conversation.settings.responseCounter.totalResponses += 1;
    conversation.settings.responseCounter.lastResetAt = new Date();
  }
  
  /**
   * Reset response counter for a conversation
   */
  static async resetResponseCounter(conversation: IConversation): Promise<void> {
    if (!conversation.settings) {
      conversation.settings = {
        // autoRespond removed from simplified model
        aiEnabled: true,
        // priority removed from simplified model
        // tags removed from simplified model
        // notes removed from simplified model
        // followUpRequired removed from simplified model
        // businessHoursOnly removed from simplified model
        responseCounter: {
          totalResponses: 0,
          lastResetAt: new Date(),
          disabledByResponseLimit: false,
          disabledByLeadScore: false,
          disabledByMilestone: false
        }
      };
    }
    
    if (!conversation.settings.responseCounter) {
      conversation.settings.responseCounter = {
        totalResponses: 0,
        lastResetAt: new Date(),
        disabledByResponseLimit: false,
        disabledByLeadScore: false,
        disabledByMilestone: false
      };
    }
    
    conversation.settings.responseCounter.totalResponses = 0;
    conversation.settings.responseCounter.lastResetAt = new Date();
    conversation.settings.responseCounter.disabledByResponseLimit = false;
    conversation.settings.responseCounter.disabledByLeadScore = false;
    conversation.settings.responseCounter.disabledByMilestone = false;
  }
  
  /**
   * Mark conversation as disabled by specific rule
   */
  static async markDisabledByRule(
    conversation: IConversation,
    ruleType: 'response_limit' | 'lead_score' | 'milestone'
  ): Promise<void> {
    if (!conversation.settings) {
      conversation.settings = {
        // autoRespond removed from simplified model
        aiEnabled: true,
        // priority removed from simplified model
        // tags removed from simplified model
        // notes removed from simplified model
        // followUpRequired removed from simplified model
        // businessHoursOnly removed from simplified model
        responseCounter: {
          totalResponses: 0,
          lastResetAt: new Date(),
          disabledByResponseLimit: false,
          disabledByLeadScore: false,
          disabledByMilestone: false
        }
      };
    }
    
    if (!conversation.settings.responseCounter) {
      conversation.settings.responseCounter = {
        totalResponses: 0,
        lastResetAt: new Date(),
        disabledByResponseLimit: false,
        disabledByLeadScore: false,
        disabledByMilestone: false
      };
    }
    
    // Disable AI
    conversation.settings.aiEnabled = false;
    
    // Mark the specific rule that caused the disable
    switch (ruleType) {
      case 'response_limit':
        conversation.settings.responseCounter.disabledByResponseLimit = true;
        break;
      case 'lead_score':
        conversation.settings.responseCounter.disabledByLeadScore = true;
        break;
      case 'milestone':
        conversation.settings.responseCounter.disabledByMilestone = true;
        break;
    }
  }
  
  /**
   * Get global agent configuration
   */
  static async getGlobalConfig(): Promise<IGlobalAgentConfig | null> {
    const GlobalAgentConfig = (await import('../models/globalAgentConfig.model')).default;
    return await GlobalAgentConfig.findOne();
  }
  
  /**
   * Log agent decision for debugging
   */
  static logAgentDecision(
    conversationId: string,
    decision: string,
    details: any
  ): void {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_AGENT_DECISIONS === 'true') {
      console.log(`🤖 [Agent Decision] Conversation ${conversationId}: ${decision}`, details);
    }
  }
}
