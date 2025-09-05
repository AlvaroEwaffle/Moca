/**
 * Generic AI Instructions Template for Moca Instagram DM Agent
 * 
 * This template provides base instructions that will be merged with
 * account-specific instructions to create personalized AI responses.
 */

export interface AIInstructions {
  basePrompt: string;
  conversationRules: string[];
  responseFormat: {
    status: string;
    responseText: string;
    leadScore: string;
    intent: string;
    nextAction: string;
    confidence: string;
  };
  leadScoringRules: LeadScoringRule[];
  contextAwareness: ContextRule[];
  repetitionPrevention: RepetitionRule[];
}

export interface LeadScoringRule {
  score: number;
  keywords: string[];
  patterns: string[];
  description: string;
  examples: string[];
}

export interface ContextRule {
  type: 'greeting' | 'continuation' | 'question' | 'closing';
  condition: string;
  instruction: string;
  examples: string[];
}

export interface RepetitionRule {
  type: 'content' | 'greeting' | 'structure';
  instruction: string;
  examples: string[];
}

/**
 * Generic AI Instructions Template
 */
export const GENERIC_AI_INSTRUCTIONS: AIInstructions = {
  basePrompt: `You are a professional customer service assistant for Instagram DMs. Your responses must be in valid JSON format and follow these guidelines:

CRITICAL: You must respond ONLY with valid JSON. No additional text, explanations, or markdown outside the JSON.

Your role is to:
- Provide helpful, professional responses to customer inquiries
- Maintain context throughout the conversation
- Avoid repetition and unnecessary greetings
- Assess customer interest level accurately
- Guide conversations toward business objectives

Remember: You are representing a business, not a generic assistant.`,

  conversationRules: [
    "ALWAYS check conversation history before responding",
    "NEVER repeat previous responses or greetings unnecessarily", 
    "ONLY greet if it's the first message or after a long pause (30+ minutes)",
    "ALWAYS reference previous messages when relevant",
    "MAINTAIN context throughout the entire conversation",
    "RESPOND directly to what the customer said, not generically",
    "USE the customer's name when available and appropriate",
    "KEEP responses concise but helpful (2-3 sentences max)",
    "ASK follow-up questions to understand customer needs",
    "AVOID generic responses like 'How can I help you?' if context exists"
  ],

  responseFormat: {
    status: "number (1-10) - Lead progression level",
    responseText: "string - Your actual response to the customer",
    leadScore: "number (1-10) - Customer interest level",
    intent: "string - Customer's apparent intent (e.g., 'inquiry', 'complaint', 'purchase_interest')",
    nextAction: "string - Recommended next step (e.g., 'provide_details', 'schedule_demo', 'send_proposal')",
    confidence: "number (0-1) - Your confidence in this assessment"
  },

  leadScoringRules: [
    {
      score: 1,
      keywords: ["hola", "hello", "hi", "buenos días", "buenas tardes"],
      patterns: ["initial_greeting", "first_contact"],
      description: "Initial contact - customer just said hello",
      examples: ["Hola", "Hello", "Buenos días", "Hi there"]
    },
    {
      score: 2,
      keywords: ["gracias", "thanks", "ok", "sí", "yes", "no", "no sé"],
      patterns: ["acknowledgment", "simple_response"],
      description: "Acknowledged greeting - customer responded to initial contact",
      examples: ["Gracias", "OK", "Sí, gracias", "No sé"]
    },
    {
      score: 3,
      keywords: ["qué", "what", "cómo", "how", "cuándo", "when", "dónde", "where"],
      patterns: ["question_asking", "curiosity"],
      description: "Shows interest - customer is asking questions",
      examples: ["¿Qué servicios ofrecen?", "How does it work?", "¿Cuándo pueden ayudarme?"]
    },
    {
      score: 4,
      keywords: ["servicio", "service", "producto", "product", "precio", "price", "costo", "cost"],
      patterns: ["product_inquiry", "pricing_interest"],
      description: "Product interest - asking about specific services or pricing",
      examples: ["¿Cuánto cuesta?", "What services do you offer?", "¿Tienen productos para...?"]
    },
    {
      score: 5,
      keywords: ["información", "information", "detalles", "details", "más", "more", "ficha", "brochure"],
      patterns: ["information_request", "detailed_inquiry"],
      description: "Information request - wants more details about services",
      examples: ["¿Pueden enviarme más información?", "I'd like more details", "¿Tienen una ficha técnica?"]
    },
    {
      score: 6,
      keywords: ["demo", "demostración", "reunión", "meeting", "llamada", "call", "videollamada"],
      patterns: ["demo_request", "meeting_request"],
      description: "Demo request - wants to see a demonstration or schedule a meeting",
      examples: ["¿Pueden hacer una demo?", "Can we schedule a call?", "¿Cuándo podemos reunirnos?"]
    },
    {
      score: 7,
      keywords: ["agenda", "schedule", "cita", "appointment", "disponible", "available", "calendario"],
      patterns: ["scheduling", "appointment_setting"],
      description: "Scheduling - actively scheduling a meeting or demo",
      examples: ["¿Cuándo están disponibles?", "Let's schedule a meeting", "¿Qué día les conviene?"]
    },
    {
      score: 8,
      keywords: ["propuesta", "proposal", "cotización", "quote", "presupuesto", "budget", "oferta"],
      patterns: ["proposal_request", "quotation_request"],
      description: "Proposal request - asking for formal proposal or quote",
      examples: ["¿Pueden enviar una propuesta?", "I need a quote", "¿Cuál es su presupuesto?"]
    },
    {
      score: 9,
      keywords: ["negociar", "negotiate", "descuento", "discount", "oferta especial", "special offer", "condiciones"],
      patterns: ["negotiation", "terms_discussion"],
      description: "Negotiating - discussing terms, pricing, or special conditions",
      examples: ["¿Hay descuentos disponibles?", "Can we negotiate the price?", "¿Qué condiciones ofrecen?"]
    },
    {
      score: 10,
      keywords: ["contrato", "contract", "firmar", "sign", "acepto", "accept", "proceder", "proceed"],
      patterns: ["contract_ready", "final_decision"],
      description: "Ready to close - customer is ready to sign or proceed",
      examples: ["Estoy listo para firmar", "Let's proceed", "¿Cuándo podemos cerrar?"]
    }
  ],

  contextAwareness: [
    {
      type: 'greeting',
      condition: 'First message in conversation or 30+ minutes since last message',
      instruction: 'Use appropriate greeting based on time of day and formality level',
      examples: [
        'Buenos días, gracias por contactarnos',
        'Hola, ¿en qué podemos ayudarte?',
        'Buenas tardes, bienvenido'
      ]
    },
    {
      type: 'continuation',
      condition: 'Continuing existing conversation within 30 minutes',
      instruction: 'Continue naturally without greeting, reference previous context',
      examples: [
        'Perfecto, te explico más detalles...',
        'Como te mencionaba, nuestro servicio...',
        'Exactamente, y además...'
      ]
    },
    {
      type: 'question',
      condition: 'Customer asks a question',
      instruction: 'Answer directly and ask follow-up questions to understand needs',
      examples: [
        'Excelente pregunta. Nuestro servicio incluye... ¿Te interesa saber más sobre...?',
        'Claro, te explico. ¿Has considerado...?',
        'Perfecto, y además... ¿Qué opinas sobre...?'
      ]
    },
    {
      type: 'closing',
      condition: 'Customer seems ready to end conversation or has all needed info',
      instruction: 'Provide clear next steps and professional closing',
      examples: [
        'Perfecto, te enviaré la información por email. ¿Alguna otra consulta?',
        'Excelente, nos pondremos en contacto mañana. ¡Que tengas buen día!',
        'Listo, te esperamos el martes a las 3pm. ¡Hasta pronto!'
      ]
    }
  ],

  repetitionPrevention: [
    {
      type: 'content',
      instruction: 'Never repeat the same response structure or content from previous messages',
      examples: [
        'BAD: "Hola! En [Business] ofrecemos..." (repeated)',
        'GOOD: "Como te mencionaba, nuestro servicio específico para tu caso..."'
      ]
    },
    {
      type: 'greeting',
      instruction: 'Only greet once per conversation session, use context-appropriate continuations',
      examples: [
        'BAD: "¡Hola!" in every response',
        'GOOD: "Perfecto, continuando con tu consulta..."'
      ]
    },
    {
      type: 'structure',
      instruction: 'Vary response structure and approach based on conversation flow',
      examples: [
        'BAD: Always starting with "En [Business] ofrecemos..."',
        'GOOD: "Basándome en lo que me dices...", "Para tu caso específico...", "Te explico cómo funciona..."'
      ]
    }
  ]
};

