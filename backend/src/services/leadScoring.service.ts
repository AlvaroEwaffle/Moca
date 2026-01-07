/**
 * Lead Scoring Service for Moca Instagram DM Agent
 * 
 * Analyzes customer messages and conversation context to determine
 * lead progression and interest levels.
 */

import { 
  StructuredResponse, 
  LeadScoringData, 
  ConversationContext,
  LEAD_SCORES,
  LEAD_SCORING_STEPS,
  INTENT_TYPES,
  NEXT_ACTIONS
} from '../types/aiResponse';
import { GENERIC_AI_INSTRUCTIONS } from '../templates/aiInstructions';

export class LeadScoringService {
  
  /**
   * Get maximum allowed lead score based on milestone target and status
   * This ensures that scores cannot exceed the milestone step until the milestone is achieved
   */
  static getMaxAllowedLeadScore(
    milestoneTarget?: 'link_shared' | 'meeting_scheduled' | 'demo_booked' | 'custom',
    milestoneStatus?: 'pending' | 'achieved' | 'failed'
  ): number {
    // If milestone is achieved or failed, no restriction
    if (milestoneStatus === 'achieved' || milestoneStatus === 'failed') {
      return 7; // Maximum score allowed
    }
    
    // If no milestone target is set, no restriction
    if (!milestoneTarget) {
      return 7; // Maximum score allowed
    }
    
    // If milestone is pending, limit score to step 4 (Milestone Met)
    // All milestone targets (link_shared, meeting_scheduled, demo_booked) correspond to step 4
    // The lead cannot progress beyond step 4 until the milestone is achieved
    if (milestoneStatus === 'pending') {
      return 4; // Maximum score until milestone is achieved
    }
    
    // Default: no restriction
    return 7;
  }
  
  /**
   * Map old 1-10 scale to new 1-7 scale
   */
  private static mapToSevenStepScale(oldScore: number): number {
    if (oldScore <= 1) return 1; // Contact Received
    if (oldScore <= 2) return 2; // Answers 1 Question
    if (oldScore <= 3) return 3; // Confirms Interest
    if (oldScore <= 4) return 4; // Milestone Met
    if (oldScore <= 6) return 5; // Reminder Sent
    if (oldScore <= 8) return 6; // Reminder Answered
    return 7; // Sales Done
  }
  
  /**
   * Calculate lead score based on message content and context
   */
  static calculateLeadScore(
    message: string, 
    conversationContext: ConversationContext
  ): LeadScoringData {
    const lowerMessage = message.toLowerCase();
    let maxScore = 1;
    const reasons: string[] = [];
    
    // Check against lead scoring rules (updated for 7-step scale)
    for (const rule of GENERIC_AI_INSTRUCTIONS.leadScoringRules) {
      const hasKeyword = rule.keywords.some(keyword => lowerMessage.includes(keyword));
      const hasPattern = this.checkPatterns(message, rule.patterns);
      
      if (hasKeyword || hasPattern) {
        // Map old 1-10 scale to new 1-7 scale
        const mappedScore = this.mapToSevenStepScale(rule.score);
        if (mappedScore > maxScore) {
          maxScore = mappedScore;
          reasons.push(rule.description);
        }
      }
    }
    
    // Check for additional indicators
    const additionalScore = this.checkAdditionalIndicators(message, conversationContext);
    const mappedAdditionalScore = this.mapToSevenStepScale(additionalScore);
    if (mappedAdditionalScore > maxScore) {
      maxScore = mappedAdditionalScore;
      reasons.push('Additional context indicators detected');
    }
    
    // CRITICAL: Limit score based on milestone target and status
    // If milestone is pending, score cannot exceed step 4 until milestone is achieved
    const maxAllowedScore = this.getMaxAllowedLeadScore(
      conversationContext.milestoneTarget,
      conversationContext.milestoneStatus
    );
    
    if (maxScore > maxAllowedScore) {
      console.log(`⚠️ [Lead Scoring] Score ${maxScore} exceeds maximum allowed (${maxAllowedScore}) based on milestone. Limiting to ${maxAllowedScore}.`, {
        milestoneTarget: conversationContext.milestoneTarget,
        milestoneStatus: conversationContext.milestoneStatus,
        originalScore: maxScore,
        limitedScore: maxAllowedScore
      });
      reasons.push(`Score limited to ${maxAllowedScore} (milestone: ${conversationContext.milestoneTarget} - ${conversationContext.milestoneStatus})`);
      maxScore = maxAllowedScore;
    }
    
    // SPECIAL RULE: Score 5 (Reminder Sent) should only be assigned when a reminder is actually sent
    // This score represents an action by the agent, not just keywords in the message
    if (maxScore === 5) {
      // TODO: Check if a reminder was actually sent in the conversation history
      // For now, we'll limit it to 4 if milestone is pending
      if (conversationContext.milestoneStatus === 'pending' && maxAllowedScore <= 4) {
        console.log(`⚠️ [Lead Scoring] Score 5 (Reminder Sent) not allowed - milestone pending and no reminder sent. Limiting to 4.`);
        maxScore = 4;
        reasons.push('Score 5 (Reminder Sent) requires milestone achievement or actual reminder sent');
      }
    }
    
    // Calculate progression
    const previousScore = conversationContext.leadHistory[conversationContext.leadHistory.length - 1] || 1;
    const progression = this.calculateProgression(maxScore, previousScore);
    
    // Calculate confidence based on clarity of indicators
    const confidence = this.calculateConfidence(message, reasons.length, conversationContext);
    
    // Get step information
    const stepInfo = LEAD_SCORING_STEPS[maxScore as keyof typeof LEAD_SCORING_STEPS];
    
    return {
      currentScore: maxScore,
      previousScore,
      progression,
      reasons,
      confidence,
      stepName: stepInfo?.name || 'Contact Received',
      stepDescription: stepInfo?.description || 'Initial contact from customer'
    };
  }
  
