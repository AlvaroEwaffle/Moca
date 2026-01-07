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
    
    // Log the configuration being used
    console.log('🔍 [Global Agent Rules] Evaluating agent disable rules:', {
      conversationId: conversation.id,
      config: {
        enableResponseLimits: globalConfig.systemSettings.enableResponseLimits,
        enableLeadScoreAutoDisable: globalConfig.systemSettings.enableLeadScoreAutoDisable,
        enableMilestoneAutoDisable: globalConfig.systemSettings.enableMilestoneAutoDisable,
        autoDisableOnScore: globalConfig.leadScoring.autoDisableOnScore,
        autoDisableOnMilestone: globalConfig.leadScoring.autoDisableOnMilestone
      }
    });
    
    // Check response limit rule
    if (globalConfig.systemSettings.enableResponseLimits) {
      const responseLimitResult = this.checkResponseLimit(conversation, globalConfig);
      if (responseLimitResult.shouldDisable) {
        console.log('🚫 [Global Agent Rules] Agent disabled by response limit rule');
        return responseLimitResult;
      }
    }
    
    // Check lead score rule
    // Note: checkLeadScoreRule now validates enableLeadScoreAutoDisable internally
    const leadScoreResult = this.checkLeadScoreRule(conversation, globalConfig);
    if (leadScoreResult.shouldDisable) {
      console.log('🚫 [Global Agent Rules] Agent disabled by lead score rule');
      return leadScoreResult;
    }
    
    // Check milestone rule
    // Note: checkMilestoneRule now validates enableMilestoneAutoDisable internally
    const milestoneResult = this.checkMilestoneRule(conversation, globalConfig);
    if (milestoneResult.shouldDisable) {
      console.log('🚫 [Global Agent Rules] Agent disabled by milestone rule');
      return milestoneResult;
    }
    
    console.log('✅ [Global Agent Rules] All rules passed, agent will continue');
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
    
    // CRITICAL: If enableLeadScoreAutoDisable is false, do NOT evaluate
    // This setting must take precedence over autoDisableOnScore
    if (!globalConfig.systemSettings.enableLeadScoreAutoDisable) {
      console.log('🔍 [Global Agent Rules] Lead score auto-disable is disabled, skipping check');
      return { shouldDisable: false };
    }
    
    const autoDisableScore = globalConfig.leadScoring.autoDisableOnScore;
    
    // If autoDisableOnScore is undefined/null/0, do NOT disable
    if (!autoDisableScore || autoDisableScore < 1 || autoDisableScore > 7) {
      console.log('🔍 [Global Agent Rules] Auto-disable score not set or invalid, skipping check');
      return { shouldDisable: false };
    }
    
    const currentScore = conversation.leadScoring?.currentScore || 1;
    
    // Log detailed information for debugging
    console.log('🔍 [Global Agent Rules] Checking lead score rule:', {
      conversationId: conversation.id,
      currentScore,
      autoDisableScore,
      thresholdMet: currentScore >= autoDisableScore,
      currentStepName: LEAD_SCORING_STEPS[currentScore as keyof typeof LEAD_SCORING_STEPS]?.name || 'Unknown'
    });
    
    if (currentScore >= autoDisableScore) {
      const stepInfo = LEAD_SCORING_STEPS[currentScore as keyof typeof LEAD_SCORING_STEPS];
      console.log('🚫 [Global Agent Rules] Lead score threshold exceeded:', {
        currentScore,
        threshold: autoDisableScore,
        stepName: stepInfo?.name || 'Unknown'
      });
      return {
        shouldDisable: true,
        reason: `Lead score milestone reached (${currentScore}/7: ${stepInfo?.name})`,
        ruleType: 'lead_score'
      };
    }
    
    console.log('✅ [Global Agent Rules] Lead score below threshold, agent will continue');
    return { shouldDisable: false };
  }
  
  /**
   * Check milestone rule
   */
  private static checkMilestoneRule(
    conversation: IConversation,
    globalConfig: IGlobalAgentConfig
  ): { shouldDisable: boolean; reason?: string; ruleType?: 'milestone' } {
    
    // CRITICAL: If enableMilestoneAutoDisable is false, do NOT evaluate
    // This setting must take precedence over autoDisableOnMilestone
    if (!globalConfig.systemSettings.enableMilestoneAutoDisable) {
      console.log('🔍 [Global Agent Rules] Milestone auto-disable is disabled, skipping check');
      return { shouldDisable: false };
    }
    
    // Also check the legacy autoDisableOnMilestone flag for backwards compatibility
    if (!globalConfig.leadScoring.autoDisableOnMilestone) {
      console.log('🔍 [Global Agent Rules] Auto-disable on milestone setting is false, skipping check');
      return { shouldDisable: false };
    }
    
    const milestone = conversation.milestone;
    
    // Log detailed information for debugging
    console.log('🔍 [Global Agent Rules] Checking milestone rule:', {
      conversationId: conversation.id,
      milestoneTarget: milestone?.target || 'none',
      milestoneStatus: milestone?.status || 'none',
      autoDisableAgent: milestone?.autoDisableAgent || false
    });
    
    if (milestone && milestone.status === 'achieved' && milestone.autoDisableAgent) {
      console.log('🚫 [Global Agent Rules] Milestone achieved and auto-disable enabled:', {
        milestoneTarget: milestone.target,
        milestoneStatus: milestone.status
      });
      return {
        shouldDisable: true,
        reason: `Conversation milestone achieved: ${milestone.target}`,
        ruleType: 'milestone'
      };
    }
    
    console.log('✅ [Global Agent Rules] Milestone rule check passed, agent will continue');
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
