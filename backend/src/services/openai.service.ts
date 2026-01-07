import OpenAI from 'openai'
import { v4 as uuid } from 'uuid'
import dotenv from 'dotenv'
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { 
  StructuredResponse, 
  ConversationContext, 
  AIResponseConfig,
  validateStructuredResponse,
  createDefaultResponse
} from '../types/aiResponse'
import { generateContextualInstructions } from '../templates/aiInstructions'
import { LeadScoringService } from './leadScoring.service'
import { mcpService } from './mcp.service'
import GlobalAgentConfig from '../models/globalAgentConfig.model'

// Ensure environment variables are loaded
dotenv.config()

// Debug: Log if API key exists (without exposing the key)
console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY)

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Instagram DM AI Response Generation
export async function generateInstagramResponse(context: {
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  userIntent?: string;
  conversationTopic?: string;
  userSentiment?: 'positive' | 'neutral' | 'negative';
  businessContext?: {
    company: string;
    sector: string;
    services: string[];
  };
  language?: string;
  agentBehavior?: {
    systemPrompt?: string;
    toneOfVoice?: string;
    keyInformation?: string;
    fallbackRules?: string[];
  };
  accountMcpConfig?: { enabled: boolean; servers: any[] }; // Account-specific MCP configuration
}): Promise<string> {
  try {
    console.log('🤖 Generating Instagram DM response with AI');

    // Get MCP tools if enabled (before building prompts)
    let functions: any[] = [];
    let toolsInfo = '';
    
    try {
      // Use account-specific MCP config if provided
      if (context.accountMcpConfig) {
        await mcpService.initializeWithAccountConfig(context.accountMcpConfig);
        functions = await mcpService.getOpenAIFunctions();
        if (functions.length > 0) {
          console.log(`🔧 [MCP] ${functions.length} MCP tools available for this conversation (account-specific)`);
        }
      } else {
        // Fallback to global config for backward compatibility
        const globalConfig = await GlobalAgentConfig.findOne();
        if (globalConfig?.mcpTools?.enabled) {
          await mcpService.initialize(globalConfig);
          functions = await mcpService.getOpenAIFunctions();
          if (functions.length > 0) {
            console.log(`🔧 [MCP] ${functions.length} MCP tools available for this conversation (global config)`);
          }
        }
      }
      
      if (functions.length > 0) {
        // Build tools information for the system prompt with detailed parameter info
        const toolsList = functions.map((fn: any) => {
            const requiredParams = fn.parameters?.required || [];
            const optionalParams: string[] = [];
            const properties = fn.parameters?.properties || {};
            
            // Separate required and optional parameters
            Object.keys(properties).forEach((param: string) => {
              if (!requiredParams.includes(param)) {
                optionalParams.push(param);
              }
            });
            
            // Build required params list with examples and constraints
            const requiredList = requiredParams.length > 0 
              ? requiredParams.map((param: string) => {
                  const paramInfo = properties[param] || {};
                  const constraints: string[] = [];
                  if (paramInfo.format) constraints.push(`formato: ${paramInfo.format}`);
                  if (paramInfo.enum) constraints.push(`valores permitidos: ${paramInfo.enum.join(', ')}`);
                  if (paramInfo.minLength) constraints.push(`mínimo: ${paramInfo.minLength} caracteres`);
                  if (paramInfo.maxLength) constraints.push(`máximo: ${paramInfo.maxLength} caracteres`);
                  if (paramInfo.minimum !== undefined) constraints.push(`mínimo: ${paramInfo.minimum}`);
                  if (paramInfo.maximum !== undefined) constraints.push(`máximo: ${paramInfo.maximum}`);
                  if (paramInfo.pattern) constraints.push(`patrón: ${paramInfo.pattern}`);
                  
                  const constraintsStr = constraints.length > 0 ? ` [${constraints.join(', ')}]` : '';
                  const exampleStr = paramInfo.examples && paramInfo.examples.length > 0 
                    ? ` (ejemplo: ${paramInfo.examples[0]})` 
                    : (paramInfo.example ? ` (ejemplo: ${paramInfo.example})` : '');
                  
                  return `  - ${param} (${paramInfo.type || 'string'})${constraintsStr}${exampleStr}: ${paramInfo.description || 'Sin descripción'}`;
                }).join('\n')
              : '  Ninguno';
            
            // Build optional params list with examples
            const optionalList = optionalParams.length > 0
              ? optionalParams.map((param: string) => {
                  const paramInfo = properties[param] || {};
                  const exampleStr = paramInfo.examples && paramInfo.examples.length > 0 
                    ? ` (ejemplo: ${paramInfo.examples[0]})` 
                    : (paramInfo.example ? ` (ejemplo: ${paramInfo.example})` : '');
                  const defaultStr = paramInfo.default !== undefined ? ` (default: ${paramInfo.default})` : '';
                  return `  - ${param} (${paramInfo.type || 'string'}, opcional)${exampleStr}${defaultStr}: ${paramInfo.description || 'Sin descripción'}`;
                }).join('\n')
              : '  Ninguno';
            
            return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 ${fn.name}
${fn.description || 'Sin descripción'}

📋 Parámetros requeridos:
${requiredList}

📝 Parámetros opcionales:
${optionalList}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        }).join('\n\n');
        
        toolsInfo = `\n\nHERRAMIENTAS DISPONIBLES (MCP Tools):
Tienes acceso a las siguientes herramientas externas que puedes usar cuando sea apropiado:

${toolsList}

INSTRUCCIONES CRÍTICAS SOBRE EL USO DE HERRAMIENTAS:

**⚠️ REGLAS FUNDAMENTALES - LEE CON ATENCIÓN:**
1. **NUNCA uses valores por defecto, placeholders o datos inventados** 
   - ❌ NO uses: "sin especificar", "ejemplo.com", "Negocio sin especificar", "Dueño sin especificar", valores genéricos, etc.
   - ❌ NO uses placeholders como: "[NOMBRE DEL CLIENTE]", "[EMAIL DEL CLIENTE]", "[NOMBRE DEL NEGOCIO]", "[TELÉFONO DE CONTACTO]"
   - ❌ NO inventes datos que el cliente no haya proporcionado
   - ❌ NO asumas información que no esté explícitamente en la conversación
   - ✅ SOLO usa datos que el cliente haya proporcionado explícitamente
   - ⚠️ **CRÍTICO**: Si llamas a una herramienta con placeholders o datos inventados, la herramienta fallará y causará errores

2. **SIEMPRE pregunta al cliente por cada parámetro requerido ANTES de llamar a la herramienta**
   - NO llames a la herramienta hasta tener TODOS los parámetros requeridos con datos REALES del cliente
   - NO uses valores por defecto si faltan parámetros
   - ⚠️ **CRÍTICO**: Si no tienes TODOS los datos requeridos con valores reales del cliente, NO llames a la herramienta. En su lugar, pregunta por los datos faltantes.

3. **Pregunta UN dato a la vez** de forma natural y conversacional
   - Espera la respuesta del cliente antes de preguntar el siguiente dato
   - No preguntes múltiples datos en un solo mensaje

4. **VERIFICA antes de ejecutar**: Antes de llamar a una herramienta, verifica que TODOS los parámetros requeridos sean datos reales proporcionados por el cliente

5. **Maneja datos parciales**: Si el cliente proporciona algunos datos pero faltan otros, pregunta por los que faltan. NO asumas valores por defecto.

**FLUJO PASO A PASO OBLIGATORIO:**

**Paso 1: Identificar necesidad**
- El cliente expresa una necesidad (ej: "quiero crear una cuenta", "necesito programar una cita")

**Paso 2: Identificar herramienta**
- Revisa la lista de herramientas disponibles arriba
- Identifica qué herramienta es apropiada para la solicitud

**Paso 3: Revisar parámetros requeridos**
- Lee la lista de parámetros requeridos de esa herramienta (ver lista arriba)
- Anota qué datos necesitas del cliente

**Paso 4: Preguntar por datos (UNO A LA VEZ)**
- Pregunta al cliente por el primer parámetro requerido
- Ejemplo: "¡Perfecto! Te ayudo con eso. ¿Cuál es el nombre de tu negocio?"
- ESPERA la respuesta del cliente

**Paso 5: Continuar preguntando**
- Una vez que tengas la respuesta, pregunta por el siguiente parámetro requerido
- Repite hasta tener TODOS los parámetros requeridos

**Paso 6: Verificar datos completos ANTES de llamar**
- Antes de ejecutar, verifica que tienes TODOS los parámetros requeridos
- Verifica que todos son datos REALES del cliente (no placeholders, no valores genéricos)
- ⚠️ **CRÍTICO**: Si encuentras CUALQUIER placeholder como "[NOMBRE DEL CLIENTE]" o "[EMAIL DEL CLIENTE]", NO llames a la herramienta
- ⚠️ **CRÍTICO**: Si faltan datos o son placeholders, pregunta al cliente en lugar de llamar a la herramienta

**Paso 7: Ejecutar herramienta SOLO con datos reales**
- SOLO cuando tengas todos los datos reales (sin placeholders), llama a la herramienta
- Si tienes placeholders o datos faltantes, NO llames a la herramienta - pregunta primero
- Incorpora los resultados de manera natural en tu respuesta

**EJEMPLO DE FLUJO CORRECTO:**
Cliente: "Quiero crear una cuenta"
Agente: "¡Perfecto! Te ayudo a crear tu cuenta. ¿Cuál es el nombre de tu negocio?"
Cliente: "Mi negocio se llama Ewaffle"
Agente: "Excelente. ¿Y cómo te llamas tú (dueño/responsable)?"
Cliente: "Alvaro Villena"
Agente: "Perfecto. ¿Cuál es tu email de contacto?"
Cliente: "alvaro@ewaffle.cl"
Agente: "¿Y tu teléfono? (con código de país, ej: +56912345678)"
Cliente: "+56920115198"
Agente: (AHORA SÍ ejecuta la herramienta con los datos reales)

**INCORPORACIÓN NATURAL:**
- Después de usar una herramienta, incorpora los resultados de manera natural en tu respuesta
- **NO MENCIONES LA HERRAMIENTA**: No menciones que estás usando una herramienta técnica, simplemente proporciona la información obtenida o confirma la acción realizada

**MANEJO DE ERRORES:**
- Si una herramienta falla, continúa con la conversación de manera natural sin mencionar el error técnico
- Ofrece una alternativa apropiada si la herramienta no puede completar la acción`;
      }
    } catch (error) {
      console.warn('⚠️ [MCP] Error loading MCP tools:', error);
    }

    // Use custom system prompt if provided, otherwise use default
    let baseSystemPrompt = context.agentBehavior?.systemPrompt || `Eres un asistente virtual profesional y amigable.
    
Tu objetivo es:
- Proporcionar respuestas útiles y profesionales
- Mantener un tono amigable pero profesional
- Ayudar a calificar leads y entender necesidades del cliente
- Dirigir consultas complejas a agentes humanos cuando sea necesario
- Responder en el idioma del usuario (español por defecto)

Instrucciones:
- Responde de manera natural y conversacional
- Sé útil pero no demasiado largo (máximo 2-3 frases)
- Si detectas una consulta compleja, sugiere que un agente se pondrá en contacto
- Mantén el tono profesional pero cercano
- Usa emojis ocasionalmente para hacer la conversación más amigable`;

    // Append tools information if available
    const systemPrompt = baseSystemPrompt + toolsInfo;

    console.log(`🤖 [OpenAI] Using ${context.agentBehavior?.systemPrompt ? 'custom' : 'default'} system prompt${functions.length > 0 ? ` with ${functions.length} MCP tools` : ''}`);
    console.log(`📏 [OpenAI] System prompt length: ${systemPrompt.length} characters`);
    if (context.agentBehavior?.systemPrompt) {
      console.log(`📝 [OpenAI] Custom system prompt preview: ${context.agentBehavior.systemPrompt.substring(0, 200)}...`);
    }

    // Build key information section
    const keyInfoSection = context.agentBehavior?.keyInformation 
      ? `\nInformación clave del negocio:\n${context.agentBehavior.keyInformation}\n`
      : '';

    // Build tone of voice instruction
    const toneInstruction = context.agentBehavior?.toneOfVoice 
      ? `\nTono de voz: ${context.agentBehavior.toneOfVoice}\n`
      : '';

    // Build conversation context - use the last message as the current one
    const lastMessage = context.conversationHistory[context.conversationHistory.length - 1];
    const previousHistory = context.conversationHistory.slice(0, -1);
    
    console.log('📋 [OpenAI] Building user prompt:', {
      totalMessages: context.conversationHistory.length,
      previousHistoryLength: previousHistory.length,
      lastMessageRole: lastMessage?.role,
      lastMessageLength: lastMessage?.content?.length || 0
    });
    
    const userPrompt = `Por favor, genera una respuesta natural para este mensaje del cliente:

${previousHistory.length > 0 ? `Contexto de la conversación anterior:
${previousHistory.map(msg => 
  `${msg.role === 'user' ? '👤 Cliente' : '🤖 Asistente'}: ${msg.content}`
).join('\n')}

` : ''}Mensaje actual del cliente:
👤 Cliente: ${lastMessage?.content || 'Sin mensaje'}

Información adicional:
- Intención del usuario: ${context.userIntent || 'No especificada'}
- Tema de conversación: ${context.conversationTopic || 'General'}
- Sentimiento: ${context.userSentiment || 'neutral'}
- Empresa del cliente: ${context.businessContext?.company || 'No especificada'}
- Sector: ${context.businessContext?.sector || 'No especificado'}
- Servicios de interés: ${context.businessContext?.services?.join(', ') || 'No especificados'}${keyInfoSection}${toneInstruction}

INSTRUCCIONES IMPORTANTES:
1. Responde DIRECTAMENTE al mensaje actual del cliente, considerando el contexto de la conversación anterior
2. NO repitas saludos si ya saludaste antes en la conversación
3. NO repitas información que ya mencionaste anteriormente
4. Si el cliente hace una pregunta nueva, responde a esa pregunta específica
5. Mantén un tono profesional pero amigable
6. No sea demasiado larga (máximo 2-3 frases)
7. Use el idioma ${context.language || 'español'}
8. Incluya información relevante del negocio cuando sea apropiado
9. Si el cliente menciona información nueva (como tipo de negocio), incorpórala en tu respuesta

Respuesta:`;

    console.log(`📏 [OpenAI] User prompt length: ${userPrompt.length} characters`);
    console.log(`💬 [OpenAI] Last message preview: ${lastMessage?.content?.substring(0, 100) || 'N/A'}...`);

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // Use a model that supports tools. Default to gpt-4o-mini which has excellent tool support
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const baseMaxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '150');
    // Increase max_tokens when tools are available to allow for tool calls and responses
    const maxTokens = functions.length > 0 ? Math.max(baseMaxTokens, 500) : baseMaxTokens;
    
    const requestConfig: any = {
      model: modelName,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    };

    // Add functions if MCP tools are available
    if (functions.length > 0) {
      requestConfig.tools = functions.map(fn => ({
        type: 'function',
        function: fn
      }));
      requestConfig.tool_choice = 'auto';
      console.log(`🔧 [OpenAI] Added ${functions.length} tools to request`);
      console.log(`🔧 [OpenAI] Using model: ${modelName} (supports tools)`);
      console.log(`🔧 [OpenAI] Increased max_tokens to ${maxTokens} to accommodate tool calls`);
    }

    console.log('🚀 [OpenAI] Calling OpenAI API...');
    console.log('⚙️ [OpenAI] Request config:', {
      model: requestConfig.model,
      max_tokens: requestConfig.max_tokens,
      hasTools: !!requestConfig.tools,
      toolsCount: requestConfig.tools?.length || 0,
      messagesCount: messages.length
    });
    
    const apiStartTime = Date.now();
    let response = await openai.chat.completions.create(requestConfig);
    const apiDuration = Date.now() - apiStartTime;
    
    console.log(`✅ [OpenAI] OpenAI API response received in ${apiDuration}ms`);
    console.log('📊 [OpenAI] Response metadata:', {
      finishReason: response.choices[0]?.finish_reason,
      hasToolCalls: !!(response.choices[0]?.message?.tool_calls?.length),
      toolCallsCount: response.choices[0]?.message?.tool_calls?.length || 0,
      usage: response.usage ? {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens
      } : null
    });
    
    // Handle function calls if any
    const toolCalls = response.choices[0]?.message?.tool_calls || [];
    if (toolCalls.length > 0) {
      console.log(`🔧 [OpenAI] Processing ${toolCalls.length} tool call(s) in Instagram response`);
      toolCalls.forEach((call, idx) => {
        console.log(`🔧 [OpenAI] Tool call ${idx + 1}:`, {
          id: call.id,
          type: call.type,
          functionName: call.type === 'function' ? call.function.name : 'N/A',
          arguments: call.type === 'function' ? call.function.arguments?.substring(0, 200) : 'N/A'
        });
      });
      
      // Execute tool calls
      const toolResults = [];
      for (const toolCall of toolCalls) {
        if (toolCall.type === 'function') {
          try {
            console.log(`🔧 [OpenAI] Executing tool: ${toolCall.function.name}`);
            const parameters = JSON.parse(toolCall.function.arguments || '{}');
            console.log(`🔧 [OpenAI] Tool parameters:`, JSON.stringify(parameters, null, 2));
            
            const toolStartTime = Date.now();
            const result = await mcpService.executeTool(toolCall.function.name, parameters);
            const toolDuration = Date.now() - toolStartTime;
            
            console.log(`✅ [OpenAI] Tool ${toolCall.function.name} executed in ${toolDuration}ms`);
            console.log(`📤 [OpenAI] Tool result:`, JSON.stringify(result, null, 2).substring(0, 500));
            
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              name: toolCall.function.name,
              content: JSON.stringify(result.success ? result.result : { error: result.error })
            });
          } catch (error: any) {
            console.error(`❌ [MCP] Error executing tool ${toolCall.function.name}:`, error);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              name: toolCall.function.name,
              content: JSON.stringify({ error: error.message })
            });
          }
        }
      }
      
      // Add tool results to messages and get final response
      messages.push(response.choices[0].message as ChatCompletionMessageParam);
      messages.push(...toolResults);
      
      console.log(`🔄 [OpenAI] Requesting final response with ${toolResults.length} tool result(s)`);
      
      // Get final response with tool results
      const finalModelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const finalMaxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '150');
      const finalRequestConfig: any = {
        model: finalModelName,
        messages,
        max_tokens: finalMaxTokens,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      };
      
      if (functions.length > 0) {
        finalRequestConfig.tools = requestConfig.tools;
        finalRequestConfig.tool_choice = 'none'; // Don't allow more tool calls in final response
      }
      
      const finalApiStartTime = Date.now();
      response = await openai.chat.completions.create(finalRequestConfig);
      const finalApiDuration = Date.now() - finalApiStartTime;
      console.log(`✅ [OpenAI] Final response received in ${finalApiDuration}ms`);
    }

    const aiResponse = response.choices[0]?.message?.content || '';
    
    console.log('✅ [OpenAI] Instagram DM response generated successfully');
    console.log(`📤 [OpenAI] Final response length: ${aiResponse.length} characters`);
    console.log(`📤 [OpenAI] Final response: ${aiResponse.substring(0, 300)}${aiResponse.length > 300 ? '...' : ''}`);
    return aiResponse.trim();

  } catch (error) {
    console.error('❌ Error generating Instagram DM response:', error);
    
    // Fallback to simple rule-based response
    return generateFallbackResponse(context);
  }
}

