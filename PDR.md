# PDR – Moca: Instagram DM Agent con Backend y Back Office

## 1. Propósito

Diseñar e implementar un **agente de Instagram DM** que maneje la comunicación con leads de manera ordenada, evitando spam, consolidando mensajes, y permitiendo a un equipo revisar y gestionar conversaciones desde un **back office simple**. Toda la lógica se centraliza en un **backend con base de datos**, eliminando dependencias externas.

Se debe utilizar la estreuctura existente, intentando preservar lo máximo posible.

## 2. Funcionalidades Clave

### A) Recepción de mensajes (entrantes)

* Recibir mensajes entrantes desde el **webhook de Meta (Instagram Graph API)**.
* **Responder 200 OK inmediato** para evitar reintentos de Meta.
* Guardar mensajes en base de datos (conversaciones, leads, histórico).
* Aplicar **deduplicación** por `mid` (id único de mensaje de Meta).
* Aplicar **debounce** (ej: si el usuario envía 2–3 mensajes en pocos segundos, consolidarlos en uno solo).
* Verificar **cooldown**: si el bot ya respondió recientemente (ej: últimos 7s), no enviar otra respuesta.

### B) Procesamiento de mensajes

* Una vez consolidado el mensaje:

  * Evaluar si corresponde responder (reglas + decisión de IA).
  * Si corresponde → generar respuesta (con AI Agent o reglas backend).
  * Guardar la respuesta planificada en la **cola de salida**.

### C) Envío de respuestas (salientes)

* Gestionar la **cola de salida** (`outbound_queue`).
* Respetar **rate limits globales** (ej: no más de 3 mensajes por segundo).
* Respetar **locks por usuario (PSID)** para no intercalar respuestas.
* En caso de errores 429/613 (rate limits), aplicar **retry con backoff**.
* Registrar respuestas enviadas en el historial de mensajes.

### D) Gestión de contactos y conversaciones

* Cada `psid` se guarda como **contacto** con información enriquecida (nombre, sector, email si se obtiene, etc.).
* Cada contacto tiene una **conversación activa** con estado (`open`, `scheduled`, `closed`).
* Las conversaciones guardan timestamps (`last_user_at`, `last_bot_at`, `cooldown_until`).
* Se puede buscar, listar y filtrar conversaciones desde el back office.

### E) Back Office (funcionalidades mínimas)

* **Lista de conversaciones**: ver contactos abiertos y última interacción.
* **Vista de conversación**: timeline de mensajes (usuario/bot), opción de enviar mensaje manual.
* **Panel de configuración**: editar parámetros básicos (cooldown, debounce, rate, token IG).
* Autenticación inicial simple (ej: `x-admin-token` en requests).

## 3. Roles de Usuario

* **Bot automático**: Responde según reglas y decisiones de IA.
* **Administrador** (Back Office): Puede ver conversaciones, enviar mensajes manuales y cambiar configuraciones.

## 4. Reglas de Negocio

* **No duplicar respuestas**: un mismo `mid` no debe generar más de una respuesta.
* **Debounce**: varios mensajes en menos de 3–4s se consolidan como uno.
* **Cooldown**: si el bot respondió hace menos de 7s, no responde otra vez.
* **Pacing**: no más de X mensajes por segundo globalmente.
* **Retry**: si IG devuelve error de límite, reintentar con backoff.
* **Idempotencia**: cada acción debe ser repetible sin efectos secundarios.

## 5. Flujo del Sistema

### Entrante

1. Usuario envía DM → llega a **webhook del backend**.
2. Backend responde 200 OK inmediato a Meta.
3. Backend:

   * Upsert contacto/conversación.
   * Guarda mensaje (si `mid` no existe).
   * Actualiza documento `debounce` (ttl 3–4s).

### Debounce Worker

4. Pasados 3–4s → consolida mensajes de un `psid` en un solo texto.
5. Verifica cooldown.
6. Llama a lógica de decisión (IA o reglas simples).
7. Si `send=true` → guarda mensajes en `outbound_queue`.

### Sender Worker

8. Cada \~250ms revisa `outbound_queue`.
9. Si hay mensajes pendientes y se cumple pacing:

   * Envía a IG API.
   * Marca mensaje como enviado y guarda en historial.
   * Actualiza `last_bot_at` y `cooldown_until` en la conversación.

### Back Office

10. Admin accede vía UI.
11. Puede:

    * Ver lista de conversaciones activas.
    * Abrir timeline de un contacto.
    * Enviar mensaje manual (entra a la `outbound_queue`).
    * Editar configuraciones (cooldown, debounce, token IG).

## 6. Datos Principales

* **contacts**: info de usuarios (psid único).
* **conversations**: estado actual de cada contacto.
* **messages**: historial (rol: user/assistant/system).
* **outbound\_queue**: mensajes pendientes de enviar.
* **debounce**: mensajes temporales en ventana de espera.
* **accounts**: datos de la cuenta IG (token, settings).

## 7. Integraciones

* **Instagram Graph API** para enviar mensajes (`/me/messages`).
* **MongoDB** como base de datos principal.
* **OpenAI (u otro modelo IA)** para generación de respuestas.

## 8. Interfaz de Usuario (MVP)

### Pantallas

* **Login simple** (token admin).
* **Conversations list**: tabla con PSID, última interacción, estado.
* **Conversation detail**: timeline + input de texto para enviar manual.
* **Settings**: formularios para editar tokens y parámetros.

### Requisitos UX

* UI limpia, responsive básica.
* Timeline con roles diferenciados (usuario/bot).
* Feedback inmediato cuando se envía manual.

## 9. Restricciones

* IG API tiene límites de velocidad y ventanas de 24h para respuestas → respetar.
* El token de acceso se debe refrescar cada 60 días (planificar job).

## 10. Criterios de Aceptación

* Mensajes duplicados no generan respuestas múltiples.
* Múltiples mensajes seguidos del mismo usuario en menos de 4s se consolidan.
* Cooldown evita spam (ej: 2 mensajes en 5s → solo una respuesta).
* Outbound respetando pacing (<5 msgs/sec) y retry en errores 429.
* Back office permite listar, ver timeline, enviar manual y cambiar configuraciones.

---

👉 Este PDR está escrito en clave **funcional**: describe cómo debe comportarse el sistema desde el punto de vista del negocio/usuario. La implementación técnica (Node/Mongo/Next.js) se desprende directamente de este documento.
