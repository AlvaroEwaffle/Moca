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
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import {
  getAvailability,
  createMeetingEvent,
} from './googleCalendar.service';
import { extractContactData as extractLeadContactData } from './contactDataExtractor.service';

export interface NativeToolContext {
  accountId: string;
  conversationId?: string;
  leadId?: string;
  contactEmail?: string;
  contactName?: string;
  leadBusinessName?: string;
  businessName?: string;
  conversationSummary?: string;
  currentUserMessage?: string;
  requireLeadBusinessNameBeforeScheduling?: boolean;
  requireLeadEmailBeforeScheduling?: boolean;
  now?: Date;
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

interface CalendarDateIntent {
  date: string;
  fromIso: string;
  toIso: string;
  source: string;
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeEmail = (email: string | undefined): string => String(email || '').trim().toLowerCase();

const addDaysToDateString = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const getUtcWeekday = (dateString: string): number => {
  const [year, month, day] = dateString.split('-').map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

const localDayRange = (dateString: string, timezone: string): Pick<CalendarDateIntent, 'fromIso' | 'toIso'> => ({
  fromIso: fromZonedTime(`${dateString}T00:00:00`, timezone).toISOString(),
  toIso: fromZonedTime(`${addDaysToDateString(dateString, 1)}T00:00:00`, timezone).toISOString(),
});

export const extractCalendarDateIntent = (
  message: string | undefined,
  timezone: string,
  now: Date = new Date()
): CalendarDateIntent | null => {
  const normalized = normalizeText(message || '');
  if (!normalized) return null;

  const today = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
  let requestedDate: string | null = null;
  let source = '';

  if (/\bpasado\s+manana\b/.test(normalized)) {
    requestedDate = addDaysToDateString(today, 2);
    source = 'pasado manana';
  } else if (/\bmanana\b/.test(normalized)) {
    requestedDate = addDaysToDateString(today, 1);
    source = 'manana';
  } else if (/\bhoy\b/.test(normalized)) {
    requestedDate = today;
    source = 'hoy';
  } else {
    const weekdayEntry = Object.entries(WEEKDAYS).find(([name]) =>
      new RegExp(`\\b${name}\\b`).test(normalized)
    );

    if (weekdayEntry) {
      const [weekdayName, targetDow] = weekdayEntry;
      const currentDow = getUtcWeekday(today);
      let delta = (targetDow - currentDow + 7) % 7;
      if (delta === 0 || /\b(proximo|proxima|siguiente)\b/.test(normalized)) {
        delta = delta || 7;
      }
      requestedDate = addDaysToDateString(today, delta);
      source = weekdayName;
    }
  }

  if (!requestedDate) return null;

  return {
    date: requestedDate,
    source,
    ...localDayRange(requestedDate, timezone),
  };
};

const sameLocalDate = (iso: string, expectedDate: string, timezone: string): boolean => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd') === expectedDate;
};

const hasMeaningfulBusinessName = (businessName: string): boolean => {
  const normalized = normalizeText(businessName).trim();
  return Boolean(normalized && normalized !== 'business' && normalized !== 'no especificado');
};

const resolveLeadBusinessName = (ctx: NativeToolContext): string | undefined => {
  if (hasMeaningfulBusinessName(ctx.leadBusinessName || '')) {
    return ctx.leadBusinessName;
  }

  const extracted = extractLeadContactData(
    [ctx.currentUserMessage, ctx.conversationSummary].filter(Boolean).join('\n')
  );
  return extracted.businessNames[0];
};

const resolveLeadEmail = (ctx: NativeToolContext, attendeeEmail?: string): string | undefined => {
  const normalizedAttendeeEmail = normalizeEmail(attendeeEmail);
  if (normalizedAttendeeEmail) return normalizedAttendeeEmail;

  const normalizedContactEmail = normalizeEmail(ctx.contactEmail);
  if (normalizedContactEmail) return normalizedContactEmail;

  const extracted = extractLeadContactData(
    [ctx.currentUserMessage, ctx.conversationSummary].filter(Boolean).join('\n')
  );
  return extracted.emails[0];
};

const getMissingCalendarQualificationFields = (
  ctx: NativeToolContext,
  attendeeEmail?: string
): string[] => {
  const missing: string[] = [];

  if (ctx.requireLeadEmailBeforeScheduling && !resolveLeadEmail(ctx, attendeeEmail)) {
    missing.push('email del lead');
  }

  if (
    ctx.requireLeadBusinessNameBeforeScheduling &&
    !hasMeaningfulBusinessName(resolveLeadBusinessName(ctx) || '')
  ) {
    missing.push('nombre del negocio del lead');
  }

  return missing;
};

const buildMeetingTitle = (businessName: string | undefined, topic: string, attendeeName: string): string => {
  const baseTopic = topic.trim() || 'Reunión';
  const topicWithLead =
    attendeeName && !normalizeText(baseTopic).includes(normalizeText(attendeeName))
      ? `${baseTopic} con ${attendeeName}`
      : baseTopic;

  if (!businessName || !hasMeaningfulBusinessName(businessName)) {
    return topicWithLead;
  }

  if (normalizeText(topicWithLead).includes(normalizeText(businessName))) {
    return topicWithLead;
  }

  return `${businessName.trim()} - ${topicWithLead}`;
};

const buildMeetingDescription = (input: {
  topic: string;
  attendeeName: string;
  attendeeEmail: string;
  leadBusinessName?: string;
  conversationSummary?: string;
  conversationId?: string;
  leadId?: string;
  ccEmails?: string[];
}): string => {
  const descLines: string[] = [];
  if (input.topic) descLines.push(`Tema: ${input.topic}`);
  descLines.push(`Lead: ${input.attendeeName} <${input.attendeeEmail}>`);
  if (input.leadBusinessName) descLines.push(`Negocio del lead: ${input.leadBusinessName}`);

  if (input.conversationSummary) {
    descLines.push('', 'Resumen de conversación:', input.conversationSummary);
  }

  if (input.ccEmails?.length) {
    descLines.push('', `CC internos: ${input.ccEmails.join(', ')}`);
  }

  if (input.conversationId) descLines.push('', `Moca conversation: ${input.conversationId}`);
  if (input.leadId) descLines.push(`Moca lead: ${input.leadId}`);
  descLines.push('', '(Agendado automáticamente por Moca - agente de Instagram DM)');

  return descLines.join('\n');
};

const resolveAvailabilityRange = (
  args: any,
  intent: CalendarDateIntent | null,
  timezone: string,
  now: Date
): { from: string; to: string; correctedByIntent: boolean } => {
  if (intent) {
    return { from: intent.fromIso, to: intent.toIso, correctedByIntent: true };
  }

  const from = args?.fromIso ? new Date(String(args.fromIso)) : null;
  const to = args?.toIso ? new Date(String(args.toIso)) : null;

  if (from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from < to) {
    return { from: from.toISOString(), to: to.toISOString(), correctedByIntent: false };
  }

  const today = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
  return {
    from: now.toISOString(),
    to: fromZonedTime(`${addDaysToDateString(today, 14)}T23:59:59`, timezone).toISOString(),
    correctedByIntent: false,
  };
};

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

