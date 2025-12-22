# ANÁLISIS SISTÉMICO: Confusión del Bot con Servicios del Lead

## RESUMEN EJECUTIVO

**Problema Identificado**: El bot confunde los servicios mencionados por el lead (the.wonder.cl) como si fueran sus propios servicios, respondiendo "Tenemos tres tratamientos disponibles: Lipo sin cirugía, Hifu 12d MPT y Privilege" cuando en realidad esos son los servicios que EL LEAD está ofreciendo.

**Sospecha Adicional**: El usuario sospecha que cuando inicializa una conversación con "Hola", no se está almacenando correctamente.

---

## ANÁLISIS POR CAPAS DEL SISTEMA

### CAPA 1: PROMPT ENGINEERING & INSTRUCCIONES DEL AGENTE

#### Problema Identificado
El prompt actual está diseñado para **Álvaro Villena prospectando negocios**, pero el bot está siendo usado en un contexto donde **un negocio (the.wonder.cl) está respondiendo a un lead**.

**Análisis del Prompt Actual**:
```
"Tu función es ayudar a iniciar conversaciones 1:1 de forma humana, breve y respetuosa cuando Álvaro escribe 'Hola' a otras cuentas."
```

**Problemas Específicos**:

1. **Falta de Claridad sobre Roles**:
   - El prompt no distingue claramente entre:
     - Servicios que el bot/negocio ofrece
     - Servicios que el lead menciona
   - No hay instrucciones explícitas que digan: "NUNCA menciones servicios que el cliente haya mencionado como si fueran tuyos"

2. **Falta de Instrucciones de Contexto**:
   - No hay validación de quién inició la conversación
   - No hay detección de si el lead está ofreciendo servicios vs. preguntando por servicios
   - El prompt asume que siempre es Álvaro iniciando, pero en la imagen parece que el lead está respondiendo

3. **Conflicto de Flujo**:
   - El prompt tiene un flujo específico (PASO 1, PASO 2, PASO 3) para cuando Álvaro dice "Hola"
   - Pero no maneja el caso donde el lead responde con información sobre SUS servicios
   - El bot debería reconocer: "Este mensaje contiene servicios que el CLIENTE ofrece, no yo"

#### Mejoras Sugeridas en Capa de Prompt

**A. Agregar Reglas Explícitas de Distinción de Servicios**:
```
REGLAS CRÍTICAS SOBRE SERVICIOS Y PRODUCTOS:

1. NUNCA menciones servicios, productos o tratamientos que el cliente haya mencionado como si fueran tuyos
   - ❌ INCORRECTO: "Tenemos tres tratamientos disponibles: [servicios que el cliente mencionó]"
   - ✅ CORRECTO: "Entiendo que ofreces [servicios del cliente]. Nosotros ayudamos a negocios como el tuyo a..."

2. SIEMPRE distingue entre:
   - Lo que TÚ ofreces (sistema de respuesta automática de DMs)
   - Lo que el CLIENTE ofrece (sus servicios/productos)

3. Si el cliente menciona sus servicios/productos:
   - Reconoce que son SUS servicios
   - NO los repitas como si fueran tuyos
   - Enfócate en cómo puedes ayudarle con TU servicio
```

**B. Agregar Detección de Contexto de Conversación**:
```
DETECCIÓN DE CONTEXTO:

1. Si el cliente menciona servicios/productos en su mensaje:
   - Identifica que son servicios DEL CLIENTE
   - Responde reconociendo sus servicios
   - Luego presenta TU servicio (sistema de DMs automáticos)

2. Si el cliente pregunta por servicios:
   - Responde con TUS servicios (sistema de DMs automáticos)
   - NO menciones servicios que el cliente haya mencionado previamente
```

