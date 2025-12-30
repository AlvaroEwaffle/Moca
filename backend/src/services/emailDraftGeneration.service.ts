// @ts-nocheck
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import dotenv from 'dotenv';
import Message from '../models/message.model';
import Conversation from '../models/conversation.model';
import Agent from '../models/agent.model';
import User from '../models/user.model';
import { getGmailClient, getGmailProfile } from './gmail.service';
import { google } from 'googleapis';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface EmailDraftContext {
  emailSubject: string;
  emailBody: string;
  fromEmail: string;
  fromName?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  businessContext?: {
    company: string;
    sector?: string;
    services?: string[];
  };
  agentSettings?: {
    systemPrompt?: string;
    toneOfVoice?: 'professional' | 'friendly' | 'casual';
    keyInformation?: string;
  };
  language?: string;
  userEmail?: string; // User's email address (to identify who the user is)
  userName?: string; // User's name (to identify who the user is)
}

/**
 * Generate email draft response using AI
 */
export async function generateEmailDraft(context: EmailDraftContext): Promise<string> {
  try {
    console.log('🤖 Generating email draft with AI');

    // Build user identification section for system prompt
    const userIdentification = context.userEmail 
      ? `\n\nIMPORTANTE - IDENTIFICACIÓN DEL USUARIO:\n` +
        `- El usuario es: ${context.userName || 'Usuario'} (${context.userEmail})\n` +
        `- TÚ eres el asistente respondiendo EN NOMBRE del usuario\n` +
        `- NUNCA escribas emails DIRIGIDOS al usuario (${context.userEmail})\n` +
        `- Si ves que un email viene de ${context.userEmail}, significa que el usuario ya respondió\n` +
        `- Solo debes responder emails que vengan de OTROS (no del usuario)\n`
      : '';

    // Use custom system prompt if provided, otherwise use default
    const baseSystemPrompt = context.agentSettings?.systemPrompt || `Eres un asistente profesional para gestión de emails. 
    
Tu objetivo es:
- Generar respuestas de email profesionales y útiles
- Mantener un tono apropiado según el contexto
- Responder directamente a las preguntas y solicitudes
- Ser conciso pero completo
- Responder en ${context.language || 'español'}

Instrucciones:
- Responde de manera profesional y clara
- Sé directo pero cortés
- Responde todas las preguntas planteadas
- Si no tienes información suficiente, sé honesto
- Usa un formato de email apropiado (saludo, cuerpo, cierre)
- Mantén el tono ${context.agentSettings?.toneOfVoice || 'professional'}`;

    const systemPrompt = baseSystemPrompt + userIdentification;

    // Build key information section
    const keyInfoSection = context.agentSettings?.keyInformation 
      ? `\n\nInformación clave del negocio:\n${context.agentSettings.keyInformation}\n`
      : '';

    // Build conversation history if available
    let conversationContext = '';
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      conversationContext = `\n\nHistorial de conversación:\n${context.conversationHistory.map(msg => 
        `${msg.role === 'user' ? '👤 Cliente' : '🤖 Tú'}: ${msg.content}`
      ).join('\n')}\n`;
    }

    // Build business context
    const businessContextSection = context.businessContext?.company
      ? `\n\nContexto del negocio:\n- Empresa: ${context.businessContext.company}${context.businessContext.sector ? `\n- Sector: ${context.businessContext.sector}` : ''}${context.businessContext.services ? `\n- Servicios: ${context.businessContext.services.join(', ')}` : ''}`
      : '';

    const userPrompt = `Genera una respuesta profesional para este email:

ASUNTO: ${context.emailSubject}

MENSAJE RECIBIDO:
${context.emailBody}${conversationContext}${businessContextSection}${keyInfoSection}

Instrucciones:
- Responde directamente al contenido del email
- Usa un saludo apropiado (ej: "Hola [Nombre]," o "Estimado/a [Nombre],")
- Responde todas las preguntas o solicitudes mencionadas
- Sé conciso pero completo
- Cierra con una despedida profesional
- Responde en ${context.language || 'español'}
- Mantén un tono ${context.agentSettings?.toneOfVoice || 'professional'}

Formato esperado:
- Saludo
- Cuerpo del mensaje (1-3 párrafos)
- Cierre y despedida
- No incluyas información de firma automática (eso se agregará después)

Respuesta:`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages,
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    const draftContent = response.choices[0]?.message?.content || '';
    
    console.log('✅ Email draft generated successfully');
    return draftContent.trim();
  } catch (error: any) {
    console.error('❌ Error generating email draft:', error);
    throw new Error(`Failed to generate email draft: ${error.message}`);
  }
}

/**
 * Generate email draft with full context from conversation and agent
 */
