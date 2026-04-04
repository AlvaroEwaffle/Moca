import dotenv from 'dotenv';

// Load environment variables FIRST, before any other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

// Import routes
import instagramRoutes from './routes/instagram.routes';
import authRoutes from './routes/auth.routes';
import instagramOAuthRoutes from './routes/instagramOAuth.routes';
import globalAgentConfigRoutes from './routes/globalAgentConfig.routes';
import analyticsRoutes from './routes/analytics.routes';
import instagramCommentsRoutes from './routes/instagramComments.routes';
import followUpRoutes from './routes/followUp.routes';
import agentRoutes from './routes/agents.routes';
import mcpRoutes from './routes/mcp.routes';

// Import services
import debounceWorker from './services/debounceWorker.service';
import senderWorker from './services/senderWorker.service';
import commentWorker from './services/commentWorker.service';
import { followUpWorkerService } from './services/followUpWorker.service';
import { notifyError } from './utils/slack';

console.log('🚀 Moca Instagram DM Agent: Starting application...');

// Debug: Log environment variables
console.log('🔧 [Environment Check] Loaded environment variables:', {
  MONGODB_URI: !!process.env.MONGODB_URI,
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  INSTAGRAM_VERIFY_TOKEN: !!process.env.INSTAGRAM_VERIFY_TOKEN,
  INSTAGRAM_APP_SECRET: !!process.env.INSTAGRAM_APP_SECRET,
  INSTAGRAM_ACCESS_TOKEN: !!process.env.INSTAGRAM_ACCESS_TOKEN,
  NODE_ENV: process.env.NODE_ENV
});

// Debug: Show actual verify token value (first few characters for security)
if (process.env.INSTAGRAM_VERIFY_TOKEN) {
  console.log('🔧 [Environment Check] INSTAGRAM_VERIFY_TOKEN:',
    process.env.INSTAGRAM_VERIFY_TOKEN.substring(0, 3) + '...');
} else {
  console.log('🔧 [Environment Check] INSTAGRAM_VERIFY_TOKEN: NOT SET');
}

const app = express();
const PORT = process.env.PORT || 3002;

// In-memory circular log buffer — last 500 lines, accessible via /api/debug/logs
const LOG_BUFFER: { ts: string; level: string; msg: string }[] = [];
const MAX_LOG_LINES = 500;
const _origLog = console.log.bind(console);
const _origErr = console.error.bind(console);
const _origWarn = console.warn.bind(console);
const pushLog = (level: string, args: any[]) => {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  LOG_BUFFER.push({ ts: new Date().toISOString(), level, msg });
  if (LOG_BUFFER.length > MAX_LOG_LINES) LOG_BUFFER.shift();
};
console.log = (...args: any[]) => { pushLog('inf', args); _origLog(...args); };
console.error = (...args: any[]) => { pushLog('err', args); _origErr(...args); };
console.warn = (...args: any[]) => { pushLog('wrn', args); _origWarn(...args); };

console.log('🔧 Express app initialized');
console.log(`🔧 Server will run on port: ${PORT}`);

// Middleware
console.log('🔧 Setting up middleware...');

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000', // Development frontend (legacy, kept for compat)
    'http://localhost:5170', // Development frontend (assigned Vite port)
    'http://localhost:5174', // Development frontend (legacy Vite port)
    'http://localhost:5180', // Vilo Platform Dashboard
    'http://localhost:8080', // Legacy dev port (kept for compatibility)
    'https://moca.pages.dev', // Production frontend
    'https://*.moca.pages.dev', // All Cloudflare Pages subdomains
    'https://*.pages.dev' // All Cloudflare Pages (for dynamic URLs)
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token', 'x-platform-key']
};

app.use(cors(corsOptions));
// Capture raw body before JSON parsing — needed for webhook signature validation
app.use(express.json({
  verify: (req: any, _res, buf) => { req.rawBody = buf.toString('utf8'); }
}));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — global: 100 requests per 15 minutes per IP
// Skip webhook endpoints — Meta sends server-to-server bursts that must not be rate-limited
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
  skip: (req) => req.path.includes('/webhook')
});
app.use('/api/', apiLimiter);

// Strict rate limit for auth endpoints: 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

console.log('✅ Middleware setup completed');

// Basic health check
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Moca Instagram DM Agent API',
    version: '1.0.0'
  });
});