**C. Mejorar el Flujo de Conversación**:
```
FLUJO MEJORADO:

PASO 1 — Insight + contexto  
(Se envía SOLO cuando Álvaro dice "Hola" y la otra persona responde)

SI el lead menciona SUS servicios/productos en su respuesta:
- Reconoce: "Veo que ofreces [servicios del lead]"
- NO repitas esos servicios como si fueran tuyos
- Continúa con el mensaje de insight sobre respuesta rápida de DMs

SI el lead solo responde "Hola" o similar:
- Envía el mensaje de insight normalmente
```

---

### CAPA 2: CONTEXTO Y CONVERSATION HISTORY

#### Problema Identificado
El sistema recupera el historial de conversación, pero puede haber problemas en cómo se construye y almacena.

**Análisis del Código** (`debounceWorker.service.ts:433-438`):
```typescript
private async getConversationHistory(conversationId: string): Promise<IMessage[]> {
  return await Message.find({
    conversationId,
    role: { $in: ['user', 'assistant'] }
  }).sort({ 'metadata.timestamp': 1 });
}
```

**Problemas Potenciales**:

1. **Orden de Mensajes**:
   - Se ordena por `metadata.timestamp`, pero si hay problemas de sincronización, el orden podría estar incorrecto
   - Si el mensaje "Hola" de Álvaro no se guardó correctamente, el bot no sabrá quién inició

2. **Falta de Validación de Inicio de Conversación**:
   - No hay verificación explícita de quién dijo "Hola" primero
   - El bot asume contexto basado en el historial, pero si falta el primer mensaje, se confunde

3. **Construcción del Contexto** (`debounceWorker.service.ts:377-390`):
```typescript
conversationHistory: conversationHistory
  .filter(msg => msg.role !== 'system')
  .map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content.text,
    timestamp: msg.metadata.timestamp
  }))
```
   - Se filtra correctamente, pero no hay validación de que el historial esté completo
   - Si falta el primer mensaje "Hola", el bot no tiene contexto de inicio

#### Mejoras Sugeridas en Capa de Contexto

**A. Validación de Historial Completo**:
```typescript
private async validateConversationHistory(
  conversationHistory: IMessage[]
): Promise<{ isValid: boolean; missingFirstMessage?: boolean }> {
  // Verificar que existe al menos un mensaje
  if (conversationHistory.length === 0) {
    return { isValid: false, missingFirstMessage: true };
  }
  
  // Verificar que el primer mensaje es del usuario (lead) o asistente (bot)
  const firstMessage = conversationHistory[0];
  if (!firstMessage || !firstMessage.content?.text) {
    return { isValid: false, missingFirstMessage: true };
  }
  
  return { isValid: true };
}
```

**B. Detección de Servicios del Cliente**:
```typescript
private detectClientServices(message: string): string[] {
  // Detectar si el mensaje contiene servicios/productos que el cliente menciona
  // Esto ayudaría a distinguir entre servicios del cliente vs. servicios del bot
  const servicePatterns = [
    /(ofrecemos|tenemos|disponemos|contamos con)\s+([^\.]+)/gi,
    /(servicios?|productos?|tratamientos?)\s*:?\s*([^\.]+)/gi
  ];
  
  // Retornar servicios detectados para que el prompt pueda distinguirlos
}
```

**C. Mejora en Construcción de Contexto para el Prompt**:
```typescript
// Agregar al conversationContext información sobre servicios mencionados
const clientServices = this.detectClientServices(conversationContext.lastMessage);
const conversationContext: ConversationContext = {
  // ... campos existentes
  clientMentionedServices: clientServices, // NUEVO
  conversationInitiatedBy: this.detectConversationInitiator(conversationHistory) // NUEVO
};
```

---

### CAPA 3: PROCESAMIENTO DE MENSAJES Y ALMACENAMIENTO

#### Problema Identificado
El usuario sospecha que cuando inicializa una conversación con "Hola", no se está almacenando correctamente.

**Análisis del Flujo de Almacenamiento** (`instagramWebhook.service.ts:423-533`):

1. **Proceso de Mensaje**:
   ```typescript
   private async processMessage(messageData: InstagramMessage): Promise<void>
   ```
   - Crea/actualiza contacto
   - Crea/obtiene conversación
   - Crea mensaje

