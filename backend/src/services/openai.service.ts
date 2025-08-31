import OpenAI from 'openai'
import { v4 as uuid } from 'uuid'
import dotenv from 'dotenv'
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

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
}): Promise<string> {
  try {
    console.log('🤖 Generating Instagram DM response with AI');

    const systemPrompt = `Eres un asistente virtual profesional y amigable para una empresa de servicios digitales. 
    
Tu objetivo es:
- Proporcionar respuestas útiles y profesionales
- Mantener un tono amigable pero profesional
- Ayudar a calificar leads y entender necesidades del cliente
- Dirigir consultas complejas a agentes humanos cuando sea necesario
- Responder en el idioma del usuario (español por defecto)

Contexto de la empresa:
- Somos expertos en desarrollo web, marketing digital y consultoría tecnológica
- Ayudamos a empresas a crecer digitalmente
- Ofrecemos servicios personalizados y soluciones a medida

Instrucciones:
- Responde de manera natural y conversacional
- Sé útil pero no demasiado largo (máximo 2-3 frases)
- Si detectas una consulta compleja, sugiere que un agente se pondrá en contacto
- Mantén el tono profesional pero cercano
- Usa emojis ocasionalmente para hacer la conversación más amigable`;

    const userPrompt = `Por favor, genera una respuesta natural para este mensaje del cliente:

Contexto de la conversación:
${context.conversationHistory.map(msg => 
  `${msg.role === 'user' ? '👤 Cliente' : '🤖 Asistente'}: ${msg.content}`
).join('\n')}

Información adicional:
- Intención del usuario: ${context.userIntent || 'No especificada'}
- Tema de conversación: ${context.conversationTopic || 'General'}
- Sentimiento: ${context.userSentiment || 'neutral'}
- Empresa del cliente: ${context.businessContext?.company || 'No especificada'}
- Sector: ${context.businessContext?.sector || 'No especificado'}
- Servicios de interés: ${context.businessContext?.services?.join(', ') || 'No especificados'}

Genera una respuesta natural, útil y profesional que:
1. Responda directamente a la consulta del cliente
2. Sea apropiada para el contexto de la conversación
3. Mantenga un tono profesional pero amigable
4. No sea demasiado larga (máximo 2-3 frases)
5. Use el idioma ${context.language || 'español'}

Respuesta:`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages,
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '150'),
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    const aiResponse = response.choices[0]?.message?.content || '';
    
    console.log('✅ Instagram DM response generated successfully');
    return aiResponse.trim();

  } catch (error) {
    console.error('❌ Error generating Instagram DM response:', error);
    
    // Fallback to simple rule-based response
    return generateFallbackResponse(context);
  }
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
      model: process.env.OPENAI_MODEL || 'gpt-4',
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
      model: 'gpt-4',
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
    model: 'gpt-4',
    messages
  });

  const jsonText = resp.choices[0].message?.content || '{}';
  const data = JSON.parse(jsonText);
  console.log("--- Data Generates---")
  return data.premium;
}

