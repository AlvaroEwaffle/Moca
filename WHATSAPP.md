# WhatsApp Cloud API — módulo oficial de Moca

Canal oficial de WhatsApp sobre Meta Cloud API para **un número dedicado**, reutilizando el motor existente de IA, scoring, debounce y cola de salida. Instagram no cambia.

Backlog: **B4-149**. Rama: `feat/whatsapp-cloud-api`.

> **Por qué oficial y no Baileys.** Espresso usa Baileys (sesión no oficial vía QR). Meta bloqueó uno de los números que operaba por ahí. Cloud API es la vía soportada: no se cae por reconexión, no arriesga el número y expone estados de entrega reales. Espresso queda intacto — este módulo no lo toca ni lo migra.

---

## 1. Arquitectura

El principio de diseño es que **WhatsApp entra al mismo pipeline que Instagram**, no a uno paralelo.

```
Meta Cloud API
      │  POST /api/whatsapp/webhook   (firma X-Hub-Signature-256)
      ▼
whatsappWebhook.service
      │  normaliza → Contact(waId) → Conversation(channel) → Message(mid=wamid)
      ▼
debounceWorker.triggerMessageCollection(conversationId, message)   ← misma puerta que Instagram
      │
      ├── debounce · IA · lead scoring · milestones · límites   (sin cambios)
      ▼
OutboundQueue { channel: 'whatsapp' }
      ▼
senderWorker  →  getChannelAdapter(channel)
                      ├── InstagramAdapter  → instagramApi.service
                      └── WhatsappAdapter   → whatsappCloudApi.service
```

`triggerMessageCollection` recibe un `IMessage`, no un payload de Instagram. Esa costura ya era agnóstica de canal; el webhook de WhatsApp normaliza y la llama igual. Por eso IA, scoring y cola funcionan sin tocarse.

### Clave del modelo de datos

`accountId` es un `string` sin `ref` de Mongoose en Conversation/Message/OutboundQueue. Se reutiliza:

| Canal | `accountId` contiene | Colección de cuentas |
|---|---|---|
| `instagram` | `InstagramAccount.accountId` | `instagramaccounts` |
| `whatsapp` | `WhatsappAccount.phoneNumberId` | `whatsappaccounts` |

`phoneNumberId` es también lo que Meta manda en `value.metadata.phone_number_id`, así que el ruteo del webhook es un lookup directo, sin tabla de traducción.

### Migración: aditiva, sin backfill

`channel` se agregó con `default: 'instagram'` en Conversation, Message y OutboundQueue. Los documentos existentes **no tienen el campo**, y Mongoose aplica el default al hidratarlos — se leen como `instagram` y siguen enviando exactamente igual. No hay script de migración porque no hace falta (cubierto por test).

| Modelo | Campos nuevos |
|---|---|
| `Conversation` | `channel`, `timestamps.lastInboundAt` |
| `Message` | `channel`, `metadata.whatsappResponse.{messageId,status,timestamp,errorCode,errorMessage}` |
| `OutboundQueue` | `channel` |
| `Contact` | `waId` (+ índice único parcial `{waId, channel}`) |
| `WhatsappAccount` | modelo nuevo |

`waId` es deliberadamente distinto de `phone`: `phone` lo escribe el extractor de contactos leyendo el cuerpo de los mensajes, `waId` lo dice Meta. Separarlos evita que un typo extraído redirija un envío.

---

## 2. Deduplicación

`Message.mid` ya era `unique: true`. Instagram manda `mid.*`, WhatsApp manda `wamid.*` — ambos globalmente únicos, ambos caen ahí. **Ese índice es el mecanismo de deduplicación**, no hizo falta campo nuevo.

Meta reintenta cualquier webhook que no responda 200 rápido. El flujo es: `findOne({mid})` → si existe, corta antes de crear contacto, conversación o respuesta. Si dos entregas corren en paralelo y pasan las dos el `findOne`, el índice único rechaza la segunda con `E11000` y el handler lo trata como resultado esperado, no como error.

---

## 3. Ventana de servicio de 24 horas

