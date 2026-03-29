import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

import mongoose from 'mongoose';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMocaMcpServer } from './moca-mcp-server';
import { appConfig } from '../config';

async function main() {
  // Use stderr for logging — stdout is reserved for MCP protocol messages
  console.error('🚀 [Moca MCP] Starting MCP server...');

  // Validate critical env vars
  if (!appConfig.mongoUri) {
    console.error('❌ [Moca MCP] MONGODB_URI not set. Exiting.');
    process.exit(1);
  }

  // Connect to MongoDB (needed for Conversation model lookups)
  try {
    await mongoose.connect(appConfig.mongoUri);
    console.error('✅ [Moca MCP] Connected to MongoDB');
  } catch (error: any) {
    console.error(`❌ [Moca MCP] MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }

  // Create and start MCP server with stdio transport
  const server = createMocaMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error('✅ [Moca MCP] Server running on stdio transport');

  // Graceful shutdown
  const shutdown = async () => {
    console.error('🛑 [Moca MCP] Shutting down...');
    try {
      await server.close();
      await mongoose.connection.close();
      console.error('✅ [Moca MCP] Shutdown complete');
    } catch (error) {
      console.error('❌ [Moca MCP] Error during shutdown:', error);
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('❌ [Moca MCP] Fatal error:', error);
  process.exit(1);
});
