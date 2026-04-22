/**
 * Native Agent Tools — first-class tools the Instagram DM agent can call.
 *
 * These bypass the external MCP client path entirely. The tool schemas here
 * are exposed as OpenAI functions; execution routes directly to the
 * corresponding Moca services (no self-HTTP round-trip, no auth headers).
 *
 * Unlike MCP tools (which ask the model for accountId), native tools
 * auto-inject conversation-scoped fields (accountId, conversationId) from
 * the agent context, so the model never has to know or guess them.
 */

import CalendarIntegration from '../models/calendarIntegration.model';
import {
  getAvailability,
  createMeetingEvent,
} from './googleCalendar.service';

export interface NativeToolContext {
  accountId: string;
  conversationId?: string;
  leadId?: string;
  contactEmail?: string;
  contactName?: string;
}

export interface NativeTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface NativeToolsBundle {
  tools: NativeTool[];
  promptAugmentation: string;
  execute: (name: string, args: any) => Promise<any>;
}

/**
 * Load calendar tools for a given account, only when the integration is
 * connected and enabled. Returns null otherwise — callers should treat a null
 * return as "this capability is not available for this account".
 */
export async function loadCalendarToolsForAccount(
  ctx: NativeToolContext
): Promise<NativeToolsBundle | null> {
  const integration = await CalendarIntegration.findOne({ accountId: ctx.accountId });

  if (!integration || integration.status !== 'connected' || !integration.enabled) {
    return null;
  }

  // Tool schemas — NO accountId here (we inject it server-side).
  const tools: NativeTool[] = [
    {
      name: 'get_calendar_availability',
      description:
        'Consulta slots disponibles en el Google Calendar del negocio para agendar una reunión con el lead. ' +
        'Respeta horario laboral, buffer y eventos ya agendados. ' +
        'Úsala ANTES de proponer horarios al lead. Nunca inventes disponibilidad.',
      parameters: {
        type: 'object',
        properties: {
          fromIso: {
            type: 'string',
            description:
              'Inicio del rango a consultar en ISO 8601. Ej: "2026-04-22T00:00:00-04:00". Usa "ahora" si el lead quiere lo antes posible.',
          },
          toIso: {
            type: 'string',
            description:
              'Fin del rango a consultar en ISO 8601. Debe ser mayor que fromIso y como máximo 30 días después. Recomendado: próximos 7-14 días.',
          },
          durationMin: {
            type: 'number',
            description:
              'Duración de cada slot en minutos. Opcional — si se omite usa el default configurado por el negocio.',
          },
        },
        required: ['fromIso', 'toIso'],
      },
    },
    {
      name: 'schedule_meeting',
      description:
        'Crea un evento en Google Calendar con enlace de Google Meet y envía invitación por email al lead. ' +
        'Úsala SOLO cuando tengas confirmación explícita del lead + su email válido + un horario de la lista de disponibilidad. ' +
        'Devuelve meetLink — inclúyelo en tu respuesta al lead.',
      parameters: {
        type: 'object',
        properties: {
          attendeeName: {
            type: 'string',
            description: 'Nombre del lead (required). Si no lo sabes, pídelo antes por DM.',
          },
          attendeeEmail: {
            type: 'string',
            description: 'Email del lead (required, formato válido). Pídelo por DM si no lo tienes.',
          },
          startIso: {
            type: 'string',
            description:
              'Inicio del evento en ISO 8601 (required). Debe venir de get_calendar_availability — NO inventes horarios.',
          },
          topic: {
            type: 'string',
            description: 'Tema de la reunión para el invite. Ej: "Demo producto", "Consulta comercial".',
          },
        },
        required: ['attendeeName', 'attendeeEmail', 'startIso'],
      },
    },
  ];

  const promptAugmentation = `

📅 AGENDAMIENTO DE REUNIONES (Google Calendar conectado)

Tienes acceso a estas herramientas nativas:
- **get_calendar_availability**: consulta slots libres del negocio. Pasa fromIso y toIso en ISO 8601. NO pidas accountId — ya está inyectado.
- **schedule_meeting**: crea reunión con Meet + envía invite por email. Requiere attendeeName, attendeeEmail y startIso.

🚨 REGLA DE EJECUCIÓN CRÍTICA — LEE DOS VECES 🚨
Estas herramientas se invocan vía **tool_calls** (function calling de OpenAI).
NO son valores de string. NUNCA escribas "get_calendar_availability" ni "schedule_meeting" dentro del campo \`nextAction\` del JSON de respuesta — eso NO ejecuta nada.

✅ Forma CORRECTA de usar la herramienta:
  → Produces un tool_call con name="get_calendar_availability" y arguments JSON.
  → El sistema ejecutará la función y te devolverá los slots reales.
  → Recién ENTONCES generas el JSON de respuesta final.

❌ Forma INCORRECTA (lo que NO debes hacer):
  → Responder con JSON que tenga \`"nextAction": "get_calendar_availability"\` sin haber hecho el tool_call.
  → Eso solo reporta intención, NO agenda nada, y el lead nunca recibe invite.

El campo \`nextAction\` del JSON es un valor genérico de tracking ("follow_up", "schedule_meeting", "qualify", etc). Nunca un nombre de función literal.

CUÁNDO AGENDAR:
✅ Lead muestra intención clara de avanzar ("me interesa", "cuándo podemos hablar", "quiero una demo", "cuánto cuesta").
✅ Lead pide directamente una llamada o reunión.
❌ NO propongas agendar en el primer mensaje — entiende contexto primero.
❌ NO agendes si el lead solo está preguntando info general.

FLUJO (OBLIGATORIO respetar el orden):
1. Detecta intención → emite **tool_call a get_calendar_availability** (rango: próximos 7-14 días, horario laboral). NO respondas texto todavía.
2. Recibes slots reales → ofrece al lead 2-3 horarios concretos de la lista devuelta.
3. Cuando confirme un horario, pide su **nombre + email** si no los tienes.
4. Con los datos completos, emite **tool_call a schedule_meeting** con el startIso exacto del slot confirmado.
5. Recibes el resultado con \`meetLink\` → compártelo con el lead en tu respuesta final.

REGLA CRÍTICA: NUNCA inventes horarios. Usa solo los que devuelve get_calendar_availability (via tool_call, no via nextAction).`;

  const execute = async (name: string, args: any): Promise<any> => {
    switch (name) {
      case 'get_calendar_availability': {
        if (!args?.fromIso) throw new Error('fromIso is required');
        if (!args?.toIso) throw new Error('toIso is required');

        const result = await getAvailability(ctx.accountId, {
          from: String(args.fromIso),
          to: String(args.toIso),
          durationMin: typeof args.durationMin === 'number' ? args.durationMin : undefined,
        });
        return result;
      }

      case 'schedule_meeting': {
        const attendeeName =
          args?.attendeeName ? String(args.attendeeName) : ctx.contactName || '';
        const attendeeEmail =
          args?.attendeeEmail ? String(args.attendeeEmail) : ctx.contactEmail || '';
        const startIso = args?.startIso ? String(args.startIso) : '';
        const topic = args?.topic ? String(args.topic) : `Reunión con ${attendeeName}`;

        if (!attendeeName) throw new Error('attendeeName is required');
        if (!attendeeEmail) throw new Error('attendeeEmail is required');
        if (!/^\S+@\S+\.\S+$/.test(attendeeEmail)) {
          throw new Error('attendeeEmail is not a valid email');
        }
        if (!startIso) throw new Error('startIso is required');

        const integration2 = await CalendarIntegration.findOne({ accountId: ctx.accountId });
        if (!integration2) {
          throw new Error(`No Google Calendar integration for accountId=${ctx.accountId}`);
        }

        let endIso = args?.endIso ? String(args.endIso) : '';
        if (!endIso) {
          const start = new Date(startIso);
          if (Number.isNaN(start.getTime())) throw new Error('Invalid startIso');
          const durationMs = (integration2.meetingDurationMinutes || 30) * 60_000;
          endIso = new Date(start.getTime() + durationMs).toISOString();
        }

        const descLines: string[] = [];
        if (topic) descLines.push(topic);
        if (ctx.conversationId) descLines.push(`\nMoca conversation: ${ctx.conversationId}`);
        if (ctx.leadId) descLines.push(`Moca lead: ${ctx.leadId}`);
        descLines.push('\n(Agendado automáticamente por Moca — agente de Instagram DM)');

        const event = await createMeetingEvent(ctx.accountId, {
          summary: topic,
          description: descLines.join('\n'),
          startIso,
          endIso,
          attendees: [{ email: attendeeEmail, name: attendeeName }],
        });

        console.log(
          `📅 [NativeTool schedule_meeting] Created event ${event.eventId} for ${attendeeEmail} at ${startIso} (account=${ctx.accountId})`
        );

        return {
          success: true,
          eventId: event.eventId,
          meetLink: event.meetLink,
          htmlLink: event.htmlLink,
          start: event.start,
          end: event.end,
          attendee: { name: attendeeName, email: attendeeEmail },
        };
      }

      default:
        throw new Error(`Unknown native tool: ${name}`);
    }
  };

  return { tools, promptAugmentation, execute };
}

/**
 * Set of known native tool names — callers use this to decide whether to
 * route a tool call to the native executor or to the external MCP path.
 */
export const NATIVE_TOOL_NAMES = new Set<string>([
  'get_calendar_availability',
  'schedule_meeting',
]);