/**
 * Generate structured AI response with lead scoring and context awareness
 */
export async function generateStructuredResponse(
  conversationContext: ConversationContext,
  config: AIResponseConfig,
  accountMcpConfig?: { enabled: boolean; servers: any[] } // Account-specific MCP configuration
): Promise<StructuredResponse> {
  try {
    console.log('🤖 Generating structured Instagram DM response with AI');

    // Get MCP tools if enabled (before building prompts)
    let functions: any[] = [];
    let toolsInfo = '';
    
    try {
      // Use account-specific MCP config if provided
      if (accountMcpConfig) {
        await mcpService.initializeWithAccountConfig(accountMcpConfig);
        functions = await mcpService.getOpenAIFunctions();
        if (functions.length > 0) {
          console.log(`🔧 [MCP] ${functions.length} MCP tools available for structured response (account-specific)`);
        }
      } else {
        // Fallback to global config for backward compatibility
        const globalConfig = await GlobalAgentConfig.findOne();
        if (globalConfig?.mcpTools?.enabled) {
          await mcpService.initialize(globalConfig);
          functions = await mcpService.getOpenAIFunctions();
          if (functions.length > 0) {
            console.log(`🔧 [MCP] ${functions.length} MCP tools available for structured response (global config)`);
          }
        }
      }
      
      if (functions.length > 0) {
        // Build tools information for the system prompt with detailed parameter info
        const toolsList = functions.map((fn: any) => {
            const requiredParams = fn.parameters?.required || [];
            const optionalParams: string[] = [];
            const properties = fn.parameters?.properties || {};
            
            // Separate required and optional parameters
            Object.keys(properties).forEach((param: string) => {
              if (!requiredParams.includes(param)) {
                optionalParams.push(param);
              }
            });
            
            // Build required params list with examples and constraints
            const requiredList = requiredParams.length > 0 
              ? requiredParams.map((param: string) => {
                  const paramInfo = properties[param] || {};
                  const constraints: string[] = [];
                  if (paramInfo.format) constraints.push(`formato: ${paramInfo.format}`);
                  if (paramInfo.enum) constraints.push(`valores permitidos: ${paramInfo.enum.join(', ')}`);
                  if (paramInfo.minLength) constraints.push(`mínimo: ${paramInfo.minLength} caracteres`);
                  if (paramInfo.maxLength) constraints.push(`máximo: ${paramInfo.maxLength} caracteres`);
                  if (paramInfo.minimum !== undefined) constraints.push(`mínimo: ${paramInfo.minimum}`);
                  if (paramInfo.maximum !== undefined) constraints.push(`máximo: ${paramInfo.maximum}`);
                  if (paramInfo.pattern) constraints.push(`patrón: ${paramInfo.pattern}`);
                  
                  const constraintsStr = constraints.length > 0 ? ` [${constraints.join(', ')}]` : '';
                  const exampleStr = paramInfo.examples && paramInfo.examples.length > 0 
                    ? ` (ejemplo: ${paramInfo.examples[0]})` 
                    : (paramInfo.example ? ` (ejemplo: ${paramInfo.example})` : '');
                  
                  return `  - ${param} (${paramInfo.type || 'string'})${constraintsStr}${exampleStr}: ${paramInfo.description || 'Sin descripción'}`;
                }).join('\n')
              : '  Ninguno';
            
            // Build optional params list with examples
            const optionalList = optionalParams.length > 0
              ? optionalParams.map((param: string) => {
                  const paramInfo = properties[param] || {};
                  const exampleStr = paramInfo.examples && paramInfo.examples.length > 0 
                    ? ` (ejemplo: ${paramInfo.examples[0]})` 
                    : (paramInfo.example ? ` (ejemplo: ${paramInfo.example})` : '');
                  const defaultStr = paramInfo.default !== undefined ? ` (default: ${paramInfo.default})` : '';
                  return `  - ${param} (${paramInfo.type || 'string'}, opcional)${exampleStr}${defaultStr}: ${paramInfo.description || 'Sin descripción'}`;
                }).join('\n')
              : '  Ninguno';
            
            return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 ${fn.name}
${fn.description || 'Sin descripción'}

📋 Parámetros requeridos:
${requiredList}

📝 Parámetros opcionales:
${optionalList}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        }).join('\n\n');
        
        toolsInfo = `\n\nHERRAMIENTAS DISPONIBLES (MCP Tools):
Tienes acceso a las siguientes herramientas externas que puedes usar cuando sea apropiado:

${toolsList}

INSTRUCCIONES CRÍTICAS SOBRE EL USO DE HERRAMIENTAS:

**⚠️ REGLAS FUNDAMENTALES - LEE CON ATENCIÓN:**
1. **NUNCA uses valores por defecto, placeholders o datos inventados** 
   - ❌ NO uses: "sin especificar", "ejemplo.com", "Negocio sin especificar", "Dueño sin especificar", valores genéricos, etc.
   - ❌ NO uses placeholders como: "[NOMBRE DEL CLIENTE]", "[EMAIL DEL CLIENTE]", "[NOMBRE DEL NEGOCIO]", "[TELÉFONO DE CONTACTO]"
   - ❌ NO inventes datos que el cliente no haya proporcionado
   - ❌ NO asumas información que no esté explícitamente en la conversación
   - ✅ SOLO usa datos que el cliente haya proporcionado explícitamente
   - ⚠️ **CRÍTICO**: Si llamas a una herramienta con placeholders o datos inventados, la herramienta fallará y causará errores

2. **SIEMPRE pregunta al cliente por cada parámetro requerido ANTES de llamar a la herramienta**
   - NO llames a la herramienta hasta tener TODOS los parámetros requeridos con datos REALES del cliente
   - NO uses valores por defecto si faltan parámetros
   - ⚠️ **CRÍTICO**: Si no tienes TODOS los datos requeridos con valores reales del cliente, NO llames a la herramienta. En su lugar, pregunta por los datos faltantes.

3. **Pregunta UN dato a la vez** de forma natural y conversacional
   - Espera la respuesta del cliente antes de preguntar el siguiente dato
   - No preguntes múltiples datos en un solo mensaje

4. **VERIFICA antes de ejecutar**: Antes de llamar a una herramienta, verifica que TODOS los parámetros requeridos sean datos reales proporcionados por el cliente

5. **Maneja datos parciales**: Si el cliente proporciona algunos datos pero faltan otros, pregunta por los que faltan. NO asumas valores por defecto.

**FLUJO PASO A PASO OBLIGATORIO:**

**Paso 1: Identificar necesidad**
- El cliente expresa una necesidad (ej: "quiero crear una cuenta", "necesito programar una cita")

**Paso 2: Identificar herramienta**
- Revisa la lista de herramientas disponibles arriba
- Identifica qué herramienta es apropiada para la solicitud

**Paso 3: Revisar parámetros requeridos**
- Lee la lista de parámetros requeridos de esa herramienta (ver lista arriba)
- Anota qué datos necesitas del cliente

**Paso 4: Preguntar por datos (UNO A LA VEZ)**
- Pregunta al cliente por el primer parámetro requerido
- Ejemplo: "¡Perfecto! Te ayudo con eso. ¿Cuál es el nombre de tu negocio?"
- ESPERA la respuesta del cliente

**Paso 5: Continuar preguntando**
- Una vez que tengas la respuesta, pregunta por el siguiente parámetro requerido
- Repite hasta tener TODOS los parámetros requeridos

**Paso 6: Verificar datos completos ANTES de llamar**
- Antes de ejecutar, verifica que tienes TODOS los parámetros requeridos
- Verifica que todos son datos REALES del cliente (no placeholders, no valores genéricos)
- ⚠️ **CRÍTICO**: Si encuentras CUALQUIER placeholder como "[NOMBRE DEL CLIENTE]" o "[EMAIL DEL CLIENTE]", NO llames a la herramienta
- ⚠️ **CRÍTICO**: Si faltan datos o son placeholders, pregunta al cliente en lugar de llamar a la herramienta

**Paso 7: Ejecutar herramienta SOLO con datos reales**
- SOLO cuando tengas todos los datos reales (sin placeholders), llama a la herramienta
- Si tienes placeholders o datos faltantes, NO llames a la herramienta - pregunta primero
- Incorpora los resultados de manera natural en tu respuesta

**EJEMPLO DE FLUJO CORRECTO:**
Cliente: "Quiero crear una cuenta"
Agente: "¡Perfecto! Te ayudo a crear tu cuenta. ¿Cuál es el nombre de tu negocio?"
Cliente: "Mi negocio se llama Ewaffle"
Agente: "Excelente. ¿Y cómo te llamas tú (dueño/responsable)?"
Cliente: "Alvaro Villena"
Agente: "Perfecto. ¿Cuál es tu email de contacto?"
Cliente: "alvaro@ewaffle.cl"
Agente: "¿Y tu teléfono? (con código de país, ej: +56912345678)"
Cliente: "+56920115198"
Agente: (AHORA SÍ ejecuta la herramienta con los datos reales)

**INCORPORACIÓN NATURAL:**
- Después de usar una herramienta, incorpora los resultados de manera natural en tu respuesta
- **NO MENCIONES LA HERRAMIENTA**: No menciones que estás usando una herramienta técnica, simplemente proporciona la información obtenida o confirma la acción realizada

**MANEJO DE ERRORES:**
- Si una herramienta falla, continúa con la conversación de manera natural sin mencionar el error técnico
- Ofrece una alternativa apropiada si la herramienta no puede completar la acción`;
      }
    } catch (error) {
      console.warn('⚠️ [MCP] Error loading MCP tools:', error);
    }

    // Generate contextual instructions (without custom instructions first)
    let contextualInstructions = generateContextualInstructions(
      conversationContext.conversationHistory,
      conversationContext.businessName,
      undefined // Don't include custom instructions here, we'll add them after tools
    );
    
    // Append tools information FIRST if available (so it's prominent)
    if (toolsInfo) {
      contextualInstructions += toolsInfo;
    }
    
    // THEN append custom instructions (system prompt) so it has context of available tools
    if (config.customInstructions) {
      contextualInstructions += `\n\nINSTRUCCIONES PERSONALIZADAS DEL AGENTE:\n${config.customInstructions}`;
    }

    // Analyze conversation for repetition patterns
    const repetitionPatterns = LeadScoringService.detectRepetition(conversationContext);
    
    // Calculate lead score
    const leadScoringData = LeadScoringService.calculateLeadScore(
      conversationContext.lastMessage,
      conversationContext
    );

    // Determine intent and next action
    const intent = LeadScoringService.determineIntent(
      conversationContext.lastMessage,
      conversationContext
    );

    const nextAction = LeadScoringService.determineNextAction(
      leadScoringData.currentScore,
      intent,
      conversationContext
    );

    // Build conversation context for AI
    const conversationText = conversationContext.conversationHistory
      .map(msg => `${msg.role === 'user' ? '👤 Cliente' : '🤖 Asistente'}: ${msg.content}`)
      .join('\n');

    const userPrompt = `Analiza esta conversación y genera una respuesta estructurada:

CONVERSACIÓN:
${conversationText}

MENSAJE ACTUAL DEL CLIENTE:
${conversationContext.lastMessage}

CONTEXTO:
- Tiempo desde último mensaje: ${conversationContext.timeSinceLastMessage} minutos
- Patrones de repetición detectados: ${repetitionPatterns.join(', ') || 'ninguno'}

INSTRUCCIONES:
${contextualInstructions}

ESCALA DE PUNTUACIÓN DE LEADS (1-7):
1. Contact Received - Contacto inicial del cliente
2. Answers 1 Question - Cliente responde a la primera pregunta
3. Confirms Interest - Cliente muestra interés en el servicio/producto
4. Milestone Met - Hito específico del negocio alcanzado
5. Reminder Sent - Recordatorio de seguimiento enviado al cliente
6. Reminder Answered - Cliente responde al seguimiento
7. Sales Done - Venta completada o trato cerrado

${conversationContext.milestoneTarget ? `🎯 MILESTONE OBJETIVO DE ESTA CONVERSACIÓN:
- Target: ${conversationContext.milestoneTarget === 'link_shared' ? 'Link Shared (compartir enlace)' : 
  conversationContext.milestoneTarget === 'meeting_scheduled' ? 'Meeting Scheduled (agendar reunión)' :
  conversationContext.milestoneTarget === 'demo_booked' ? 'Demo Booked (reservar demo)' :
  `Custom: ${conversationContext.milestoneCustomTarget || 'N/A'}`}
- Estado: ${conversationContext.milestoneStatus === 'pending' ? 'PENDIENTE (no alcanzado)' : 
  conversationContext.milestoneStatus === 'achieved' ? 'ALCANZADO ✅' :
  conversationContext.milestoneStatus === 'failed' ? 'FALLIDO ❌' : 'Desconocido'}

⚠️ REGLA CRÍTICA DE SCORING BASADA EN MILESTONE:
${conversationContext.milestoneStatus === 'pending' ? `
El milestone objetivo NO ha sido alcanzado aún. 
Por lo tanto, el leadScore MÁXIMO que puedes asignar es 4 (Milestone Met).
NO asignes scores 5, 6 o 7 hasta que el milestone objetivo sea alcanzado.
El score 5 (Reminder Sent) solo debe asignarse cuando realmente se envía un reminder.
` : conversationContext.milestoneStatus === 'achieved' ? `
El milestone objetivo YA ha sido alcanzado.
Puedes asignar cualquier score de 1 a 7 según corresponda.
` : `
El milestone objetivo ha fallado.
Puedes asignar cualquier score de 1 a 7 según corresponda, pero considera el contexto.
`}
` : ''}

${functions.length > 0 ? `🚨 REGLA CRÍTICA SOBRE HERRAMIENTAS MCP - LEE ANTES DE LLAMAR CUALQUIER HERRAMIENTA:

ANTES de llamar a cualquier herramienta MCP, VERIFICA que:
1. ✅ Tienes TODOS los parámetros requeridos
2. ✅ Cada parámetro tiene un valor REAL del cliente (no placeholders, no valores genéricos)
3. ✅ NO hay ningún texto que contenga "[", "]" o palabras como "NOMBRE DEL CLIENTE", "EMAIL DEL CLIENTE", "NOMBRE DEL NEGOCIO", "TELÉFONO DE CONTACTO"

❌ EJEMPLOS DE LO QUE NO DEBES HACER (causarán errores):
- name: "[NOMBRE DEL CLIENTE]" ❌
- email: "[EMAIL DEL CLIENTE]" ❌
- businessName: "[NOMBRE DEL NEGOCIO]" ❌
- phone: "[TELÉFONO DE CONTACTO]" ❌

✅ EJEMPLOS DE LO QUE SÍ DEBES HACER:
- name: "Juan Pérez" ✅
- email: "juan@ejemplo.com" ✅
- businessName: "Mi Negocio" ✅
- phone: "+56912345678" ✅

⚠️ SI DETECTAS CUALQUIER PLACEHOLDER O DATO FALTANTE:
- NO llames a la herramienta
- Pregunta al cliente por los datos faltantes
- Solo cuando tengas TODOS los datos reales, llama a la herramienta

Las herramientas están disponibles pero SOLO funcionarán con datos REALES del cliente.` : ''}

Después de usar herramientas si es necesario, responde con el siguiente JSON VÁLIDO:
{
  "responseText": "string",
  "leadScore": number (1-7),
  "intent": "string",
  "nextAction": "string",
  "confidence": number (0-1),
  "metadata": {
    "greetingUsed": boolean,
    "previousContextReferenced": boolean,
    "businessNameUsed": "string"
  }
}`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: contextualInstructions },
      { role: 'user', content: userPrompt }
    ];

    // Use the functions already loaded above
    let functionCall: 'none' | 'auto' | { name: string } = functions.length > 0 ? 'auto' : 'none';

    // Use a model that supports tools. Default to gpt-4o-mini which has excellent tool support
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const baseMaxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '200');
    // Increase max_tokens when tools are available to allow for tool calls and responses
    const maxTokens = functions.length > 0 ? Math.max(baseMaxTokens, 500) : baseMaxTokens;

    const requestConfig: any = {
      model: modelName,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    };

    // Add functions if MCP tools are available
    if (functions.length > 0) {
      requestConfig.tools = functions.map(fn => ({
        type: 'function',
        function: fn
      }));
      requestConfig.tool_choice = functionCall;
      console.log(`🔧 [OpenAI] Added ${functions.length} tools to structured response request`);
      console.log(`🔧 [OpenAI] Using model: ${modelName} (supports tools)`);
      console.log(`🔧 [OpenAI] Increased max_tokens to ${maxTokens} to accommodate tool calls`);
    }

    let response = await openai.chat.completions.create(requestConfig);
    
    // Handle function calls if any
    const toolCalls = response.choices[0]?.message?.tool_calls || [];
    if (toolCalls.length > 0) {
      console.log(`🔧 [MCP] Processing ${toolCalls.length} tool call(s)`);
      
      // Execute tool calls
      const toolResults = [];
      for (const toolCall of toolCalls) {
        if (toolCall.type === 'function') {
          try {
            const parameters = JSON.parse(toolCall.function.arguments || '{}');
            const result = await mcpService.executeTool(toolCall.function.name, parameters);
            
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              name: toolCall.function.name,
              content: JSON.stringify(result.success ? result.result : { error: result.error })
            });
          } catch (error: any) {
            console.error(`❌ [MCP] Error executing tool ${toolCall.function.name}:`, error);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              name: toolCall.function.name,
              content: JSON.stringify({ error: error.message })
            });
          }
        }
      }
      
      // Add tool results to messages and get final response
      messages.push(response.choices[0].message as ChatCompletionMessageParam);
      messages.push(...toolResults);
      
      // Get final response with tool results
      const finalModelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const finalMaxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '200');
      const finalRequestConfig: any = {
        model: finalModelName,
        messages,
        max_tokens: finalMaxTokens,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      };
      
      if (functions.length > 0) {
        finalRequestConfig.tools = requestConfig.tools;
        finalRequestConfig.tool_choice = 'none'; // Don't allow more tool calls in final response
      }
      
      response = await openai.chat.completions.create(finalRequestConfig);
    }

    const aiResponse = response.choices[0]?.message?.content || '';
    console.log('🤖 Raw AI response:', aiResponse);

    // Parse and validate JSON response
    let structuredResponse: StructuredResponse;
    try {
      const parsedResponse = JSON.parse(aiResponse);
      
      if (validateStructuredResponse(parsedResponse)) {
        structuredResponse = parsedResponse;
      } else {
        console.warn('⚠️ Invalid structured response format, using fallback');
        structuredResponse = createFallbackStructuredResponse(conversationContext, leadScoringData);
      }
    } catch (parseError) {
      console.error('❌ Error parsing AI response as JSON:', parseError);
      structuredResponse = createFallbackStructuredResponse(conversationContext, leadScoringData);
    }

    // Enhance with metadata (but let AI determine its own lead score)
    structuredResponse.metadata.leadProgression = leadScoringData.progression;
    structuredResponse.metadata.repetitionDetected = repetitionPatterns.length > 0;

    // CRITICAL: Validate and limit lead score based on milestone objective
    // This ensures the AI's assigned score respects the milestone constraints
    const maxAllowedScore = LeadScoringService.getMaxAllowedLeadScore(
      conversationContext.milestoneTarget,
      conversationContext.milestoneStatus
    );
    
    if (structuredResponse.leadScore > maxAllowedScore) {
      console.log(`⚠️ [OpenAI Service] AI assigned score ${structuredResponse.leadScore} exceeds maximum allowed (${maxAllowedScore}) based on milestone. Adjusting.`, {
        milestoneTarget: conversationContext.milestoneTarget,
        milestoneStatus: conversationContext.milestoneStatus,
        originalScore: structuredResponse.leadScore,
        adjustedScore: maxAllowedScore
      });
      structuredResponse.leadScore = maxAllowedScore;
    }
    
    // SPECIAL RULE: Score 5 (Reminder Sent) validation
    // Score 5 should only be assigned when a reminder is actually sent
    if (structuredResponse.leadScore === 5 && conversationContext.milestoneStatus === 'pending') {
      // Check if milestone allows score 5 (it shouldn't if milestone is pending)
      if (maxAllowedScore <= 4) {
        console.log(`⚠️ [OpenAI Service] AI assigned score 5 (Reminder Sent) but milestone is pending. Adjusting to 4.`);
        structuredResponse.leadScore = 4;
      }
    }

    console.log('✅ Structured response generated successfully:', {
      leadScore: structuredResponse.leadScore,
      intent: structuredResponse.intent,
      nextAction: structuredResponse.nextAction,
      milestoneTarget: conversationContext.milestoneTarget,
      milestoneStatus: conversationContext.milestoneStatus,
      maxAllowedScore
    });

    return structuredResponse;

  } catch (error) {
    console.error('❌ Error generating structured response:', error);
    
    // Return fallback structured response
    return createDefaultResponse();
  }
}

