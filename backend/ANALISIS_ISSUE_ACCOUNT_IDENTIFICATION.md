# ANÁLISIS: Problema de Identificación de Cuenta en Conversaciones Iniciadas

## PROBLEMA IDENTIFICADO

**Fecha del Issue**: Dec 22, 2025, 10:24:02 AM GMT-3

**Escenario**:
- Usuario envía mensaje desde `chokovillena` (PSID: 17841401675262878) hacia `villelabs_` (recipient ID: 1430046868241272)
- El sistema NO encuentra el recipient ID en ninguna cuenta
- **PROBLEMA**: El sistema asigna la conversación a `ewaffle.cl` (fallback) en lugar de `chokovillena` (cuenta que inició)

## ANÁLISIS DE LOGS

### Logs Relevantes (líneas 553-585):

```
📨 Processing message from PSID: 17841401675262878 (chokovillena)
🔧 [Webhook] Message recipient ID: 1430046868241272 (villelabs_)
⚠️ [Account Identification] Page-Scoped ID 1430046868241272 not found in any account
👤 [PSID Matching] User message to fallback account: ewaffle.cl (alvaro@ewaffle.cl)
✅ Using Instagram account: ewaffle.cl (alvaro@ewaffle.cl)
```

### Problema en el Código

**Ubicación**: `instagramWebhook.service.ts:934-994` - función `identifyAccountByPSID`

**Lógica Actual**:
1. ✅ Intenta matchear por `recipientId` (pageScopedId)
2. ❌ Si no encuentra, hace fallback al primer account activo (ewaffle.cl)
3. ❌ **NO intenta matchear por SENDER PSID**

**Lógica Correcta Debería Ser**:
1. ✅ Intenta matchear por `recipientId` (pageScopedId)
2. ✅ Si no encuentra, intenta matchear por SENDER PSID (pageScopedId del sender)
3. ✅ Solo si ambos fallan, usar fallback

## CAUSA RAÍZ

Cuando un usuario envía un mensaje desde su cuenta (chokovillena) a otra cuenta (villelabs_), el `recipientId` puede no estar registrado en la base de datos si:
- La cuenta `villelabs_` no está conectada al sistema
- El `pageScopedId` de `villelabs_` no fue guardado durante OAuth
- Es una cuenta externa que no está en el sistema

En este caso, el sistema debería usar la cuenta del **SENDER** (chokovillena), no un fallback arbitrario.

## IMPACTO

1. **Conversaciones asignadas incorrectamente**: Las conversaciones iniciadas desde chokovillena se asignan a ewaffle.cl
2. **Configuración incorrecta del agente**: Se usa el prompt/configuración de ewaffle.cl en lugar de chokovillena
3. **Métricas incorrectas**: Las métricas se registran en la cuenta equivocada
4. **Confusión del usuario**: El usuario ve conversaciones en la cuenta incorrecta

## SOLUCIÓN PROPUESTA

### Cambio en `identifyAccountByPSID`:

**ANTES** (líneas 970-985):
```typescript
// If not found, this means the pageScopedId wasn't set during OAuth
console.warn(`⚠️ [Account Identification] Page-Scoped ID ${recipientId} not found in any account...`);

// Fallback to first active account
const accountWithComments = allAccounts.find(acc => acc.commentSettings?.enabled);
const account = accountWithComments || allAccounts[0];
```

**DESPUÉS**:
```typescript
// If recipientId not found, try to match by SENDER PSID
// This handles the case where a user sends a message FROM their account TO an external account
console.warn(`⚠️ [Account Identification] Page-Scoped ID ${recipientId} not found in any account. Trying to match by sender PSID...`);

// Try to match by sender PSID (the account that initiated the conversation)
for (const account of allAccounts) {
  if (psid === account.pageScopedId) {
    console.log(`👤 [Account Identification] Matched by sender PSID: ${account.accountName} (${account.userEmail})`);
    return { account, isBotMessage: false };
  }
}

// Only if sender PSID also doesn't match, use fallback
console.warn(`⚠️ [Account Identification] Sender PSID ${psid} also not found. Using fallback account.`);
const accountWithComments = allAccounts.find(acc => acc.commentSettings?.enabled);
const account = accountWithComments || allAccounts[0];
```

## CASOS DE USO CUBIERTOS

### Caso 1: Mensaje recibido (normal)
- Recipient ID existe → Usa cuenta del recipient ✅

### Caso 2: Mensaje enviado desde cuenta propia a cuenta externa
- Recipient ID NO existe → Usa cuenta del SENDER (PSID) ✅

### Caso 3: Mensaje enviado desde cuenta externa
- Recipient ID existe → Usa cuenta del recipient ✅
- Recipient ID NO existe Y Sender PSID NO existe → Usa fallback ⚠️

## VALIDACIÓN

Después del fix, los logs deberían mostrar:
```
⚠️ [Account Identification] Page-Scoped ID 1430046868241272 not found in any account
👤 [Account Identification] Matched by sender PSID: chokovillena (alvaro@chokovillena.cl)
✅ Using Instagram account: chokovillena (alvaro@chokovillena.cl)
```

## NOTAS ADICIONALES

1. **Mejora del prompt**: El usuario menciona que mejoró el prompt y la respuesta fue mejor. Esto confirma que el problema principal era la asignación incorrecta de cuenta.

2. **Registro de recipientId faltante**: El sistema debería también registrar cuando encuentra un recipientId que no está en la base de datos, para poder investigar por qué no está registrado.

3. **Eliminación de fallback**: El fallback a cuenta arbitraria ha sido ELIMINADO. Si no se puede identificar la cuenta correctamente, el mensaje NO se procesa y se registra un error crítico. Esto previene asignaciones incorrectas de conversaciones.