Meta solo permite texto libre dentro de las 24h desde el último mensaje **entrante** del contacto. Fuera de eso hace falta una plantilla aprobada — **fuera de alcance de este MVP**.

- `Conversation.timestamps.lastInboundAt` se estampa en cada inbound.
- `isWithinServiceWindow()` (en `whatsapp.adapter.ts`) es la única fuente de verdad; se exporta para UI y tests.
- El chequeo ocurre **antes** de llamar a Meta. Un envío rechazado cuenta contra el *quality rating* del número, así que "probar a ver" no es gratis — y el error es terminal igualmente.
- Si está cerrada: `ChannelSendError{permanent: true, code: 'window_closed'}` → el item muere en el primer intento, con el motivo escrito en `metadata.errorHistory`. No quema los 3 reintentos contra un muro.
- La UI lo muestra antes de que el operador escriba (badge en la lista, banner en el detalle) y la API rechaza el envío manual con 409.

Los follow-ups proactivos a WhatsApp fallan por diseño cuando la ventana está cerrada: reenganchar requiere plantilla.

---

## 4. Estados de entrega

`sent → delivered → read`, más `failed`. Meta **no garantiza orden**: un `sent` tardío puede llegar después de `read`.

Los estados están rankeados (`sent`=1, `delivered`=2, `read`=3, `failed`=4) y **solo avanzan**. Sin eso, un callback viejo degradaría un mensaje ya leído. La correlación es por `wamid` contra `metadata.whatsappResponse.messageId`.

En `failed` se guardan `errorCode` y `errorMessage` y se notifica a Slack.

---

## 5. Errores: permanente vs reintentable

Cada adapter decide sobre su propia API — antes esto era string-matching en el sender worker.

**Permanentes** (no se reintentan): `131026` destinatario no recibe · `131047` fuera de ventana · `131051` tipo no soportado · `132000/132001/132005/132007/132012` plantillas · `133010` número no registrado · contacto sin `waId`.

**Reintentables**: red, rate limit (`130429`), token vencido (`190`, marcado `code: 'auth'`), 5xx.

Instagram conserva textual sus dos casos permanentes (`The requested user cannot be found`, `outside of allowed window` / subcode `2534022`).

---

## 6. Configuración

### 6.1 Lo que hay que tener en Meta

Este es el **camino crítico** — es trámite administrativo y puede tardar días. No depende del código.

1. Meta Business verificado.
2. WhatsApp Business Account (WABA).
3. Número dedicado, **no registrado en la app de WhatsApp** (el que se usó en Espresso/Baileys no sirve sin liberarlo primero).
4. En la app de Meta: producto *WhatsApp* → obtener **Phone Number ID** y **WABA ID**.
5. **System User token** con permisos `whatsapp_business_messaging` + `whatsapp_business_management`.
6. **App Secret** (Configuración → Básica).
7. Webhook: URL `https://<host>/api/whatsapp/webhook`, verify token propio, y **suscribirse al campo `messages`** (trae mensajes y estados).

### 6.2 Variables de entorno

```bash
WHATSAPP_VERIFY_TOKEN=<string propio, el mismo que se pega en Meta>
WHATSAPP_APP_SECRET=<App Secret>       # o META_APP_SECRET si se comparte con Instagram
WHATSAPP_GRAPH_VERSION=v21.0           # opcional
```

El token de acceso **no** va en env: vive por cuenta en `WhatsappAccount.accessToken`, para poder onboardear un segundo número sin redeploy.

### 6.3 Dar de alta el número

```bash
curl -X POST https://<host>/api/whatsapp/accounts \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumberId": "<Phone Number ID>",
    "wabaId": "<WABA ID>",
    "displayPhoneNumber": "+56 9 XXXX XXXX",
    "accountName": "Ewaffle WhatsApp",
    "accessToken": "<System User token>",
    "settings": { "aiEnabled": "test", "defaultAgentEnabled": false }
  }'
```

> Arrancar con `aiEnabled: "test"` y `defaultAgentEnabled: false`: la IA genera respuestas y las deja visibles **sin enviarlas**. Se revisa el tono contra el número real antes de soltar el agente. Igual que se hizo con Instagram.

