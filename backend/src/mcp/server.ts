import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { appConfig } from '../config';
import { logger } from '../utils/logger';
import {
  getConversations,
  getConversationById,
  updateLeadScore,
  archiveConversation,
} from './conversation.service';

const app = express();
const MCP_PORT = parseInt(process.env.MCP_PORT || '4002', 10);

// ── Middleware ──────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://vilo-dashboard.railway.app', 'https://vilo.pages.dev']
    : ['http://localhost:5181', 'http://localhost:3010'],
  credentials: true,
}));

// Rate limiting: 100 requests per minute per API key
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req: any) => req.headers['x-api-key'] || req.ip,
  message: 'Too many requests, please try again later',
  standardHeaders: false,
  skip: (req) => req.path === '/health',
});

app.use(apiLimiter);

// ── Public Health Check (before auth) ────────────────────────────────
app.get('/health', async (req: Request, res: Response) => {
  try {
    const mongoHealth = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
    return res.status(200).json({
      status: mongoHealth,
      service: 'moca-mcp-server',
      tools: 8,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      service: 'moca-mcp-server',
      timestamp: new Date().toISOString(),
    });
  }
});

// ── Auth Middleware ────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'MISSING_API_KEY',
      message: 'X-API-Key header is required',
      timestamp: new Date().toISOString(),
    });
  }

  // Validate API key (format: moca_xxx)
  if (typeof apiKey !== 'string' || !apiKey.startsWith('moca_')) {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'INVALID_API_KEY',
      message: 'Invalid API key format',
      timestamp: new Date().toISOString(),
    });
  }

  // Store tenantId from API key (format: moca_<tenantId>_<secret>)
  const parts = apiKey.split('_');
  if (parts.length < 3) {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'INVALID_API_KEY_FORMAT',
      message: 'API key must be in format moca_<tenantId>_<secret>',
      timestamp: new Date().toISOString(),
    });
  }

  (req as any).tenantId = parts[1];
  (req as any).apiKey = apiKey;

  next();
});

// ── Error Handler Middleware ────────────────────────────────────────────────────
const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('MCP Server', 'API Error', {
    tool: req.path,
    tenantId: (req as any).tenantId,
    error: error.message,
    statusCode: error.statusCode || 500,
  });

  const statusCode = error.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : error.message;

  return res.status(statusCode).json({
    error: error.code || 'INTERNAL_ERROR',
    code: error.code || 'INTERNAL_ERROR',
    message,
    timestamp: new Date().toISOString(),
  });
};

// ── MCP Tool Routes ──────────────────────────────────────────────────────

// read_conversations: Get list of Instagram conversations
app.post('/tools/read_conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, limit = 20, offset = 0 } = req.body;

    if (!accountId) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'accountId is required',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await getConversations(accountId, { limit, offset });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// read_conversation_history: Get full conversation thread
app.post('/tools/read_conversation_history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, conversationId } = req.body;

    if (!accountId || !conversationId) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'accountId and conversationId are required',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await getConversationById(accountId, conversationId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// send_message: Send DM reply
app.post('/tools/send_message', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, conversationId, message } = req.body;

    if (!accountId || !conversationId || !message) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'accountId, conversationId, and message are required',
        timestamp: new Date().toISOString(),
      });
    }

    // TODO: Implement actual Instagram API call
    return res.status(200).json({
      success: true,
      conversationId,
      messageId: `msg_${Date.now()}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// update_lead_score: Update lead score (1-7)
app.post('/tools/update_lead_score', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, conversationId, score, reason } = req.body;

    if (!accountId || !conversationId || !score) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'accountId, conversationId, and score are required',
        timestamp: new Date().toISOString(),
      });
    }

    if (score < 1 || score > 7) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'score must be between 1 and 7',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await updateLeadScore(accountId, conversationId, score, reason || '');
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// read_conversation_metadata: Get conversation metadata
app.post('/tools/read_conversation_metadata', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, conversationId } = req.body;

    if (!accountId || !conversationId) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'accountId and conversationId are required',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await getConversationById(accountId, conversationId);
    return res.status(200).json({
      conversationId,
      status: result?.status || 'unknown',
      leadScore: result?.leadScoring?.currentScore || 0,
      lastActivity: result?.timestamps?.lastActivity || null,
      messageCount: result?.metrics?.totalMessages || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// list_conversations: Paginated list of conversations
app.post('/tools/list_conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, limit = 50, offset = 0 } = req.body;

    if (!accountId) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'accountId is required',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await getConversations(accountId, { limit, offset });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// create_message_queue_rule: Create auto-response rule
app.post('/tools/create_message_queue_rule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, keywords, response } = req.body;

    if (!userId || !keywords || !response) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'userId, keywords, and response are required',
        timestamp: new Date().toISOString(),
      });
    }

    // TODO: Implement rule creation
    return res.status(200).json({
      success: true,
      ruleId: `rule_${Date.now()}`,
      keywords,
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// archive_conversation: Mark conversation as archived
app.post('/tools/archive_conversation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, conversationId, archived = true } = req.body;

    if (!accountId || !conversationId) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'accountId and conversationId are required',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await archiveConversation(accountId, conversationId, archived);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// ── Fallback Routes ──────────────────────────────────────────────────────

// 404 handler
app.use((req: Request, res: Response) => {
  return res.status(404).json({
    error: 'NOT_FOUND',
    message: `Endpoint ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use(errorHandler);

// ── Server Startup ──────────────────────────────────────────────────────
async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(appConfig.mongoUri);
    console.log('🔗 [Moca MCP] Connected to MongoDB');

    // Start Express server
    app.listen(MCP_PORT, () => {
      console.log(`🚀 [Moca MCP] Server running on port ${MCP_PORT}`);
      console.log(`📍 [Moca MCP] Health check: http://localhost:${MCP_PORT}/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🛑 [Moca MCP] Shutting down gracefully...');
      await mongoose.connection.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('🛑 [Moca MCP] Shutting down gracefully...');
      await mongoose.connection.close();
      process.exit(0);
    });
  } catch (error: any) {
    console.error(`❌ [Moca MCP] Startup failed: ${error.message}`);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

export default app;