/**
 * Create fallback structured response when AI fails
 */
function createFallbackStructuredResponse(
  conversationContext: ConversationContext,
  leadScoringData: any
): StructuredResponse {
  const isFirstMessage = conversationContext.conversationHistory.length === 1;
  const timeSinceLastMessage = conversationContext.timeSinceLastMessage;
  
  let responseText = "Gracias por tu mensaje. Un miembro de nuestro equipo te responderá pronto.";
  
  if (isFirstMessage || timeSinceLastMessage > 30) {
    responseText = `Hola, gracias por contactarnos. ¿En qué podemos ayudarte?`;
  } else {
    responseText = `Perfecto, te ayudo con eso. ¿Necesitas más información?`;
  }

  return {
    responseText,
    leadScore: leadScoringData.currentScore,
    intent: 'inquiry',
    nextAction: 'follow_up',
    confidence: 0.5,
    metadata: {
      greetingUsed: isFirstMessage || timeSinceLastMessage > 30,
      previousContextReferenced: false,
      businessNameUsed: conversationContext.businessName
    }
  };
}

// Fallback response generation when AI is unavailable
function generateFallbackResponse(context: any): string {
  try {
    const lastUserMessage = context.conversationHistory
      .filter((msg: any) => msg.role === 'user')
      .pop()?.content?.toLowerCase() || '';

    // Simple keyword-based responses
    if (lastUserMessage.includes('hola') || lastUserMessage.includes('buenos días') || lastUserMessage.includes('buenas')) {
      return '¡Hola! 👋 Gracias por contactarnos. ¿En qué puedo ayudarte hoy?';
    }
    
    if (lastUserMessage.includes('precio') || lastUserMessage.includes('costo') || lastUserMessage.includes('cotización')) {
      return 'Te ayudo con información sobre precios 💰. ¿Podrías contarme más sobre tu proyecto?';
    }
    
    if (lastUserMessage.includes('soporte') || lastUserMessage.includes('ayuda') || lastUserMessage.includes('problema')) {
      return 'Entiendo que necesitas ayuda 🆘. Un agente se pondrá en contacto contigo pronto.';
    }
    
    if (lastUserMessage.includes('gracias') || lastUserMessage.includes('thanks')) {
      return '¡De nada! 😊 Estoy aquí para ayudarte. ¿Hay algo más en lo que pueda asistirte?';
    }
    
    if (lastUserMessage.includes('web') || lastUserMessage.includes('sitio') || lastUserMessage.includes('página')) {
      return '¡Perfecto! 🌐 Somos expertos en desarrollo web. ¿Qué tipo de sitio necesitas?';
    }
    
    if (lastUserMessage.includes('marketing') || lastUserMessage.includes('publicidad') || lastUserMessage.includes('promocionar')) {
      return '¡Excelente! 📈 El marketing digital es clave para el crecimiento. ¿Qué objetivos tienes?';
    }
    
    // Default response
    return 'Gracias por tu mensaje 👍. Un agente revisará tu consulta y te responderá pronto.';
    
  } catch (error) {
    console.error('❌ Error generating fallback response:', error);
    return 'Gracias por contactarnos. Te responderemos pronto.';
  }
}

