import express, { Request, Response, NextFunction } from 'express';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import InstagramAccount from '../models/instagramAccount.model';
import OutboundQueue from '../models/outboundQueue.model';
import GlobalAgentConfig from '../models/globalAgentConfig.model';

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
    name: 'get_messages',
    description: 'Mensajes de una conversación específica.',
    schema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string', description: 'ID de la conversación' },
        limit: { type: 'number', description: 'Default 20, max 50' },
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
];

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

    case 'get_messages': {
      if (!args.conversationId) throw new Error('conversationId is required');
      const limit = Math.min(Number(args.limit) || 20, 50);

      const messages = await Message.find({ conversationId: args.conversationId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('content direction createdAt')
        .lean();

      return { messages, count: messages.length };
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

    default:
      throw new Error(`Unknown tool: "${name}"`);
  }
}

export default router;