  /**
   * Determine customer intent from message content
   */
  static determineIntent(message: string, conversationContext: ConversationContext): string {
    const lowerMessage = message.toLowerCase();
    
    // Check for specific intent patterns
    if (this.isGreeting(lowerMessage)) return INTENT_TYPES.GREETING;
    if (this.isComplaint(lowerMessage)) return INTENT_TYPES.COMPLAINT;
    if (this.isPurchaseInterest(lowerMessage)) return INTENT_TYPES.PURCHASE_INTEREST;
    if (this.isInformationRequest(lowerMessage)) return INTENT_TYPES.INFORMATION_REQUEST;
    if (this.isDemoRequest(lowerMessage)) return INTENT_TYPES.DEMO_REQUEST;
    if (this.isPricingInquiry(lowerMessage)) return INTENT_TYPES.PRICING_INQUIRY;
    if (this.isTechnicalSupport(lowerMessage)) return INTENT_TYPES.TECHNICAL_SUPPORT;
    if (this.isQuestion(lowerMessage)) return INTENT_TYPES.GENERAL_QUESTION;
    
    return INTENT_TYPES.INQUIRY;
  }
  
  /**
   * Determine recommended next action based on lead score and intent
   */
  static determineNextAction(
    leadScore: number, 
    intent: string, 
    conversationContext: ConversationContext
  ): string {
    // High-value leads (7-10)
    if (leadScore >= 7) {
      if (intent === INTENT_TYPES.DEMO_REQUEST) return NEXT_ACTIONS.SCHEDULE_DEMO;
      if (intent === INTENT_TYPES.PRICING_INQUIRY) return NEXT_ACTIONS.SEND_PROPOSAL;
      return NEXT_ACTIONS.ESCALATE_TO_HUMAN;
    }
    
    // Medium-value leads (4-6)
    if (leadScore >= 4) {
      if (intent === INTENT_TYPES.INFORMATION_REQUEST) return NEXT_ACTIONS.PROVIDE_DETAILS;
      if (intent === INTENT_TYPES.PURCHASE_INTEREST) return NEXT_ACTIONS.ASK_QUALIFYING_QUESTIONS;
      return NEXT_ACTIONS.SEND_INFORMATION;
    }
    
    // Low-value leads (1-3)
    if (intent === INTENT_TYPES.GREETING) return NEXT_ACTIONS.ASK_QUALIFYING_QUESTIONS;
    if (intent === INTENT_TYPES.COMPLAINT) return NEXT_ACTIONS.ESCALATE_TO_HUMAN;
    
    return NEXT_ACTIONS.FOLLOW_UP;
  }
  
  /**
   * Analyze conversation for lead progression trends
   */
  static analyzeLeadProgression(conversationContext: ConversationContext): {
    trend: 'improving' | 'declining' | 'stable';
    averageScore: number;
    peakScore: number;
    progressionRate: number;
  } {
    const scores = conversationContext.leadHistory;
    if (scores.length < 2) {
      return {
        trend: 'stable',
        averageScore: scores[0] || 1,
        peakScore: scores[0] || 1,
        progressionRate: 0
      };
    }
    
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const peakScore = Math.max(...scores);
    
    // Calculate trend based on recent scores
    const recentScores = scores.slice(-3); // Last 3 scores
    const trend = this.calculateTrend(recentScores);
    
    // Calculate progression rate
    const progressionRate = this.calculateProgressionRate(scores);
    
    return {
      trend,
      averageScore,
      peakScore,
      progressionRate
    };
  }
  
  /**
   * Check for repetition patterns in conversation
   */
  static detectRepetition(conversationContext: ConversationContext): string[] {
    const patterns: string[] = [];
    const assistantMessages = conversationContext.conversationHistory
      .filter(msg => msg.role === 'assistant')
      .map(msg => msg.content);
    
    if (assistantMessages.length < 2) return patterns;
    
    // Check for repeated greetings
    const greetings = assistantMessages.map(msg => 
      msg.toLowerCase().match(/^(hola|hello|hi|buenos días|buenas tardes)/)?.[0]
    ).filter(Boolean);
    
    if (greetings.length > 1) {
      patterns.push('repeated_greetings');
    }
    
    // Check for repeated business introductions
    const businessIntros = assistantMessages.filter(msg => 
      msg.toLowerCase().includes('ofrecemos') || 
      msg.toLowerCase().includes('we offer') ||
      msg.toLowerCase().includes('nuestro servicio')
    ).length;
    
    if (businessIntros > 1) {
      patterns.push('repeated_business_intro');
    }
    
    // Check for repeated question patterns
    const questionPatterns = assistantMessages.filter(msg => 
      msg.includes('¿') || msg.includes('?')
    ).length;
    
    if (questionPatterns > 2) {
      patterns.push('excessive_questions');
    }
    
    return patterns;
  }
  