// Analyze user intent from message
export async function analyzeUserIntent(message: string): Promise<{
  intent: string;
  confidence: number;
  keywords: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high';
}> {
  try {
    console.log('🔍 Analyzing user intent with AI');

    const systemPrompt = `Eres un experto en análisis de intenciones de usuario. 
Analiza el mensaje del cliente y determina:
1. La intención principal (consulta, cotización, soporte, etc.)
2. El nivel de confianza (0-100)
3. Palabras clave importantes
4. El sentimiento (positive, neutral, negative)
5. La urgencia (low, medium, high)

Responde SOLO con un JSON válido.`;

    const userPrompt = `Analiza este mensaje del cliente:
"${message}"

Responde con este formato JSON:
{
  "intent": "string",
  "confidence": number,
  "keywords": ["string"],
  "sentiment": "positive|neutral|negative",
  "urgency": "low|medium|high"
}`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages,
      max_tokens: 200,
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content || '';
    
    try {
      const analysis = JSON.parse(content);
      console.log('✅ User intent analysis completed');
      return analysis;
    } catch (parseError) {
      console.error('❌ Error parsing AI response:', parseError);
      return generateFallbackIntentAnalysis(message);
    }

  } catch (error) {
    console.error('❌ Error analyzing user intent:', error);
    return generateFallbackIntentAnalysis(message);
  }
}