// Debug log viewer — returns last N lines from in-memory buffer
// Protected by DEBUG_TOKEN env var. Call: GET /api/debug/logs?token=xxx&n=100
app.get('/api/debug/logs', (req, res) => {
  const token = process.env.DEBUG_TOKEN;
  if (!token || req.query.token !== token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const n = Math.min(parseInt(req.query.n as string) || 100, MAX_LOG_LINES);
  res.json({ lines: LOG_BUFFER.slice(-n), total: LOG_BUFFER.length });
});

// API Routes
console.log('🔧 Setting up API routes...');
app.use('/api/instagram', instagramRoutes);
app.use('/api/instagram/oauth', instagramOAuthRoutes);
app.use('/api/instagram/comments', instagramCommentsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/global-agent-config', globalAgentConfigRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/follow-up', followUpRoutes);
app.use('/api/agents', agentRoutes);

// Platform MCP — service-to-service, protected by X-Platform-Key
app.use('/api/mcp', mcpRoutes);
console.log('✅ API routes setup completed');

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error handling middleware triggered:', err);
  notifyError({
    service: 'Express',
    message: `Unhandled error on ${req.method} ${req.originalUrl}`,
    error: err,
    context: { method: req.method, url: req.originalUrl }
  });
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 middleware
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

console.log('🔌 Connecting to MongoDB...');

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB successfully');
    console.log('🗄️  Database:', mongoose.connection.db?.databaseName || 'Unknown');

    // Start background services
    console.log('🔧 Starting background services...');

    try {
      console.log('🔄 Starting debounce worker service...');
      await debounceWorker.start();
      console.log('✅ Debounce worker service started successfully');

      console.log('🔄 Starting sender worker service...');
      await senderWorker.start();
      console.log('✅ Sender worker service started successfully');

      console.log('🔄 Starting comment worker service...');
      commentWorker.start();
      console.log('✅ Comment worker service started successfully');

      console.log('🔄 Starting follow-up worker service...');
      // Run follow-up processing every hour from 9 AM to 11 PM
      const FOLLOWUP_START_HOUR = 9;
      const FOLLOWUP_END_HOUR = 23;
      const scheduleFollowUpRuns = () => {
        const now = new Date();
        // Align next run to the top of the next hour
        const nextRun = new Date(now);
        nextRun.setMinutes(0, 0, 0);
        nextRun.setHours(nextRun.getHours() + 1);

        const delay = nextRun.getTime() - now.getTime();
        console.log(`⏰ [Follow-up Worker] Next hourly check in ${Math.round(delay / 1000 / 60)} minutes`);

        setTimeout(() => {
          // Run immediately at the top of the hour if within active window
          const hour = new Date().getHours();
          if (hour >= FOLLOWUP_START_HOUR && hour <= FOLLOWUP_END_HOUR) {
            followUpWorkerService.processFollowUps().catch(err =>
              console.error('❌ Error in follow-up processing:', err)
            );
          } else {
            console.log(`⏸️ [Follow-up Worker] Outside active hours (${FOLLOWUP_START_HOUR}–${FOLLOWUP_END_HOUR}), skipping`);
          }
          // Then repeat every hour
          setInterval(async () => {
            const h = new Date().getHours();
            if (h >= FOLLOWUP_START_HOUR && h <= FOLLOWUP_END_HOUR) {
              console.log(`🕘 [Follow-up Worker] Running hourly follow-up at ${h}:00`);
              await followUpWorkerService.processFollowUps().catch(err =>
                console.error('❌ Error in follow-up processing:', err)
              );
            } else {
              console.log(`⏸️ [Follow-up Worker] Outside active hours (${FOLLOWUP_START_HOUR}–${FOLLOWUP_END_HOUR}), skipping`);
            }
          }, 60 * 60 * 1000); // every 1 hour
        }, delay);
      };

      scheduleFollowUpRuns();
      console.log('✅ Follow-up worker service started successfully');

      console.log('✅ All background services started successfully');
    } catch (error) {
      console.error('❌ Error starting background services:', error);
      notifyError({ service: 'Startup', message: 'Failed to start background services', error });
      process.exit(1);
    }

    // Start server
    app.listen(PORT, () => {
      console.log('🎉 Moca Instagram DM Agent API started successfully!');
      console.log('📱 Moca Instagram DM Agent API running on port', PORT);
      console.log('📊 Health check: http://localhost:' + PORT + '/api/health');
      console.log('📱 Instagram routes: http://localhost:' + PORT + '/api/instagram');
      console.log('🔄 Debounce worker: Running every 30 seconds');
      console.log('📤 Sender worker: Running every 30 seconds');
      console.log('💬 Comment worker: Running every 30 seconds');
      console.log('✅ Application ready to receive requests');
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    notifyError({ service: 'MongoDB', message: 'Database connection failed', error });
    process.exit(1);
  });

// Graceful shutdown
const shutdown = async () => {
  console.log('🛑 Shutting down gracefully...');
  try {
    await debounceWorker.stop();
    await senderWorker.stop();
    commentWorker.stop();
    console.log('✅ Background services stopped');
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Catch unhandled errors and notify via Slack
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  notifyError({ service: 'Process', message: 'Unhandled Promise Rejection', error: reason });
});
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  notifyError({ service: 'Process', message: 'Uncaught Exception', error });
});

export default app;
