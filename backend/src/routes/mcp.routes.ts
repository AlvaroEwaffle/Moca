import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import Contact from '../models/contact.model';
import InstagramAccount from '../models/instagramAccount.model';
import OutboundQueue from '../models/outboundQueue.model';
import GlobalAgentConfig from '../models/globalAgentConfig.model';
import CalendarIntegration from '../models/calendarIntegration.model';
import {
  getAvailability as getCalendarAvailability,
  createMeetingEvent as createCalendarMeetingEvent,
} from '../services/googleCalendar.service';

const router = express.Router();

// ─── Tool definitions ────────────────────────────────────────────────────────

const MCP_TOOLS = [
  {
    name: 'get_conversation_count',
    description: 'Total de conversaciones en DB.',
    schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_recent_conversations',
    description: 'Últimas N conversaciones con score, aiEnabled, topic y timestamps.',
    schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Default 10, max 50' },
        minScore: { type: 'number', description: 'Score mínimo (1-7)' },
      },
      required: [],
    },
  },
  {
    name: 'get_hot_leads',
    description: 'Conversaciones con score > 2 activas en las últimas 24h, ordenadas por score desc.',
    schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Default 20, max 50' },
      },
      required: [],
    },
  },
  {
    name: 'get_lead_stats',
    description: 'Distribución de leads agrupada por score 1-7.',
    schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_account_count',
    description: 'Cuentas de Instagram conectadas.',
    schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_agent_status',
    description: 'Estado global del agente: enabled/disabled, límite de respuestas, quota.',
    schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'ID de la cuenta Instagram (opcional, retorna primera si no se provee)' },
      },
      required: [],
    },
  },
  {
    name: 'get_outbound_queue_stats',
    description: 'Mensajes en cola: pending / sent / failed. Health check del sender worker.',
    schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_conversation_detail',
    description:
      'Get full conversation detail for a specific Instagram lead — metadata, message history, scoring, lead context',
    schema: {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: 'ID de la conversación (MongoDB ObjectId). Mismo id que en get_recent_conversations / get_hot_leads',
        },
        messageLimit: {
          type: 'number',
          description: 'Últimos N mensajes (default 30, max 100)',
        },
      },
      required: ['conversationId'],
    },
  },
  {
    name: 'get_daily_activity',
    description: 'Conversaciones y mensajes creados hoy. Útil para briefing diario.',
    schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_conversations_by_account',
    description: 'Conversaciones filtradas por cuenta de Instagram.',
    schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'ID de la cuenta Instagram' },
        limit: { type: 'number', description: 'Default 20, max 50' },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'send_message',
    description: 'Enviar un DM de Instagram a una conversación existente. El mensaje se encola y el SenderWorker lo entrega en ≤30s.',
    schema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string', description: 'ID de la conversación (required)' },
        message: { type: 'string', description: 'Texto del mensaje a enviar (required, max 1000 chars)' },
      },
      required: ['conversationId', 'message'],
    },
  },
  {
    name: 'get_calendar_availability',
    description:
      'Listar slots disponibles en el Google Calendar del dueño de la cuenta, respetando workingHours, buffer y eventos existentes.',
    schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Instagram account ID (IG_ID canonical)' },
        fromIso: { type: 'string', description: 'Inicio del rango (ISO 8601)' },
        toIso: { type: 'string', description: 'Fin del rango (ISO 8601, máx 30 días después de fromIso)' },
        durationMin: {
          type: 'number',
          description: 'Duración de cada slot en minutos (override del config). Default: meetingDurationMinutes',
        },
      },
      required: ['accountId', 'fromIso', 'toIso'],
    },
  },
  {
    name: 'schedule_meeting',
    description:
      'Crear un evento en Google Calendar con Google Meet y enviar invite por email al lead. Devuelve meetLink + eventId.',
    schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Instagram account ID (required)' },
        conversationId: {
          type: 'string',
          description: 'ID de la conversación Moca (opcional, para metadata/link en description)',
        },
        leadId: { type: 'string', description: 'ID del contacto/lead (opcional, metadata)' },
        attendeeName: { type: 'string', description: 'Nombre del lead (required)' },
        attendeeEmail: { type: 'string', description: 'Email del lead (required, valid email)' },
        startIso: { type: 'string', description: 'Inicio del evento en ISO 8601 (required)' },
        endIso: {
          type: 'string',
          description:
            'Fin del evento en ISO 8601 (opcional — si no se provee, se usa startIso + meetingDurationMinutes)',
        },
        topic: {
          type: 'string',
          description: 'Tema de la reunión (usado en summary + description). Default: "Reunión con <attendeeName>"',
        },
      },
      required: ['accountId', 'attendeeName', 'attendeeEmail', 'startIso'],
    },
  },
  {
    name: 'get_calendar_config',
    description:
      'Devuelve la configuración de Calendar (timezone, workingHours, duración default, buffer, enabled) y estado de conexión Google.',
    schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Instagram account ID (required)' },
      },
      required: ['accountId'],
    },
  },
  // ─── Feed / contenido publicado ────────────────────────────────────────────
  // Hasta acá el MCP solo veía DMs: quien opera una cuenta de Instagram estaba
  // ciego al feed (qué se publicó, cómo rindió, quién comentó). Estos cuatro
  // cierran ese hueco leyendo la Graph API con el token de la propia cuenta.
  {
    name: 'get_published_media',
    description:
      'Publicaciones recientes del feed con engagement (likes, comentarios) y alcance. Para saber qué se publicó y qué rindió, no solo los DMs.',
    schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Instagram account ID (required)' },
        limit: { type: 'number', description: 'Cuántas publicaciones. Default 12, máx 50.' },
        withInsights: {
          type: 'boolean',
          description: 'Si true (default), agrega reach/saved/shares por post. Cuesta 1 request extra por post.',
        },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'get_account_insights',
    description:
      'Métricas de la cuenta: seguidores, nº de publicaciones y alcance/visitas al perfil del período. Para medir si el ritmo de publicación está moviendo la aguja.',
    schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Instagram account ID (required)' },
        days: { type: 'number', description: 'Ventana en días para el alcance. Default 28, máx 30 (límite de la API).' },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'get_media_comments',
    description:
      'Comentarios de las publicaciones recientes, marcando cuáles NO tienen respuesta de la cuenta. Los comentarios sin responder son el agujero más caro de una cuenta de IG.',
    schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Instagram account ID (required)' },
        mediaLimit: { type: 'number', description: 'Cuántas publicaciones revisar. Default 8, máx 25.' },
        onlyUnanswered: { type: 'boolean', description: 'Si true, devuelve solo los que esperan respuesta. Default false.' },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'reply_to_comment',
    description:
      'Responde un comentario en el feed. A diferencia de send_message (que encola), esto va directo a la Graph API y es inmediato e irreversible.',
    schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Instagram account ID (required)' },
        commentId: { type: 'string', description: 'ID del comentario a responder (de get_media_comments)' },
        message: { type: 'string', description: 'Texto de la respuesta. Máx 2200 caracteres.' },
      },
      required: ['accountId', 'commentId', 'message'],
    },
  },
];