// Fallback intent analysis when AI is unavailable
function generateFallbackIntentAnalysis(message: string): {
  intent: string;
  confidence: number;
  keywords: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high';
} {
  const text = message.toLowerCase();
  
  // Simple keyword-based analysis
  let intent = 'general_inquiry';
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  let urgency: 'low' | 'medium' | 'high' = 'medium';
  const keywords: string[] = [];

  // Intent detection
  if (text.includes('precio') || text.includes('costo') || text.includes('cotización')) {
    intent = 'pricing_inquiry';
    keywords.push('precio', 'costo', 'cotización');
  } else if (text.includes('soporte') || text.includes('ayuda') || text.includes('problema')) {
    intent = 'support_request';
    urgency = 'high';
    keywords.push('soporte', 'ayuda', 'problema');
  } else if (text.includes('web') || text.includes('sitio') || text.includes('página')) {
    intent = 'service_inquiry';
    keywords.push('web', 'sitio', 'página');
  } else if (text.includes('marketing') || text.includes('publicidad')) {
    intent = 'service_inquiry';
    keywords.push('marketing', 'publicidad');
  }

  // Sentiment detection
  if (text.includes('gracias') || text.includes('excelente') || text.includes('perfecto')) {
    sentiment = 'positive';
  } else if (text.includes('problema') || text.includes('error') || text.includes('urgente')) {
    sentiment = 'negative';
    urgency = 'high';
  }

  // Urgency detection
  if (text.includes('urgente') || text.includes('asap') || text.includes('inmediato')) {
    urgency = 'high';
  } else if (text.includes('cuando') || text.includes('tiempo') || text.includes('planificar')) {
    urgency = 'low';
  }

  return {
    intent,
    confidence: 70, // Medium confidence for fallback
    keywords,
    sentiment,
    urgency
  };
}

