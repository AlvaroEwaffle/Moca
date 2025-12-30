import dotenv from 'dotenv';

// Load environment variables FIRST, before any other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

// Import routes
import instagramRoutes from './routes/instagram.routes';
import authRoutes from './routes/auth.routes';
import instagramOAuthRoutes from './routes/instagramOAuth.routes';
import globalAgentConfigRoutes from './routes/globalAgentConfig.routes';
import analyticsRoutes from './routes/analytics.routes';
import instagramCommentsRoutes from './routes/instagramComments.routes';
import followUpRoutes from './routes/followUp.routes';
import gmailAgentRoutes from './routes/gmailAgent.routes';
import googleOAuthRoutes from './routes/googleOAuth.routes';
import gmailRoutes from './routes/gmail.routes';
import gmailFetchRuleRoutes from './routes/gmailFetchRule.routes';
import emailDraftRoutes from './routes/emailDraft.routes';
import integrationsRoutes from './routes/integrations.routes';
import agentRoutes from './routes/agents.routes';

// Import services
import debounceWorker from './services/debounceWorker.service';
import senderWorker from './services/senderWorker.service';
import commentWorker from './services/commentWorker.service';
import { followUpWorkerService } from './services/followUpWorker.service';
import gmailFetchRuleWorker from './services/gmailFetchRuleWorker.service';
import emailDraftWorker from './services/emailDraftWorker.service';

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

console.log('🔧 Express app initialized');
console.log(`🔧 Server will run on port: ${PORT}`);

// Middleware
console.log('🔧 Setting up middleware...');

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000', // Development frontend (default Vite port)
    'http://localhost:8080', // Legacy dev port (kept for compatibility)
    'https://moca.pages.dev', // Production frontend
    'https://*.moca.pages.dev', // All Cloudflare Pages subdomains
    'https://*.pages.dev' // All Cloudflare Pages (for dynamic URLs)
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// API Routes
console.log('🔧 Setting up API routes...');
app.use('/api/instagram', instagramRoutes);
app.use('/api/instagram/oauth', instagramOAuthRoutes);
app.use('/api/instagram/comments', instagramCommentsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/global-agent-config', globalAgentConfigRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/follow-up', followUpRoutes);
// Gmail Agent + Gmail APIs (feature-flagged to avoid impacting Instagram)
const enableGmailAgent = process.env.ENABLE_GMAIL_AGENT === 'true';
if (enableGmailAgent) {
  console.log('✅ Gmail Agent module enabled (ENABLE_GMAIL_AGENT=true)');
  app.use('/api/internal/gmail-agent', gmailAgentRoutes);
  app.use('/api/integrations/google', googleOAuthRoutes);
  app.use('/api/integrations', integrationsRoutes);
  app.use('/api/gmail', gmailRoutes);
  app.use('/api/gmail/fetch-rules', gmailFetchRuleRoutes);
  app.use('/api/gmail/drafts', emailDraftRoutes);
  app.use('/api/agents', agentRoutes);
} else {
  console.log('⏸️ Gmail Agent module disabled (ENABLE_GMAIL_AGENT is not true)');
}
console.log('✅ API routes setup completed');

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error handling middleware triggered:', err);
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
console.log('📊 MongoDB URI:', MONGODB_URI);

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
             // Run follow-up processing at 9 AM, 4 PM, and 8 PM
             const scheduleFollowUpRuns = () => {
               const now = new Date();
               const times = [9, 16, 20]; // 9 AM, 4 PM, 8 PM in 24-hour format
               
               times.forEach(hour => {
                 const nextRun = new Date();
                 nextRun.setHours(hour, 0, 0, 0);
                 
                 // If the time has passed today, schedule for tomorrow
                 if (nextRun <= now) {
                   nextRun.setDate(nextRun.getDate() + 1);
                 }
                 
                 const delay = nextRun.getTime() - now.getTime();
                 
                 setTimeout(async () => {
                   try {
                     console.log(`🕘 [Follow-up Worker] Running scheduled follow-up at ${hour}:00`);
                     await followUpWorkerService.processFollowUps();
                     
                     // Schedule the next run for the same time tomorrow
                     setInterval(async () => {
                       try {
                         console.log(`🕘 [Follow-up Worker] Running scheduled follow-up at ${hour}:00`);
                         await followUpWorkerService.processFollowUps();
                       } catch (error) {
                         console.error('❌ Error in scheduled follow-up processing:', error);
                       }
                     }, 24 * 60 * 60 * 1000); // 24 hours
                   } catch (error) {
                     console.error('❌ Error in initial follow-up processing:', error);
                   }
                 }, delay);
                 
                 console.log(`⏰ [Follow-up Worker] Next run scheduled for ${hour}:00 in ${Math.round(delay / 1000 / 60)} minutes`);
               });
             };
             
             scheduleFollowUpRuns();
             
             console.log('✅ Follow-up worker service started successfully');

      if (enableGmailAgent) {
        console.log('🔄 Starting Gmail fetch rule worker service (feature-flagged)...');
        gmailFetchRuleWorker.start();
        console.log('✅ Gmail fetch rule worker service started successfully');
        
        console.log('🔄 Starting email draft worker service (feature-flagged)...');
        emailDraftWorker.start();
        console.log('✅ Email draft worker service started successfully');
      } else {
        console.log('⏸️ Gmail workers not started (ENABLE_GMAIL_AGENT is not true)');
      }
      
      console.log('✅ All background services started successfully');
    } catch (error) {
      console.error('❌ Error starting background services:', error);
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
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  
  try {
    console.log('🛑 Stopping background services...');
    await debounceWorker.stop();
    await senderWorker.stop();
    commentWorker.stop();
    if (enableGmailAgent) {
      gmailFetchRuleWorker.stop();
      emailDraftWorker.stop();
    }
    console.log('✅ Background services stopped');
    
    console.log('🛑 Closing MongoDB connection...');
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  
  try {
    console.log('🛑 Stopping background services...');
    await debounceWorker.stop();
    await senderWorker.stop();
    commentWorker.stop();
    if (enableGmailAgent) {
      gmailFetchRuleWorker.stop();
      emailDraftWorker.stop();
    }
    console.log('✅ Background services stopped');
    
    console.log('🛑 Closing MongoDB connection...');
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
});

export default app;