Verificar credenciales:

```bash
curl https://<host>/api/whatsapp/accounts/<phoneNumberId>/test-connection \
  -H "Authorization: Bearer <JWT>"
```

---

## 7. Endpoints

| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| GET | `/api/whatsapp/webhook` | verify token | Handshake de Meta |
| POST | `/api/whatsapp/webhook` | firma HMAC | Inbound + estados |
| POST | `/api/whatsapp/accounts` | JWT | Alta de número |
| GET | `/api/whatsapp/accounts` | JWT | Lista (sin credenciales) |
| PUT | `/api/whatsapp/accounts/:phoneNumberId` | JWT | Actualiza |
| PUT | `/api/whatsapp/accounts/:phoneNumberId/ai-enabled` | JWT | `off` / `test` / `on` |
| GET | `/api/whatsapp/accounts/:phoneNumberId/test-connection` | JWT | Valida token+número |
| GET | `/api/whatsapp/conversations` | JWT | Lista + estado de ventana |
| GET | `/api/whatsapp/conversations/:id` | JWT | Detalle + mensajes |
| PUT | `/api/whatsapp/conversations/:id/agent` | JWT | **Handoff**: pausa/reanuda IA |
| POST | `/api/whatsapp/conversations/:id/messages` | JWT | Respuesta manual (409 si la ventana está cerrada) |

Las credenciales nunca se devuelven: `accessToken`, `appSecret` y `verifyToken` están excluidos de las respuestas.

---

## 8. Handoff humano

1. `PUT /conversations/:id/agent {enabled:false}` → la IA deja de responder (`settings.aiEnabled`, mismo flag que Instagram).
2. `POST /conversations/:id/messages` → la respuesta manual pasa por la **misma cola** que la IA, con rate limiting y estados de entrega.
3. `PUT /conversations/:id/agent {enabled:true}` → la IA retoma.

En la UI: badge de canal en lista y detalle, aviso de ventana cerrada, y el toggle existente enruta al endpoint del canal correcto.

---

## 9. Tests

```bash
cd backend && npx vitest run
```

| Archivo | Cubre |
|---|---|
| `whatsappWebhook.test.ts` | firma (válida/inválida/alterada/largo distinto/sin secreto), handshake, alta de contacto+conversación+mensaje, dedup de webhook repetido, reuso de conversación, `phone_number_id` no registrado, timestamps UNIX, tipos no-texto, estados y orden |
| `channelAdapters.test.ts` | routing del adapter (incluye default sin campo), ventana 24h en los bordes, permanente vs reintentable, aislamiento de metadata por canal |
| `senderWorkerChannels.test.ts` | envío WhatsApp end-to-end, **Instagram sin regresión**, item legacy sin `channel`, ventana cerrada sin llamar a Meta, reintento transitorio, cuenta faltante |

47 tests nuevos. Los 3 fallos de `googleCalendar.test.ts` son **preexistentes** — el test tiene fechas fijas de junio 2026 que ya caducaron, sin relación con este módulo.

---

## 10. Fuera de alcance

- Migración o cambios en Espresso.
- Embedded Signup / onboarding SaaS multiempresa.
- Números de clientes (solo un número propio dedicado).
- Campañas masivas y contacto proactivo fuera de ventana.
- Media (imagen, audio, documento) — llegan como placeholder `[image]`, no se descargan.
- Gestión de plantillas.
- Resto de B4-115: Platform, Capu, webhooks públicos, Swagger.

---

## 11. Antes de producción

- [ ] Activos de Meta listos (§6.1) — camino crítico
- [ ] Env vars en Railway
- [ ] Número dado de alta con `aiEnabled: "test"`
- [ ] `test-connection` OK
- [ ] Webhook verificado y suscrito a `messages`
- [ ] Smoke E2E: mensaje real → conversación única → respuesta → `delivered`/`read`
- [ ] Verificar que Instagram sigue enviando (misma cola, mismo worker)
- [ ] PRS-1
- [ ] Recién ahí: `aiEnabled: "on"`