//Free Preview
export async function generateSession(input: any) {
  console.log("--- generateSession ---")
  try {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `Eres un consultor experto en diseño de cursos e-learning, storytelling y estrategia con IA. 
        Ayudas a expertos y profesionales a transformar su conocimiento en propuestas de cursos e-learning claros, atractivos y listos para escalar con inteligencia artificial. 
        Tu objetivo es crear una transformación tangible y profesional. 
        Tu estilo debe ser inspirador, claro y accionable. 
        El output debe generar deseo inmediato de pasar a la versión Pro.
        La respuesta debe ser en español.
        RESPONDE SOLO CON UN OBJETO JSON VÁLIDO. NO INCLUYAS NINGÚN TEXTO, EXPLICACIÓN, NI MARKDOWN FUERA DEL JSON. Si incluyes texto fuera del JSON, la respuesta será rechazada.`
      },
      {
        role: 'user',
        content: `
    DATOS DEL EXPERTO:
    Nombre: ${input.nombre}
    Email: ${input.email}
    Tema/Servicio: ${input.servicio}
    Fortalezas: ${input.fortalezas}
    Audiencia objetivo: ${input.audiencia}
    Resultados esperados: ${input.resultados}
    
    Por favor, responde usando esta estructura:
    { 
        "propuesta_valor": "Texto de 3 a 5 líneas claro y persuasivo. Explica por qué este curso e-learning es único y la oportunidad de potenciarlo con IA.",
        "descripcion_potencia_ia": "Texto de 5 a 7 líneas sobre cómo la IA puede potenciar el curso e-learning del experto. Incluye 1 o 2 ejemplos concretos en relacion al experto su tematica y como su experiencia de aprendizaje particular seria mejorada con el uso de la IA.",
        "ideas_IA": [
          "Idea concreta basadas en el contenido propuesto 1 de cómo usar IA para potenciar el curso e-learning, deben ser cosas básicas fáciles de implementar que el experto pueda utilizar para potencias su experiencia de aprendizaje en 1 o 2 líneas. ",
          ...
          "Idea 5-7"
        ],
        "mapa_servicio": {
          "titulo_servicio": "Nombre poderoso y comercial para el curso e-learning",
          "modulos": [
            { "nombre": "Módulo 1: [Tema principal basado en el conocimiento del experto]", "descripcion": "Breve descripción del módulo y su objetivo." },
            { "nombre": "Módulo 2: [Tema complementario]", "descripcion": "Breve descripción del módulo y su objetivo." },
            { "nombre": "Módulo 3: [Tema avanzado o aplicación práctica]", "descripcion": "Breve descripción del módulo y su objetivo." },
            { "nombre": "Módulo 4: [Cierre, evaluación o escalabilidad]", "descripcion": "Breve descripción del módulo y su objetivo." }
          ]
        },
        "prompt_ejemplo": [
          { "modulo": "Módulo 1: Diagnóstico", "prompt": "Prompt para diagnóstico..." },
          { "modulo": "Módulo 2: Propuesta", "prompt": "Prompt para propuesta..." }
        ]
      }
    `
      }
    ]

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
    })

    console.log("--- Response Generated ---")
    console.log(response.choices[0].message?.content)

    return {
      id: uuid(),
      valueProp: response.choices[0].message?.content || '',
      isPaid: false
    }
  } catch (error) {
    console.error('Error in generateSession:', error)
    throw error
  }
}