// ─── Graph API helpers (feed/contenido) ──────────────────────────────────────
// Dos familias de token conviven en la DB y hablan con hosts distintos con los
// mismos endpoints: EAA* = Facebook Login (cuenta ligada a una Página) y IGAA* =
// Instagram Login (OAuth directo). Elegir el host por prefijo evita el
// "Bad signature" que aparece si se pega el token de una familia al host de la otra.
function graphBase(token: string): string {
  const host = token.startsWith('IG') ? 'graph.instagram.com' : 'graph.facebook.com';
  return `https://${host}/${process.env.GRAPH_VERSION || 'v21.0'}`;
}

async function accountToken(
  accountId: string,
): Promise<{ token: string; base: string; username: string; node: string }> {
  const account = await InstagramAccount.findOne({ accountId })
    .select('accessToken contentAccessToken accountName pageScopedId')
    .lean();
  if (!account) throw new Error(`Instagram account not found: ${accountId}`);
  // Feed work needs content_publish / manage_insights / manage_comments scopes that
  // the messaging token usually lacks. Prefer the dedicated content token when the
  // account has one; fall back to the messaging token so accounts where both live
  // in one credential keep working untouched.
  const token = (account as any).contentAccessToken || (account as any).accessToken;
  if (!token) throw new Error(`Account ${accountId} has no stored access token`);

  // `accountId` is the Instagram-Login IG_ID, which is NOT the node a Facebook-Login
  // (EAA) token addresses — that one wants the Business account id we keep in
  // pageScopedId. Using accountId for both is why an EAA account 400s on /media.
  // Callers must address Graph via `node`, and keep using accountId for our own DB.
  const isFacebookToken = !token.startsWith('IG');
  const node = (isFacebookToken && (account as any).pageScopedId) || accountId;

  return { token, base: graphBase(token), username: (account as any).accountName || '', node };
}