export async function generateEmailDraftWithContext(options: {
  emailId: string;
  emailSubject: string;
  emailBody: string;
  fromEmail: string;
  fromName?: string;
  userId: string;
  agentId?: string;
  conversationId?: string;
  threadId?: string;
}): Promise<string> {
  try {
    // Fetch conversation history from multiple sources
    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }> = [];
    
    // Source 1: Get messages from our database (processed messages)
    if (options.conversationId) {
      const dbMessages = await Message.find({
        conversationId: options.conversationId
      })
        .sort({ 'metadata.timestamp': 1 })
        .limit(20); // Get more messages from DB

      const dbHistory = dbMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content?.text || '',
        timestamp: msg.metadata?.timestamp || new Date()
      }));
      
      // Store DB messages for later merging
      conversationHistory = dbHistory;
    }

    // Source 2: Get the complete thread directly from Gmail API for full context
    if (options.threadId) {
      try {
        const oauth2Client = await getGmailClient(options.userId);
        if (oauth2Client) {
          const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
          const userProfile = await getGmailProfile(options.userId);
          
          if (userProfile?.email) {
            const userEmail = userProfile.email.toLowerCase();
            
            // Get all messages in the thread from Gmail
            const threadResponse = await gmail.users.threads.get({
              userId: 'me',
              id: options.threadId,
              format: 'full'
            });

            const thread = threadResponse.data;
            if (thread.messages && thread.messages.length > 0) {
              // Parse messages from Gmail thread
              const gmailMessages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }> = [];
              
              for (const message of thread.messages) {
                if (!message.payload?.headers) continue;

                const headers = message.payload.headers;
                const getHeader = (name: string) => {
                  const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
                  return header?.value;
                };

                const fromHeader = getHeader('From') || '';
                // Extract email address from "Display Name <email@domain.com>" format
                const extractEmailFromHeader = (header: string): string => {
                  const emailMatch = header.match(/<([^>]+)>/);
                  if (emailMatch) {
                    return emailMatch[1].toLowerCase().trim();
                  }
                  // If no angle brackets, assume the whole header is the email
                  return header.toLowerCase().trim();
                };
                const fromEmail = extractEmailFromHeader(fromHeader);
                const dateHeader = getHeader('Date');
                const messageDate = dateHeader ? new Date(dateHeader) : new Date(Number(message.internalDate || 0));
                
                // Determine role: 'user' if from original sender, 'assistant' if from our user
                // Compare emails directly (not using includes to avoid false positives)
                const isFromUser = fromEmail === userEmail || fromEmail.includes(`@${userEmail.split('@')[1]}`);
                const role: 'user' | 'assistant' = isFromUser ? 'assistant' : 'user';

                // Extract body content
                let body = '';
                const extractBody = (part: any): void => {
                  if (part.body?.data) {
                    const content = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    const mimeType = part.mimeType || '';
                    if (mimeType === 'text/plain' && !body) {
                      body = content;
                    }
                  }
                  if (part.parts) {
                    part.parts.forEach(extractBody);
                  }
                };

                if (message.payload) {
                  extractBody(message.payload);
                }

                // Use snippet if body is empty
                const content = body || message.snippet || '';

                gmailMessages.push({
                  role,
                  content,
                  timestamp: messageDate
                });
              }

              // Merge with DB messages, avoiding duplicates
              // Use a Set to track message signatures we've already added (content preview + timestamp)
              const messageSignatures = new Set<string>();
              
              // Combine all messages
              const allMessages = [...conversationHistory, ...gmailMessages];
              
              // Deduplicate: create signature from content preview + timestamp
              const mergedHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }> = [];
              
              for (const msg of allMessages) {
                // Create a signature for deduplication (first 100 chars + timestamp)
                const signature = `${msg.content.substring(0, 100).trim()}_${msg.timestamp.getTime()}`;
                
                if (!messageSignatures.has(signature)) {
                  messageSignatures.add(signature);
                  mergedHistory.push({
                    role: msg.role,
                    content: msg.content,
                    timestamp: msg.timestamp
                  });
                }
              }

              // Sort by timestamp (oldest first)
              mergedHistory.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
              
              // Take the last 15 messages for context (most recent messages)
              conversationHistory = mergedHistory.slice(-15);
              
              console.log(`📧 [Email Draft Generation] Using ${conversationHistory.length} messages from thread ${options.threadId} (${gmailMessages.length} from Gmail API)`);
            }
          }
        }
      } catch (gmailError: any) {
        console.warn(`⚠️ [Email Draft Generation] Could not fetch thread from Gmail API: ${gmailError.message}`);
        // Continue with DB messages only
      }
    }

    // Fetch agent settings if agentId is provided
    let agentSettings: {
      systemPrompt?: string;
      toneOfVoice?: 'professional' | 'friendly' | 'casual';
      keyInformation?: string;
    } | undefined;

    if (options.agentId) {
      const agent = await Agent.findById(options.agentId);
      if (agent) {
        agentSettings = {
          systemPrompt: agent.systemPrompt,
          toneOfVoice: agent.metadata?.channelVoices?.gmail || 'professional',
          keyInformation: undefined // Could be extracted from agent metadata if available
        };
      }
    }

    // Fetch user/business context
    const user = await User.findById(options.userId);
    const businessContext = user?.businessName
      ? {
          company: user.businessName,
          sector: undefined,
          services: []
        }
      : undefined;

    // Get user email for system prompt (to explicitly identify the user)
    let userEmailForPrompt: string | undefined;
    let userNameForPrompt: string | undefined;
    try {
      const { getGmailProfile } = await import('./gmail.service');
      const userProfile = await getGmailProfile(options.userId);
      if (userProfile?.email) {
        userEmailForPrompt = userProfile.email;
      }
      if (user?.name) {
        userNameForPrompt = user.name;
      }
    } catch (error: any) {
      console.warn(`⚠️ [Email Draft Generation] Could not fetch user profile: ${error.message}`);
    }

    // Generate draft
    const draft = await generateEmailDraft({
      emailSubject: options.emailSubject,
      emailBody: options.emailBody,
      fromEmail: options.fromEmail,
      fromName: options.fromName,
      conversationHistory,
      businessContext,
      agentSettings,
      language: 'español',
      userEmail: userEmailForPrompt,
      userName: userNameForPrompt
    });

    return draft;
  } catch (error: any) {
    console.error('❌ Error generating email draft with context:', error);
    throw error;
  }
}