2. **Creación de Conversación** (`instagramWebhook.service.ts:716-773`):
   ```typescript
   private async getOrCreateConversation(contactId: string, accountId: string)
   ```
   - Busca conversación existente con status 'open' o 'scheduled'
   - Si no existe, crea una nueva

**Problemas Potenciales**:

1. **Mensajes Echo (del Bot)**:
   - Si Álvaro envía "Hola" desde la app de Instagram, podría llegar como `is_echo: true`
   - El código actual filtra mensajes echo, pero podría haber casos edge

2. **Timing de Almacenamiento**:
   - Si hay un delay entre recibir el webhook y almacenar el mensaje, el bot podría procesar antes de que se guarde
   - El debounce worker podría ejecutarse antes de que el mensaje esté completamente guardado

3. **Falta de Logging de Mensajes Iniciales**:
   - No hay logging específico que indique claramente cuando se guarda el primer "Hola"
   - Difícil debuggear si falta el mensaje inicial

#### Mejoras Sugeridas en Capa de Almacenamiento

**A. Logging Mejorado**:
```typescript
// En processMessage, agregar logging específico para mensajes iniciales
if (messageData.text?.toLowerCase().trim() === 'hola') {
  console.log(`🎯 [Webhook] FIRST MESSAGE DETECTED: "Hola" from ${messageData.psid}`);
  console.log(`📝 [Webhook] Message details:`, {
    mid: messageData.mid,
    is_echo: messageData.is_echo,
    timestamp: messageData.timestamp
  });
}
```

**B. Validación de Mensajes Echo**:
```typescript
// Verificar explícitamente si es un mensaje del bot vs. del usuario
if (messageData.is_echo) {
  console.log(`🤖 [Webhook] Echo message detected, skipping processing`);
  return; // No procesar mensajes echo
}
```

**C. Verificación de Persistencia**:
```typescript
// Después de crear el mensaje, verificar que se guardó correctamente
const savedMessage = await Message.findById(message.id);
if (!savedMessage) {
  console.error(`❌ [Webhook] Message not persisted correctly: ${message.id}`);
  throw new Error('Message persistence failed');
}
console.log(`✅ [Webhook] Message persisted successfully: ${savedMessage.id}`);
```

---

### CAPA 4: GENERACIÓN DE RESPUESTAS (OpenAI Service)

#### Problema Identificado
El servicio de OpenAI no tiene instrucciones explícitas para distinguir servicios del cliente vs. servicios del bot.

**Análisis del Código** (`openai.service.ts:275-304`):

El userPrompt actual incluye:
```typescript
- Servicios de interés: ${context.businessContext?.services?.join(', ') || 'No especificados'}
```

Pero esto es para servicios que el cliente está interesado, no para servicios que el cliente OFRECE.

**Problemas Específicos**:

1. **Falta de Análisis Semántico**:
   - El prompt no analiza si el mensaje del cliente contiene servicios que ÉL ofrece
   - No hay instrucciones para extraer y distinguir estos servicios

2. **Confusión en el Prompt**:
   - La línea "Si el cliente menciona información nueva (como tipo de negocio), incorpórala en tu respuesta"
   - Esto podría hacer que el bot incorpore servicios del cliente como si fueran propios

3. **Falta de Validación Pre-Respuesta**:
   - No hay validación que verifique si la respuesta generada contiene servicios que el cliente mencionó

#### Mejoras Sugeridas en Capa de Generación

**A. Análisis Pre-Generación**:
```typescript
// Antes de generar la respuesta, analizar el mensaje del cliente
const clientServices = this.extractClientServices(lastMessage.content);
const clientOfferingServices = this.detectServiceOffering(lastMessage.content);

// Agregar al prompt información explícita
const serviceContext = clientServices.length > 0 
  ? `\n⚠️ IMPORTANTE: El cliente mencionó estos servicios/productos que ÉL ofrece: ${clientServices.join(', ')}. NO los menciones como si fueran tuyos.`
  : '';
```

