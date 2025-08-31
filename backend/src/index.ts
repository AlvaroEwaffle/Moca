import dotenv from 'dotenv';

// Load environment variables FIRST, before any other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

// Import routes
import instagramRoutes from './routes/instagram.routes';

// Debug: Log environment variables
console.log('🔧 [Environment Check] Loaded environment variables:', {
  MONGODB_URI: !!process.env.MONGODB_URI,
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  INSTAGRAM_VERIFY_TOKEN: !!process.env.INSTAGRAM_VERIFY_TOKEN,
  INSTAGRAM_APP_SECRET: !!process.env.INSTAGRAM_APP_SECRET,
  INSTAGRAM_ACCESS_TOKEN: !!process.env.INSTAGRAM_ACCESS_TOKEN,
  NODE_ENV: process.env.NODE_ENV
});

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Moca Instagram DM Agent API',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/instagram', instagramRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 middleware
app.use('*', (req, res) => {
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
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
    console.log('🗄️  Database:', mongoose.connection.db?.databaseName || 'Unknown');
    
    // Start server
    app.listen(PORT, () => {
      console.log('📱 Moca Instagram DM Agent API running on port', PORT);
      console.log('📊 Health check: http://localhost:' + PORT + '/api/health');
      console.log('📱 Instagram routes: http://localhost:' + PORT + '/api/instagram');
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

export default app;