  const now = ctx.now || new Date();
  const localNow = formatInTimeZone(now, integration.timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  const requestedDateIntent = extractCalendarDateIntent(
    ctx.currentUserMessage,
    integration.timezone,
    now
  );
  const missingQualificationFields = getMissingCalendarQualificationFields(ctx);
  const knownLeadBusinessName = resolveLeadBusinessName(ctx);
  const knownLeadEmail = resolveLeadEmail(ctx);

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
              `Inicio del rango a consultar en ISO 8601 con zona horaria. Ej: "${localNow}". Nunca envíes la palabra "ahora"; calcula el ISO usando la fecha actual.`,
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
            minimum: 15,
            maximum: 180,
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

Contexto de agenda:
- Zona horaria del calendario: ${integration.timezone}
- Fecha/hora actual del calendario: ${localNow}
- Duración por defecto: ${integration.meetingDurationMinutes || 30} minutos
- Buffer configurado: ${integration.bufferMinutes ?? 15} minutos
${requestedDateIntent ? `- Fecha pedida por el lead: ${requestedDateIntent.date} (${requestedDateIntent.source})` : ''}
${ctx.requireLeadBusinessNameBeforeScheduling || ctx.requireLeadEmailBeforeScheduling ? `- Nombre del negocio del lead: ${knownLeadBusinessName || 'pendiente'}\n- Email del lead: ${knownLeadEmail || 'pendiente'}\n- Campos faltantes antes de agenda: ${missingQualificationFields.join(', ') || 'ninguno'}` : ''}

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

  const qualificationRules = ctx.requireLeadBusinessNameBeforeScheduling || ctx.requireLeadEmailBeforeScheduling
    ? `

CALIFICACIÓN OBLIGATORIA PARA ESTA CUENTA:
- NO uses get_calendar_availability ni schedule_meeting hasta tener completos los datos requeridos del lead.
- Si falta ${missingQualificationFields.join(', ') || 'algún dato'}, pregunta solo por eso.
- Cuando ya tengas los datos, explica brevemente el valor de ${ctx.businessName || 'la solución'} para el negocio del lead antes de ofrecer horarios.
`
    : '';

  const execute = async (name: string, args: any): Promise<any> => {
    switch (name) {
      case 'get_calendar_availability': {
        if (missingQualificationFields.length > 0) {
          throw new Error(
            `Lead qualification incomplete. Ask for ${missingQualificationFields.join(
              ' y '
            )} before using calendar tools for this account.`
          );
        }

        const range = resolveAvailabilityRange(args, requestedDateIntent, integration.timezone, now);
        if (range.correctedByIntent) {
          console.log(
            `📅 [NativeTool get_calendar_availability] Overriding model date range with user-requested ${requestedDateIntent!.source}: ${range.from} -> ${range.to}`
          );
        }

        const result = await getAvailability(ctx.accountId, {
          from: range.from,
          to: range.to,
          durationMin: typeof args.durationMin === 'number' ? args.durationMin : undefined,
        });
        const slots = result.slots.slice(0, 12);
        console.log(
          `📅 [NativeTool get_calendar_availability] ${result.slots.length} slot(s) found for account=${ctx.accountId}; returning ${slots.length}`
        );
        return {
          ...result,
          slots,
          totalSlots: result.slots.length,
          moreAvailable: result.slots.length > slots.length,
          requestedDate: requestedDateIntent?.date,
          correctedByUserDate: range.correctedByIntent,
          instruction:
            'Offer 2-3 concrete options using slot.label/startLocal. If moreAvailable=true, mention that more options exist.',
        };
      }

      case 'schedule_meeting': {
        const attendeeName =
          args?.attendeeName ? String(args.attendeeName) : ctx.contactName || '';
        const attendeeEmail =
          args?.attendeeEmail ? String(args.attendeeEmail) : ctx.contactEmail || '';
        const startIso = args?.startIso ? String(args.startIso) : '';
        const topic = args?.topic ? String(args.topic) : 'Reunión';
        const missingScheduleFields = getMissingCalendarQualificationFields(ctx, attendeeEmail);

        if (missingScheduleFields.length > 0) {
          throw new Error(
            `Lead qualification incomplete. Ask for ${missingScheduleFields.join(
              ' y '
            )} before scheduling this meeting.`
          );
        }

        if (!attendeeName) throw new Error('attendeeName is required');
        if (!attendeeEmail) throw new Error('attendeeEmail is required');
        if (!/^\S+@\S+\.\S+$/.test(attendeeEmail)) {
          throw new Error('attendeeEmail is not a valid email');
        }
        if (!startIso) throw new Error('startIso is required');
        if (
          requestedDateIntent &&
          !sameLocalDate(startIso, requestedDateIntent.date, integration.timezone)
        ) {
          const attemptedDate = Number.isNaN(new Date(startIso).getTime())
            ? 'invalid-date'
            : formatInTimeZone(new Date(startIso), integration.timezone, 'yyyy-MM-dd');
          throw new Error(
            `Lead requested ${requestedDateIntent.source} (${requestedDateIntent.date}) but startIso is ${attemptedDate}. Call get_calendar_availability for ${requestedDateIntent.date} and use a slot from that date.`
          );
        }

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

        const summary = buildMeetingTitle(ctx.businessName, topic, attendeeName);
        const description = buildMeetingDescription({
          topic,
          attendeeName,
          attendeeEmail,
          leadBusinessName: resolveLeadBusinessName(ctx),
          conversationSummary: ctx.conversationSummary,
          conversationId: ctx.conversationId,
          leadId: ctx.leadId,
          ccEmails: integration2.ccEmails || [],
        });

        const event = await createMeetingEvent(ctx.accountId, {
          summary,
          description,
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

  return { tools, promptAugmentation: `${promptAugmentation}${qualificationRules}`, execute };
}

/**
 * Set of known native tool names — callers use this to decide whether to
 * route a tool call to the native executor or to the external MCP path.
 */
export const NATIVE_TOOL_NAMES = new Set<string>([
  'get_calendar_availability',
  'schedule_meeting',
]);