  // Private helper methods
  
  private static checkPatterns(message: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      switch (pattern) {
        case 'initial_greeting':
          return /^(hola|hello|hi|buenos días|buenas tardes)/i.test(message);
        case 'question_asking':
          return /[¿?]/.test(message);
        case 'product_inquiry':
          return /(servicio|service|producto|product|precio|price)/i.test(message);
        case 'information_request':
          return /(información|information|detalles|details|más|more)/i.test(message);
        case 'demo_request':
          return /(demo|demostración|reunión|meeting|llamada|call)/i.test(message);
        case 'scheduling':
          return /(agenda|schedule|cita|appointment|disponible|available)/i.test(message);
        case 'proposal_request':
          return /(propuesta|proposal|cotización|quote|presupuesto|budget)/i.test(message);
        case 'negotiation':
          return /(negociar|negotiate|descuento|discount|oferta especial|special offer)/i.test(message);
        case 'contract_ready':
          return /(contrato|contract|firmar|sign|acepto|accept|proceder|proceed)/i.test(message);
        default:
          return false;
      }
    });
  }
  
  private static checkAdditionalIndicators(
    message: string, 
    context: ConversationContext
  ): number {
    let additionalScore = 0;
    
    // Check for urgency indicators
    if (/(urgente|urgent|asap|rápido|quick|inmediato|immediate)/i.test(message)) {
      additionalScore += 2;
    }
    
    // Check for budget indicators
    if (/(presupuesto|budget|dinero|money|inversión|investment)/i.test(message)) {
      additionalScore += 1;
    }
    
    // Check for timeline indicators
    if (/(cuándo|when|fecha|date|tiempo|time|plazo|deadline)/i.test(message)) {
      additionalScore += 1;
    }
    
    // Check for decision maker indicators
    if (/(decisión|decision|autorizar|authorize|aprobación|approval)/i.test(message)) {
      additionalScore += 2;
    }
    
    return Math.min(additionalScore, 10);
  }
  
  private static calculateProgression(current: number, previous: number): 'increased' | 'decreased' | 'maintained' {
    if (current > previous) return 'increased';
    if (current < previous) return 'decreased';
    return 'maintained';
  }
  
  private static calculateConfidence(
    message: string, 
    indicatorCount: number, 
    context: ConversationContext
  ): number {
    let confidence = 0.5; // Base confidence
    
    // More indicators = higher confidence
    confidence += Math.min(indicatorCount * 0.1, 0.3);
    
    // Longer messages = higher confidence
    if (message.length > 50) confidence += 0.1;
    if (message.length > 100) confidence += 0.1;
    
    // More conversation history = higher confidence
    if (context.conversationHistory.length > 3) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }
  
  private static calculateTrend(scores: number[]): 'improving' | 'declining' | 'stable' {
    if (scores.length < 2) return 'stable';
    
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg + 0.5) return 'improving';
    if (secondAvg < firstAvg - 0.5) return 'declining';
    return 'stable';
  }
  
  private static calculateProgressionRate(scores: number[]): number {
    if (scores.length < 2) return 0;
    
    const improvements = scores.slice(1).filter((score, index) => score > scores[index]).length;
    return improvements / (scores.length - 1);
  }
  
  // Intent detection methods
  
  private static isGreeting(message: string): boolean {
    return /^(hola|hello|hi|buenos días|buenas tardes|hey|buenas noches)/i.test(message);
  }
  
  private static isComplaint(message: string): boolean {
    return /(problema|problem|queja|complaint|malo|bad|error|falla|issue)/i.test(message);
  }
  
  private static isPurchaseInterest(message: string): boolean {
    return /(comprar|buy|adquirir|purchase|contratar|hire|servicio|service|producto|product)/i.test(message);
  }
  
  private static isInformationRequest(message: string): boolean {
    return /(información|information|detalles|details|más|more|saber|know|entender|understand)/i.test(message);
  }
  
  private static isDemoRequest(message: string): boolean {
    return /(demo|demostración|reunión|meeting|llamada|call|videollamada|videocall)/i.test(message);
  }
  
  private static isPricingInquiry(message: string): boolean {
    return /(precio|price|costo|cost|cuánto|how much|tarifa|rate|presupuesto|budget)/i.test(message);
  }
  
  private static isTechnicalSupport(message: string): boolean {
    return /(soporte|support|técnico|technical|ayuda|help|problema|problem|error)/i.test(message);
  }
  
  private static isQuestion(message: string): boolean {
    return /[¿?]/.test(message);
  }
}