**B. Validación Post-Generación**:
```typescript
// Después de generar la respuesta, validar que no contiene servicios del cliente
const generatedServices = this.extractServicesFromResponse(aiResponse);
const containsClientServices = generatedServices.some(service => 
  clientServices.some(clientService => 
    service.toLowerCase().includes(clientService.toLowerCase())
  )
);

if (containsClientServices) {
  console.warn(`⚠️ [OpenAI] Generated response contains client services, regenerating...`);
  // Regenerar con instrucciones más explícitas
}
```

**C. Instrucciones Mejoradas en el Prompt**:
```typescript
const userPrompt = `Por favor, genera una respuesta natural para este mensaje del cliente:

${clientServices.length > 0 ? `
⚠️ REGLA CRÍTICA: El cliente mencionó estos servicios/productos que ÉL ofrece:
${clientServices.map(s => `- ${s}`).join('\n')}

NUNCA menciones estos servicios como si fueran tuyos. En su lugar:
1. Reconoce que son servicios del cliente
2. Enfócate en cómo puedes ayudarle con TU servicio (sistema de DMs automáticos)
` : ''}

Mensaje actual del cliente:
👤 Cliente: ${lastMessage?.content || 'Sin mensaje'}
...
`;
```

---

### CAPA 5: DETECCIÓN DE INTENCIÓN Y LEAD SCORING

#### Problema Identificado
El sistema de detección de intención no distingue entre "cliente ofreciendo servicios" vs. "cliente preguntando por servicios".

**Análisis del Código** (`leadScoring.service.ts` - referencia indirecta):

El sistema actual detecta intenciones como:
- `inquiry` - consulta general
- `pricing_inquiry` - consulta de precios
- `service_inquiry` - consulta de servicios

Pero no tiene:
- `service_offering` - cliente ofreciendo sus servicios
- `business_pitch` - cliente haciendo pitch de su negocio

#### Mejoras Sugeridas en Capa de Intención

**A. Nueva Categoría de Intención**:
```typescript
// Agregar detección de "cliente ofreciendo servicios"
const detectServiceOffering = (message: string): boolean => {
  const offeringPatterns = [
    /(ofrecemos|tenemos|disponemos|contamos con)\s+[^\.]+/gi,
    /(nuestros?|mis)\s+(servicios?|productos?|tratamientos?)\s+(son|incluyen|son:)/gi,
    /(servicios?|productos?|tratamientos?)\s*:?\s*[^\.]+/gi
  ];
  
  return offeringPatterns.some(pattern => pattern.test(message));
};

// Si detecta que el cliente está ofreciendo servicios, marcar intención especial
if (detectServiceOffering(message)) {
  intent = 'client_service_offering';
  // Esto debería activar un flujo diferente en el prompt
}
```

**B. Actualización del Prompt Basado en Intención**:
```typescript
// En generateStructuredResponse, agregar lógica basada en intención
if (intent === 'client_service_offering') {
  contextualInstructions += `
  
⚠️ CONTEXTO ESPECIAL: El cliente está ofreciendo SUS servicios/productos.
- NO repitas esos servicios como si fueran tuyos
- Reconoce sus servicios brevemente
- Enfócate en cómo puedes ayudarle con TU servicio
`;
}
```

---

## DIAGNÓSTICO DE CONVERSACIÓN INICIAL NO ALMACENADA

### Hipótesis sobre el Problema de Almacenamiento

**Escenario 1: Mensaje Echo No Filtrado**
- Si Álvaro envía "Hola" desde la app, Instagram podría enviarlo como echo
- El código debería filtrarlo, pero podría haber un bug

**Escenario 2: Race Condition**
- El webhook recibe el mensaje
- El debounce worker se ejecuta antes de que el mensaje se guarde completamente
- El bot procesa sin el contexto del "Hola" inicial