async function graphGet(url: string): Promise<any> {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as any)?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Graph API: ${msg}`);
  }
  return body;
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requirePlatformKey(req: Request, res: Response, next: NextFunction): void {
  const expectedKey = process.env.PLATFORM_INTERNAL_KEY;
  if (!expectedKey) {
    res.status(503).json({ success: false, error: 'MCP endpoint not configured (PLATFORM_INTERNAL_KEY missing)' });
    return;
  }
  if (req.headers['x-platform-key'] !== expectedKey) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  next();
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get('/tools', requirePlatformKey, (_req: Request, res: Response) => {
  res.json({ success: true, tools: MCP_TOOLS });
});

router.post('/tools/execute', requirePlatformKey, async (req: Request, res: Response) => {
  const { name, arguments: args = {} } = req.body as { name: string; arguments?: Record<string, any> };

  if (!name) {
    res.status(400).json({ success: false, error: 'Tool name is required' });
    return;
  }

  try {
    const result = await executeTool(name, args);
    res.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ [MCP] Tool execution failed (${name}):`, message);
    res.status(500).json({ success: false, error: message });
  }
});

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, any>): Promise<unknown> {
  switch (name) {
    case 'get_conversation_count': {
      const count = await Conversation.countDocuments();
      return { count };
    }

    case 'get_recent_conversations': {
      const limit = Math.min(Number(args.limit) || 10, 50);
      const query: Record<string, unknown> = {};
      if (args.minScore) query['leadScoring.currentScore'] = { $gte: args.minScore };

      const conversations = await Conversation.find(query)
        .sort({ 'timestamps.lastActivity': -1 })
        .limit(limit)
        .select('accountId status leadScoring.currentScore leadScoring.currentStep.stepName settings.aiEnabled timestamps.lastActivity metrics.totalMessages context.topic')
        .lean();

      return { conversations, count: conversations.length };
    }

    case 'get_hot_leads': {
      const limit = Math.min(Number(args.limit) || 20, 50);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const leads = await Conversation.find({
        'leadScoring.currentScore': { $gt: 2 },
        'timestamps.lastActivity': { $gte: since },
      })
        .sort({ 'leadScoring.currentScore': -1, 'timestamps.lastActivity': -1 })
        .limit(limit)
        .select('accountId status leadScoring.currentScore leadScoring.currentStep.stepName settings.aiEnabled timestamps.lastActivity metrics.totalMessages context.topic')
        .lean();

      return { leads, count: leads.length, window: '24h', minScore: 3 };
    }

    case 'get_lead_stats': {
      const stats = await Conversation.aggregate([
        { $group: { _id: '$leadScoring.currentScore', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);

      const byScore: Record<number, number> = {};
      for (const s of stats) {
        if (s._id != null) byScore[s._id as number] = s.count as number;
      }

      const total = await Conversation.countDocuments();
      return { byScore, total };
    }

    case 'get_account_count': {
      const count = await InstagramAccount.countDocuments();
      return { count };
    }

    case 'get_agent_status': {
      const query = args.accountId ? { accountId: args.accountId } : {};
      const config = await GlobalAgentConfig.findOne(query).lean();
      if (!config) return { found: false };

      return {
        found: true,
        enabled: (config as any).agentEnabled ?? true,
        responseLimits: (config as any).responseLimits,
        leadScoring: (config as any).leadScoring ? {
          enabled: (config as any).leadScoring.enabled,
        } : undefined,
      };
    }

    case 'get_outbound_queue_stats': {
      const [pending, sent, failed, total] = await Promise.all([
        OutboundQueue.countDocuments({ status: 'pending' }),
        OutboundQueue.countDocuments({ status: 'sent' }),
        OutboundQueue.countDocuments({ status: 'failed' }),
        OutboundQueue.countDocuments(),
      ]);
      return { pending, sent, failed, total };
    }

    case 'get_conversation_detail': {
      if (!args.conversationId) throw new Error('conversationId is required');
      const rawId = String(args.conversationId);
      if (!mongoose.Types.ObjectId.isValid(rawId)) {
        throw new Error(`Invalid conversationId format: ${rawId}`);
      }

      const messageLimit = Math.min(Math.max(Number(args.messageLimit) || 30, 1), 100);

      // 1. Load conversation
      const conversation = await Conversation.findById(rawId).lean();
      if (!conversation) {
        return { found: false, error: `Conversation not found: ${rawId}` };
      }

      const conv = conversation as any;

      // 2. Load contact (for igUsername / participantHandle)
      let igUsername: string | undefined;
      let participantHandle: string | undefined;
      if (conv.contactId) {
        const contact = await Contact.findById(conv.contactId)
          .select('name psid metadata.instagramData')
          .lean();
        if (contact) {
          const c = contact as any;
          igUsername = c.metadata?.instagramData?.username;
          participantHandle = igUsername || c.name || c.psid;
        }
      }

      // 3. Load last N messages. Conversation stores id as ObjectId but Message.conversationId
      //    is a string — match on the string form.
      const rawMessages = await Message.find({ conversationId: rawId })
        .sort({ 'metadata.timestamp': -1, createdAt: -1 })
        .limit(messageLimit)
        .lean();

      // Chronological ascending
      rawMessages.reverse();

      const messages = rawMessages.map((m: any) => ({
        id: String(m._id),
        mid: m.mid,
        direction: m.role === 'user' ? 'inbound' : 'outbound',
        role: m.role,
        body: m.content?.text || '',
        timestamp:
          m.metadata?.timestamp?.toISOString?.() ||
          m.createdAt?.toISOString?.() ||
          null,
        type: m.metadata?.isManual
          ? 'manual'
          : m.metadata?.aiGenerated
          ? 'ai'
          : m.role === 'user'
          ? 'inbound'
          : 'system',
        status: m.status,
      }));

      // 4. Compute metrics from loaded window (fallback to denormalized counters)
      const inboundCount = messages.filter((x) => x.direction === 'inbound').length;
      const outboundCount = messages.filter((x) => x.direction === 'outbound').length;
      const lastMessage = messages[messages.length - 1];
      const lastInbound = [...messages].reverse().find((x) => x.direction === 'inbound');

      const metrics = {
        totalMessages: conv.metrics?.totalMessages ?? conv.messageCount ?? messages.length,
        inboundCount: conv.metrics?.userMessages ?? inboundCount,
        outboundCount: conv.metrics?.botMessages ?? outboundCount,
        lastMessageAt:
          lastMessage?.timestamp ||
          conv.timestamps?.lastActivity?.toISOString?.() ||
          null,
        lastInboundAt:
          lastInbound?.timestamp ||
          conv.timestamps?.lastUserMessage?.toISOString?.() ||
          null,
      };

      // 5. Status freshness derivation (active vs stale)
      const lastActivity = conv.timestamps?.lastActivity
        ? new Date(conv.timestamps.lastActivity)
        : null;
      const hoursSince = lastActivity
        ? (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60)
        : null;
      const freshness =
        hoursSince == null
          ? 'unknown'
          : hoursSince <= 24
          ? 'active'
          : hoursSince <= 72
          ? 'cooling'
          : 'stale';

      // 6. Score history (already stored in the model)
      const scoreHistory = Array.isArray(conv.leadScoring?.scoreHistory)
        ? conv.leadScoring.scoreHistory.map((h: any) => ({
            score: h.score,
            stepName: h.stepName,
            reason: h.reason,
            timestamp: h.timestamp?.toISOString?.() || h.timestamp,
          }))
        : [];

      // 7. Lead context — richer scoring/intent metadata
      const leadContext = {
        currentStep: conv.leadScoring?.currentStep,
        progression: conv.leadScoring?.progression,
        confidence: conv.leadScoring?.confidence,
        urgency: conv.context?.urgency,
        category: conv.context?.category,
        lastIntent: conv.aiResponseMetadata?.lastIntent,
        lastNextAction: conv.aiResponseMetadata?.lastNextAction,
        lastResponseType: conv.aiResponseMetadata?.lastResponseType,
        repetitionDetected: conv.aiResponseMetadata?.repetitionDetected,
        responseQuality: conv.aiResponseMetadata?.responseQuality,
        milestone: conv.milestone,
        analytics: conv.analytics,
        activatedByKeyword: conv.settings?.activatedByKeyword,
        activationKeyword: conv.settings?.activationKeyword,
        responseCounter: conv.settings?.responseCounter,
        isSupport: conv.isSupport,
      };

      return {
        id: String(conv._id),
        accountId: conv.accountId,
        igUsername,
        participantHandle,
        status: conv.status,
        freshness,
        score: conv.leadScoring?.currentScore ?? 1,
        scoreHistory,
        topic: conv.context?.topic,
        lastTopic: conv.context?.topic,
        metrics,
        leadContext,
        messages,
        aiEnabled: conv.settings?.aiEnabled ?? false,
      };
    }

    case 'get_daily_activity': {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [newConversations, newMessages] = await Promise.all([
        Conversation.countDocuments({ 'timestamps.createdAt': { $gte: startOfDay } }),
        Message.countDocuments({ createdAt: { $gte: startOfDay } }),
      ]);

      return {
        date: startOfDay.toISOString().split('T')[0],
        newConversations,
        newMessages,
      };
    }

    case 'get_conversations_by_account': {
      if (!args.accountId) throw new Error('accountId is required');
      const limit = Math.min(Number(args.limit) || 20, 50);

      const conversations = await Conversation.find({ accountId: args.accountId })
        .sort({ 'timestamps.lastActivity': -1 })
        .limit(limit)
        .select('status leadScoring.currentScore leadScoring.currentStep.stepName settings.aiEnabled timestamps.lastActivity metrics.totalMessages')
        .lean();

      return { conversations, count: conversations.length, accountId: args.accountId };
    }

    case 'send_message': {
      if (!args.conversationId) throw new Error('conversationId is required');
      if (!args.message) throw new Error('message is required');

      const text = String(args.message).trim();
      if (text.length === 0) throw new Error('message cannot be empty');
      if (text.length > 1000) throw new Error('message exceeds 1000 character limit');

      // 1. Find conversation to get contactId and accountId
      const conversation = await Conversation.findById(args.conversationId)
        .select('contactId accountId')
        .lean();
      if (!conversation) throw new Error('Conversation not found');

      const contactId = (conversation as any).contactId;
      const accountId = (conversation as any).accountId;
      if (!contactId || !accountId) throw new Error('Conversation missing contactId or accountId');

      // 2. Create Message record
      const mid = `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newMessage = await Message.create({
        mid,
        conversationId: args.conversationId,
        contactId,
        accountId,
        role: 'assistant',
        content: { text },
        metadata: {
          timestamp: new Date(),
          processed: true,
          aiGenerated: false,
          isManual: true,
        },
        status: 'queued',
      });

      // 3. Create OutboundQueue entry — SenderWorker picks it up in ≤30s
      await OutboundQueue.create({
        messageId: newMessage.mid,
        conversationId: args.conversationId,
        contactId,
        accountId,
        priority: 'high',
        status: 'pending',
        content: { text },
      });

      console.log(`📤 [MCP send_message] Queued message for conversation ${args.conversationId} (mid: ${mid})`);

      return {
        success: true,
        messageId: mid,
        conversationId: args.conversationId,
        status: 'queued',
        estimatedDelivery: '≤30s',
      };
    }

    case 'get_calendar_availability': {
      if (!args.accountId) throw new Error('accountId is required');
      if (!args.fromIso) throw new Error('fromIso is required');
      if (!args.toIso) throw new Error('toIso is required');

      const result = await getCalendarAvailability(String(args.accountId), {
        from: String(args.fromIso),
        to: String(args.toIso),
        durationMin: typeof args.durationMin === 'number' ? args.durationMin : undefined,
      });
      return result;
    }

    case 'schedule_meeting': {
      const accountId = args.accountId ? String(args.accountId) : '';
      const attendeeName = args.attendeeName ? String(args.attendeeName) : '';
      const attendeeEmail = args.attendeeEmail ? String(args.attendeeEmail) : '';
      const startIso = args.startIso ? String(args.startIso) : '';
      const topic = args.topic ? String(args.topic) : `Reunión con ${attendeeName}`;

      if (!accountId) throw new Error('accountId is required');
      if (!attendeeName) throw new Error('attendeeName is required');
      if (!attendeeEmail) throw new Error('attendeeEmail is required');
      if (!startIso) throw new Error('startIso is required');
      if (!/^\S+@\S+\.\S+$/.test(attendeeEmail)) throw new Error('attendeeEmail is not a valid email');

      // Resolve integration to derive end from duration config when endIso is absent.
      const integration = await CalendarIntegration.findOne({ accountId });
      if (!integration) throw new Error(`No Google Calendar integration for accountId=${accountId}`);

      let endIso = args.endIso ? String(args.endIso) : '';
      if (!endIso) {
        const start = new Date(startIso);
        if (Number.isNaN(start.getTime())) throw new Error('Invalid startIso');
        const durationMs = (integration.meetingDurationMinutes || 30) * 60_000;
        endIso = new Date(start.getTime() + durationMs).toISOString();
      }

      // Surface useful metadata in event description (conversation / lead linkage).
      const descLines: string[] = [];
      if (topic) descLines.push(topic);
      if (args.conversationId) descLines.push(`\nMoca conversation: ${args.conversationId}`);
      if (args.leadId) descLines.push(`Moca lead: ${args.leadId}`);
      descLines.push('\n(Agendado automáticamente por Moca — agente de Instagram DM)');

      const event = await createCalendarMeetingEvent(accountId, {
        summary: topic,
        description: descLines.join('\n'),
        startIso,
        endIso,
        attendees: [{ email: attendeeEmail, name: attendeeName }],
      });

      console.log(
        `📅 [MCP schedule_meeting] Created event ${event.eventId} for ${attendeeEmail} on ${startIso}`
      );

      return {
        success: true,
        accountId,
        eventId: event.eventId,
        meetLink: event.meetLink,
        htmlLink: event.htmlLink,
        start: event.start,
        end: event.end,
        attendee: { name: attendeeName, email: attendeeEmail },
        conversationId: args.conversationId || null,
        leadId: args.leadId || null,
      };
    }

    case 'get_calendar_config': {
      if (!args.accountId) throw new Error('accountId is required');
      const accountId = String(args.accountId);
      const integration = await CalendarIntegration.findOne({ accountId });

      if (!integration) {
        return {
          connected: false,
          accountId,
        };
      }

      return {
        connected: integration.status === 'connected' && integration.enabled,
        ...integration.toSafeObject(),
      };
    }

    case 'get_published_media': {
      if (!args.accountId) throw new Error('accountId is required');
      const { token, base, username, node } = await accountToken(String(args.accountId));
      const limit = Math.min(Number(args.limit) || 12, 50);
      const withInsights = args.withInsights !== false;

      const fields = 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count';
      const page = await graphGet(
        `${base}/${node}/media?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(token)}`,
      );
      const media: any[] = page.data || [];

      if (withInsights) {
        // Insights are per-media and have no batch endpoint. A post can also be too
        // old or too new to have them — that must not sink the whole call, so each
        // failure degrades to insights:null instead of throwing.
        await Promise.all(
          media.map(async (m) => {
            try {
              const ins = await graphGet(
                `${base}/${m.id}/insights?metric=reach,saved,shares,total_interactions&access_token=${encodeURIComponent(token)}`,
              );
              m.insights = Object.fromEntries((ins.data || []).map((d: any) => [d.name, d.values?.[0]?.value ?? null]));
            } catch {
              m.insights = null;
            }
          }),
        );
      }

      return { accountId: args.accountId, username, count: media.length, media };
    }

    case 'get_account_insights': {
      if (!args.accountId) throw new Error('accountId is required');
      const { token, base, username, node } = await accountToken(String(args.accountId));
      const days = Math.min(Math.max(Number(args.days) || 28, 1), 30);

      const profile = await graphGet(
        `${base}/${node}?fields=username,followers_count,media_count&access_token=${encodeURIComponent(token)}`,
      );

      const since = Math.floor(Date.now() / 1000) - days * 86400;
      const until = Math.floor(Date.now() / 1000);
      // These two metrics can't share a request: `reach` is a day-series, while
      // `profile_views` only answers to metric_type=total_value. Asking for both
      // at once makes Graph reject the whole call (#100), so they go separately
      // and each degrades on its own.
      const period: Record<string, unknown> = {};

      try {
        const ins = await graphGet(
          `${base}/${node}/insights?metric=reach&period=day&since=${since}&until=${until}&access_token=${encodeURIComponent(token)}`,
        );
        for (const d of ins.data || []) {
          period[d.name] = (d.values || []).reduce((sum: number, v: any) => sum + (Number(v.value) || 0), 0);
        }
      } catch (e) {
        // Account-level insights need instagram_manage_insights; without it the
        // profile counts are still useful, so report the gap rather than failing.
        period.reachError = e instanceof Error ? e.message : String(e);
      }

      try {
        const ins = await graphGet(
          `${base}/${node}/insights?metric=profile_views&metric_type=total_value&period=day&since=${since}&until=${until}&access_token=${encodeURIComponent(token)}`,
        );
        for (const d of ins.data || []) {
          period[d.name] = d.total_value?.value ?? null;
        }
      } catch (e) {
        period.profileViewsError = e instanceof Error ? e.message : String(e);
      }

      return {
        accountId: args.accountId,
        username: profile.username || username,
        followers: profile.followers_count ?? null,
        mediaCount: profile.media_count ?? null,
        windowDays: days,
        period,
      };
    }

    case 'get_media_comments': {
      if (!args.accountId) throw new Error('accountId is required');
      const { token, base, username, node } = await accountToken(String(args.accountId));
      const mediaLimit = Math.min(Number(args.mediaLimit) || 8, 25);
      const onlyUnanswered = args.onlyUnanswered === true;

      // The stored accountName can drift from the live handle; ask Graph so the
      // "did WE reply?" check below compares against the real username.
      let selfHandle = username;
      try {
        const me = await graphGet(`${base}/${node}?fields=username&access_token=${encodeURIComponent(token)}`);
        if (me.username) selfHandle = me.username;
      } catch { /* fall back to the stored name */ }

      const page = await graphGet(
        `${base}/${node}/media?fields=id,permalink,caption,timestamp&limit=${mediaLimit}&access_token=${encodeURIComponent(token)}`,
      );

      const out: any[] = [];
      await Promise.all(
        (page.data || []).map(async (m: any) => {
          try {
            const cs = await graphGet(
              `${base}/${m.id}/comments?fields=id,text,username,timestamp,like_count,replies{id,username}&limit=50&access_token=${encodeURIComponent(token)}`,
            );
            for (const c of cs.data || []) {
              // "Answered" = the account itself appears among the replies. Comparing
              // against our own username is what distinguishes a real reply from
              // other users chatting under the comment.
              const replies = c.replies?.data || [];
              const answeredByAccount = replies.some((r: any) => r.username && r.username === selfHandle);
              const item = {
                commentId: c.id,
                mediaId: m.id,
                permalink: m.permalink,
                from: c.username,
                text: c.text,
                timestamp: c.timestamp,
                likes: c.like_count ?? 0,
                replyCount: replies.length,
                answered: answeredByAccount,
              };
              if (!onlyUnanswered || !item.answered) out.push(item);
            }
          } catch {
            /* a single unreadable post must not blind the whole sweep */
          }
        }),
      );

      out.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
      return { accountId: args.accountId, mediaChecked: (page.data || []).length, count: out.length, comments: out };
    }

    case 'reply_to_comment': {
      if (!args.accountId) throw new Error('accountId is required');
      if (!args.commentId) throw new Error('commentId is required');
      if (!args.message) throw new Error('message is required');
      const text = String(args.message).trim();
      if (!text) throw new Error('message cannot be empty');
      if (text.length > 2200) throw new Error('message exceeds 2200 character limit');

      const { token, base } = await accountToken(String(args.accountId));
      const res = await fetch(`${base}/${args.commentId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ message: text, access_token: token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Graph API: ${(body as any)?.error?.message || `HTTP ${res.status}`}`);

      // Unlike send_message, nothing is queued here — the reply is already live.
      return { replied: true, replyId: (body as any).id, commentId: args.commentId };
    }

    default:
      throw new Error(`Unknown tool: "${name}"`);
  }
}

export default router;