//Premium Session
export async function generatePremiumSession(input: {
  servicio: string;
  fortalezas: string;
  audiencia: string;
  resultados: string;
  preview: {
    propuesta_valor: string;
    descripcion_potencia_ia: string;
    ideas_IA: string[];
  };
}) {

  console.log("--- generatePremiumSession ---")
  

  // Prompt mejorado
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `
Eres un consultor experto en diseño de cursos e-learning. Recibes la parte gratuita (preview) y debes generar la estructura completa del plan premium. Responde SOLO en JSON válido, SIN texto adicional. 
El campo 'premium' debe contener solo los datos premium, no repitas la parte gratuita. 
La respuesta debe ser en español.
No dejes ningún campo vacío ni como objeto vacío. Llena todos los campos con ejemplos realistas y detallados.

Para cada módulo, incluye los siguientes campos:
- nombre: nombre del módulo
- descripcion: breve descripción del módulo y su objetivo
- objetivo_aprendizaje: objetivo de aprendizaje claro y medible para el módulo
- sugerencias_contenido: lista de contenidos y actividades relevantes y actualizados, basados en el tema del módulo
- como_usar_ia: explicación de cómo se puede usar la IA en ese módulo para mejorar la experiencia de aprendizaje (ej: generación de ejercicios, feedback automático, personalización, etc.)
- procesos_internos: pasos o tareas que el experto debe preparar o realizar para esa clase (ej: preparar materiales, configurar herramientas, revisar entregas, etc.)
- tipos_recurso: tipos de recurso recomendados (ej: video, ebook, quiz, foro, etc.)
- duracion_semanas: duración sugerida del módulo en semanas

La estructura debe ser exactamente la siguiente (rellena todos los campos):
{
  "premium": {
    "propuesta_valor_pro": {
      "bio": "Instructor experto en [tema]. Destacado por ${input.fortalezas} para lograr ${input.resultados}.",
      "imagen_alt": "Imagen de una clase online con estudiantes participando activamente."
    },
    "mapa_servicio": {
      "titulo_servicio": "Nombre comercial y atractivo para el curso e-learning",
      "modulos": [
        {
          "nombre": "Módulo 1: [Tema principal]",
          "descripcion": "Breve descripción del módulo y su objetivo.",
          "objetivo_aprendizaje": "Objetivo de aprendizaje claro y medible para el módulo.",
          "sugerencias_contenido": ["Video introductorio sobre [tema]", "Lectura recomendada sobre [tema]", "Ejercicio práctico relacionado con [tema]"],
          "como_usar_ia": "Explica cómo el experto puede usar IA en este módulo, por ejemplo: generación de ejercicios personalizados, feedback automático, análisis de progreso, etc.",
          "procesos_internos": "Pasos que el experto debe preparar para esta clase, como crear materiales, configurar la plataforma, revisar entregas, etc.",
          "tipos_recurso": ["Video masterclass", "PDF descargable", "Quiz interactivo"],
          "duracion_semanas": 2
        },
        {
          "nombre": "Módulo 2: [Tema complementario]",
          "descripcion": "Breve descripción del módulo y su objetivo.",
          "objetivo_aprendizaje": "Objetivo de aprendizaje claro y medible para el módulo.",
          "sugerencias_contenido": ["Caso de estudio actualizado", "Foro de discusión sobre [tema]"],
          "como_usar_ia": "Explica cómo la IA puede ayudar a analizar casos o moderar foros, etc.",
          "procesos_internos": "Preparar el caso, moderar el foro, recopilar preguntas frecuentes, etc.",
          "tipos_recurso": ["Video", "Foro", "Checklist"],
          "duracion_semanas": 1
        },
        {
          "nombre": "Módulo 3: [Aplicación práctica]",
          "descripcion": "Breve descripción del módulo y su objetivo.",
          "objetivo_aprendizaje": "Objetivo de aprendizaje claro y medible para el módulo.",
          "sugerencias_contenido": ["Proyecto final basado en [tema]", "Feedback personalizado usando IA"],
          "como_usar_ia": "Explica cómo la IA puede ayudar a dar feedback automático o personalizar el proyecto.",
          "procesos_internos": "Revisar proyectos, configurar rúbricas de evaluación, usar herramientas de IA para feedback, etc.",
          "tipos_recurso": ["Plantilla editable", "Video feedback"],
          "duracion_semanas": 2
        },
        {
          "nombre": "Módulo 4: [Cierre y evaluación]",
          "descripcion": "Breve descripción del módulo y su objetivo.",
          "objetivo_aprendizaje": "Objetivo de aprendizaje claro y medible para el módulo.",
          "sugerencias_contenido": ["Evaluación final", "Certificado de participación"],
          "como_usar_ia": "Explica cómo la IA puede generar evaluaciones automáticas y certificados personalizados.",
          "procesos_internos": "Preparar la evaluación, configurar la entrega de certificados, analizar resultados, etc.",
          "tipos_recurso": ["Quiz", "Certificado PDF"],
          "duracion_semanas": 1
        }
      ]
    },
    "prompt_ejemplo": [
      {
        "modulo": "Módulo 1: [Tema principal]",
        "prompt": "Crea un prompt para ChatGPT que ayude al instructor a generar una introducción atractiva para el módulo, incluyendo objetivos de aprendizaje y actividades sugeridas."
      },
      {
        "modulo": "Módulo 2: [Tema complementario]",
        "prompt": "Crea un prompt para diseñar un caso de estudio relevante y preguntas para el foro de discusión."
      },
      {
        "modulo": "Módulo 3: [Aplicación práctica]",
        "prompt": "Crea un prompt para guiar a los estudiantes en la realización de un proyecto final y cómo recibir feedback personalizado."
      },
      {
        "modulo": "Módulo 4: [Cierre y evaluación]",
        "prompt": "Crea un prompt para generar una evaluación final y un mensaje de cierre motivador para los estudiantes."
      }
    ],
    "infografia": {
      "titulo": "Mapa del curso e-learning",
      "secciones": ["Diagnóstico", "Cierre de venta", "Acompañamiento", "Seguimiento"],
      "contenido": [
        "Evaluación inicial física y emocional del alumno para conocer su estado y necesidades.",
        "Presentación de una propuesta personalizada y cierre de inscripción.",
        "Clases semanales de yoga adaptadas a las necesidades del grupo.",
        "Evaluación mensual del progreso y ajuste de objetivos."
      ],
      "cta": "Aprende más sobre el curso e-learning"
    },
    "checklist_servicio": {
      "titulo": "Checklist de Calidad para tu Curso e-learning",
      "items": [
        "¿Cada módulo tiene objetivos claros?",
        "¿Incluyes recursos variados (video, texto, ejercicios)?",
        "¿Hay actividades prácticas y evaluaciones?",
        "¿El contenido es accesible y fácil de seguir?",
        "¿Ofreces feedback o soporte a los estudiantes?"
      ],
      "formato": "Editable en Notion y Google Docs"
    },
    "landing_page": {
      "url": "https://ewaffle.com/tu-curso",
      "contenido": {
        "pv_destacada": "Transforma tu conocimiento en resultados con este curso e-learning.",
        "modulos": ["Módulo 1: Introducción", "Módulo 2: Profundización", "Módulo 3: Práctica", "Módulo 4: Evaluación"],
        "testimonio_destacado": "'Este curso cambió mi forma de aprender y aplicar nuevos conocimientos.'",
        "cta": "Inscríbete ahora y lleva tu aprendizaje al siguiente nivel"
      }
    }
  }
}
\nIMPORTANTE: prompt_ejemplo debe ser SIEMPRE un array de objetos, nunca un string. Cada campo debe estar completo y realista.`
    },
    {
      role: 'user',
      content: `Aquí está la parte gratuita que ya generamos:\n${JSON.stringify(input.preview, null, 2)}\n\nAhora completa la parte "premium" usando la estructura y ejemplo anterior. No dejes ningún campo vacío ni como objeto vacío. Llena todos los campos con ejemplos realistas y detallados.`
    }
  ];

  const resp = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages
  });

  const jsonText = resp.choices[0].message?.content || '{}';
  const data = JSON.parse(jsonText);
  console.log("--- Data Generates---")
  return data.premium;
}

