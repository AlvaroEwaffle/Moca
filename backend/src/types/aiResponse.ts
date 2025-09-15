/**
 * TypeScript interfaces for structured AI responses
 */

export interface StructuredResponse {
  responseText: string; // Actual response to customer
  leadScore: number; // Customer interest level (1-7)
  intent: string; // Customer's apparent intent
  nextAction: string; // Recommended next step
  confidence: number; // Confidence in assessment (0-1)
  metadata: ResponseMetadata; // Essential response metadata
}

export interface ResponseMetadata {
  greetingUsed: boolean;
  previousContextReferenced: boolean;
  businessNameUsed: string;
  repetitionDetected?: boolean;
  contextType?: 'greeting' | 'continuation' | 'question' | 'closing';
  leadProgression?: 'increased' | 'decreased' | 'maintained';
}

export interface LeadScoringData {
  currentScore: number;
  previousScore?: number;
  progression: 'increased' | 'decreased' | 'maintained';
  reasons: string[];
  confidence: number;
  stepName?: string;
  stepDescription?: string;
}

export interface ConversationContext {
  businessName: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  lastMessage: string;
  timeSinceLastMessage: number; // minutes
  repetitionPatterns: string[];
  leadHistory: number[];
}

export interface AIResponseConfig {
  useStructuredResponse: boolean;
  enableLeadScoring: boolean;
  enableRepetitionPrevention: boolean;
  enableContextAwareness: boolean;
  customInstructions?: string;
  businessContext?: {
    company: string;
    sector: string;
    services: string[];
  };
}

// Lead scoring constants - Updated to 7-step scale
export const LEAD_SCORES = {
  CONTACT_RECEIVED: 1,
  ANSWERS_1_QUESTION: 2,
  CONFIRMS_INTEREST: 3,
  MILESTONE_MET: 4,
  REMINDER_SENT: 5,
  REMINDER_ANSWERED: 6,
  SALES_DONE: 7
} as const;

// Lead scoring step definitions
export const LEAD_SCORING_STEPS = {
  1: { name: 'Contact Received', description: 'Initial contact from customer' },
  2: { name: 'Answers 1 Question', description: 'Customer responds to first question' },
  3: { name: 'Confirms Interest', description: 'Customer shows clear interest' },
  4: { name: 'Milestone Met', description: 'Specific milestone achieved' },
  5: { name: 'Reminder Sent', description: 'Follow-up reminder sent' },
  6: { name: 'Reminder Answered', description: 'Customer responds to reminder' },
  7: { name: 'Sales Done', description: 'Sale completed successfully' }
} as const;

// Intent types
export const INTENT_TYPES = {
  GREETING: 'greeting',
  INQUIRY: 'inquiry',
  COMPLAINT: 'complaint',
  PURCHASE_INTEREST: 'purchase_interest',
  INFORMATION_REQUEST: 'information_request',
  DEMO_REQUEST: 'demo_request',
  PRICING_INQUIRY: 'pricing_inquiry',
  TECHNICAL_SUPPORT: 'technical_support',
  GENERAL_QUESTION: 'general_question'
} as const;

// Next action types
export const NEXT_ACTIONS = {
  PROVIDE_DETAILS: 'provide_details',
  SCHEDULE_DEMO: 'schedule_demo',
  SEND_PROPOSAL: 'send_proposal',
  ESCALATE_TO_HUMAN: 'escalate_to_human',
  FOLLOW_UP: 'follow_up',
  CLOSE_CONVERSATION: 'close_conversation',
  ASK_QUALIFYING_QUESTIONS: 'ask_qualifying_questions',
  SEND_INFORMATION: 'send_information'
} as const;

// Validation functions
export function validateStructuredResponse(response: any): response is StructuredResponse {
  return (
    typeof response === 'object' &&
    typeof response.responseText === 'string' &&
    response.responseText.length > 0 &&
    typeof response.leadScore === 'number' &&
    response.leadScore >= 1 && response.leadScore <= 7 &&
    typeof response.intent === 'string' &&
    typeof response.nextAction === 'string' &&
    typeof response.confidence === 'number' &&
    response.confidence >= 0 && response.confidence <= 1 &&
    typeof response.metadata === 'object' &&
    typeof response.metadata.greetingUsed === 'boolean' &&
    typeof response.metadata.previousContextReferenced === 'boolean' &&
    typeof response.metadata.businessNameUsed === 'string'
  );
}

export function createDefaultResponse(): StructuredResponse {
  return {
    responseText: "Gracias por tu mensaje. Un miembro de nuestro equipo te responderá pronto.",
    leadScore: 1,
    intent: 'greeting',
    nextAction: 'follow_up',
    confidence: 0.5,
    metadata: {
      greetingUsed: false,
      previousContextReferenced: false,
      businessNameUsed: 'Business'
    }
  };
}