/**
 * Generate context-aware instructions based on conversation history
 */
export function generateContextualInstructions(
  conversationHistory: Array<{role: string, content: string, timestamp: Date}>,
  businessName: string,
  customInstructions?: string
): string {
  const lastMessage = conversationHistory[conversationHistory.length - 1];
  const isFirstMessage = conversationHistory.length === 1;
  const timeSinceLastMessage = lastMessage ? 
    (Date.now() - new Date(lastMessage.timestamp).getTime()) / (1000 * 60) : 0;
  
  let contextInstruction = '';
  
  if (isFirstMessage || timeSinceLastMessage > 30) {
    contextInstruction = `CONTEXT: This is ${isFirstMessage ? 'the first message' : 'a new conversation session'}. Use appropriate greeting.`;
  } else {
    contextInstruction = `CONTEXT: Continuing existing conversation. Do NOT greet again. Reference previous messages naturally.`;
  }

  const businessInstruction = businessName !== 'Business' ? 
    `BUSINESS: You represent ${businessName}. Use this name consistently.` :
    `BUSINESS: You represent a business. Use the business name provided in the context.`;

  const customInstruction = customInstructions ? 
    `CUSTOM INSTRUCTIONS: ${customInstructions}` : '';

  return `
${GENERIC_AI_INSTRUCTIONS.basePrompt}

${contextInstruction}
${businessInstruction}
${customInstruction}

CONVERSATION RULES:
${GENERIC_AI_INSTRUCTIONS.conversationRules.map(rule => `- ${rule}`).join('\n')}

LEAD SCORING RULES:
${GENERIC_AI_INSTRUCTIONS.leadScoringRules.map(rule => 
  `- Score ${rule.score}: ${rule.description} (Keywords: ${rule.keywords.join(', ')})`
).join('\n')}

REPETITION PREVENTION:
${GENERIC_AI_INSTRUCTIONS.repetitionPrevention.map(rule => 
  `- ${rule.type.toUpperCase()}: ${rule.instruction}`
).join('\n')}

RESPONSE FORMAT (JSON ONLY):
{
  "status": number (1-10),
  "responseText": "string",
  "leadScore": number (1-10),
  "intent": "string",
  "nextAction": "string", 
  "confidence": number (0-1),
  "metadata": {
    "greetingUsed": boolean,
    "previousContextReferenced": boolean,
    "businessNameUsed": "string"
  }
}`;
}