**Escenario 3: Conversación Existente**
- Si ya existe una conversación abierta, el sistema podría estar usando esa conversación
- El mensaje "Hola" podría estar en una conversación diferente o no guardarse si hay un error

### Verificación Sugerida

**A. Agregar Logging Detallado**:
```typescript
// En instagramWebhook.service.ts, processMessage
console.log(`📥 [Webhook] Processing message:`, {
  mid: messageData.mid,
  text: messageData.text,
  is_echo: messageData.is_echo,
  psid: messageData.psid,
  timestamp: messageData.timestamp,
  conversationExists: !!conversation,
  conversationId: conversation?.id
});

// Después de crear mensaje
console.log(`✅ [Webhook] Message created:`, {
  messageId: message.id,
  conversationId: conversation.id,
  role: message.role,
  content: message.content.text
});
```

**B. Verificar Historial Completo**:
```typescript
// En debounceWorker, antes de generar respuesta
const history = await this.getConversationHistory(conversation.id);
console.log(`📋 [DebounceWorker] Conversation history:`, {
  conversationId: conversation.id,
  messageCount: history.length,
  firstMessage: history[0] ? {
    role: history[0].role,
    content: history[0].content.text.substring(0, 50),
    timestamp: history[0].metadata.timestamp
  } : 'NO FIRST MESSAGE',
  lastMessage: history[history.length - 1] ? {
    role: history[history.length - 1].role,
    content: history[history.length - 1].content.text.substring(0, 50)
  } : 'NO LAST MESSAGE'
});
```

---

## PLAN DE ACCIÓN RECOMENDADO

### Prioridad ALTA (Resolver Inmediatamente)

1. **Agregar Reglas Explícitas al Prompt**:
   - Agregar sección "REGLAS CRÍTICAS SOBRE SERVICIOS" al prompt
   - Instruir explícitamente a nunca mencionar servicios del cliente como propios

2. **Mejorar Detección de Servicios del Cliente**:
   - Implementar función `detectClientServices()` que extraiga servicios mencionados por el cliente
   - Pasar esta información al prompt para que el bot pueda distinguir

3. **Agregar Validación Post-Generación**:
   - Después de generar respuesta, verificar que no contiene servicios del cliente
   - Si los contiene, regenerar con instrucciones más explícitas

### Prioridad MEDIA (Mejoras Importantes)

4. **Mejorar Logging de Mensajes Iniciales**:
   - Agregar logging específico para mensajes "Hola"
   - Verificar persistencia después de guardar

5. **Validar Historial Completo**:
   - Antes de generar respuesta, verificar que el historial está completo
   - Si falta el primer mensaje, usar contexto alternativo

6. **Mejorar Detección de Intención**:
   - Agregar categoría `client_service_offering`
   - Ajustar flujo basado en esta intención

### Prioridad BAJA (Optimizaciones)

7. **Optimizar Construcción de Contexto**:
   - Mejorar cómo se pasa el contexto al prompt
   - Agregar metadata sobre servicios mencionados

8. **Mejorar Manejo de Conversaciones Existentes**:
   - Verificar si hay conversaciones abiertas antes de crear nueva
   - Asegurar que el historial se mantiene correcto

---

## CONCLUSIÓN

El problema principal es una **falta de distinción explícita** entre servicios que el cliente ofrece vs. servicios que el bot ofrece. Esto se debe a:

1. **Prompt Engineering**: Falta de reglas explícitas sobre cómo manejar servicios mencionados por el cliente
2. **Análisis de Contexto**: No se detecta ni extrae información sobre servicios que el cliente ofrece
3. **Validación**: No hay validación que prevenga que el bot mencione servicios del cliente como propios

La sospecha sobre almacenamiento de conversaciones iniciales es válida y requiere mejor logging y validación para diagnosticar correctamente.

**Recomendación Principal**: Implementar las mejoras de Prioridad ALTA primero, ya que resuelven directamente el problema reportado.

