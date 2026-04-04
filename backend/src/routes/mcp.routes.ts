import express, { Request, Response, NextFunction } from 'express';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import InstagramAccount from '../models/instagramAccount.model';

const router = express.Router();

// ─── Tool definitions ────────────────────────────────────────────────────────

const MCP_TOOLS = [
  {
    name: 'get_conversation_count',
    description: 'Obtiene el número total de conversaciones en Moca.',
    schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_recent_conversations',
    description: 'Retorna las conversaciones más recientes de Instagram.',
    schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Número de conversaciones a retornar (default 10, max 50)' },
        minScore: { type: 'number', description: 'Filtrar por score mínimo (1-7)' },
      },
      required: [],
    },
  },
  {
    name: 'get_lead_stats',
    description: 'Obtiene estadísticas de leads agrupadas por score (1-7).',
    schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_account_count',
    description: 'Obtiene el número de cuentas de Instagram conectadas.',
    schema: { type: 'object', properties: {}, required: [] },
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

/**
 * GET /api/mcp/tools — list available MCP tools
 */
router.get('/tools', requirePlatformKey, (_req: Request, res: Response) => {
  res.json({ success: true, tools: MCP_TOOLS });
});

/**
 * POST /api/mcp/tools/execute — execute a tool by name
 */
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

    case 'get_lead_stats': {
      const stats = await Conversation.aggregate([
        {
          $group: {
            _id: '$leadScoring.currentScore',
            count: { $sum: 1 },
          },
        },
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

    default:
      throw new Error(`Unknown tool: "${name}"`);
  }
}

export default router;