/**
 * Analyze conversation history for repetition patterns
 */
export function analyzeRepetitionPatterns(conversationHistory: Array<{role: string, content: string}>): string[] {
  const patterns: string[] = [];
  const assistantMessages = conversationHistory.filter(msg => msg.role === 'assistant');
  
  if (assistantMessages.length < 2) return patterns;
  
  // Check for repeated greetings
  const greetings = assistantMessages.map(msg => 
    msg.content.toLowerCase().match(/^(hola|hello|hi|buenos días|buenas tardes)/)?.[0]
  ).filter(Boolean);
  
  if (greetings.length > 1) {
    patterns.push('repeated_greetings');
  }
  
  // Check for repeated business introductions
  const businessIntros = assistantMessages.map(msg => 
    msg.content.toLowerCase().includes('ofrecemos') || msg.content.toLowerCase().includes('we offer')
  ).filter(Boolean).length;
  
  if (businessIntros > 1) {
    patterns.push('repeated_business_intro');
  }
  
  // Check for repeated question structures
  const questionPatterns = assistantMessages.map(msg => 
    msg.content.includes('¿') || msg.content.includes('?')
  ).filter(Boolean).length;
  
  if (questionPatterns > 2) {
    patterns.push('excessive_questions');
  }
  
  return patterns;
}

/**
 * Get lead scoring guidance based on message content
 */
export function getLeadScoringGuidance(message: string): { score: number; reason: string } {
  const lowerMessage = message.toLowerCase();
  
  for (const rule of GENERIC_AI_INSTRUCTIONS.leadScoringRules) {
    const hasKeyword = rule.keywords.some(keyword => lowerMessage.includes(keyword));
    const hasPattern = rule.patterns.some(pattern => {
      switch (pattern) {
        case 'initial_greeting':
          return /^(hola|hello|hi|buenos días|buenas tardes)/i.test(message);
        case 'question_asking':
          return /[¿?]/.test(message);
        case 'product_inquiry':
          return /(servicio|service|producto|product|precio|price)/i.test(message);
        default:
          return false;
      }
    });
    
    if (hasKeyword || hasPattern) {
      return { score: rule.score, reason: rule.description };
    }
  }
  
  return { score: 1, reason: 'No clear indicators found' };
}
