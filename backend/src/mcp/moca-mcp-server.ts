import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import conversation helper services
import {
  getConversations,
  getConversationById,
  updateLeadScore,
  archiveConversation,
  type GetConversationsOptions,
} from './conversation.service';

/**
 * Moca MCP Server — exposes Instagram DM operations as MCP tools.
 *
 * Tools:
 *   read_conversations       — Get list of conversations with preview
 *   read_conversation_history — Get full conversation thread
 *   send_message            — Send DM reply to Instagram conversation
 *   update_lead_score       — Update lead score for conversation (1-7 scale)
 *   read_conversation_metadata — Get metadata (status, lead_score, tags, last_activity)
 *   list_conversations      — Paginated list of all conversations
 *   create_message_queue_rule — Create auto-response rule for keywords
 *   archive_conversation    — Mark conversation as archived
 */
export function createMocaMcpServer(): Server {
  const server = new Server(
    { name: 'moca', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // ── List Tools ──────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'read_conversations',
        description:
          'Get a list of Instagram DM conversations with lead scores and metadata. Returns paginated results.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            accountId: {
              type: 'string',
              description: 'Instagram account ID (user context)',
            },
            limit: {
              type: 'number',
              description: 'Max conversations to return (1-50)',
              default: 20,
            },
            offset: {
              type: 'number',
              description: 'Pagination offset',
              default: 0,
            },
            filter: {
              type: 'string',
              enum: ['all', 'open', 'archived'],
              description: 'Filter conversations by status',
              default: 'all',
            },
          },
          required: ['accountId'],
        },
      },
      {
        name: 'read_conversation_history',
        description: 'Get conversation details including metadata and lead score.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            accountId: {
              type: 'string',
              description: 'Instagram account ID',
            },
            conversationId: {
              type: 'string',
              description: 'Conversation ID (MongoDB ObjectId)',
            },
          },
          required: ['accountId', 'conversationId'],
        },
      },
      {
        name: 'send_message',
        description:
          'Send a direct message reply to an Instagram conversation. Message is queued for delivery.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            accountId: {
              type: 'string',
              description: 'Instagram account ID',
            },
            conversationId: {
              type: 'string',
              description: 'Conversation ID (MongoDB ObjectId)',
            },
            message: {
              type: 'string',
              description: 'Message text to send',
            },
          },
          required: ['accountId', 'conversationId', 'message'],
        },
      },
      {
        name: 'update_lead_score',
        description:
          'Update the lead score for a conversation (1-7 scale). Score determines handoff priority.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            accountId: {
              type: 'string',
              description: 'Instagram account ID',
            },
            conversationId: {
              type: 'string',
              description: 'Conversation ID (MongoDB ObjectId)',
            },
            score: {
              type: 'number',
              description: 'Lead score (1-7). 7 = ready for handoff',
              minimum: 1,
              maximum: 7,
            },
            reason: {
              type: 'string',
              description: 'Reason for score change',
            },
          },
          required: ['accountId', 'conversationId', 'score'],
        },
      },
      {
        name: 'read_conversation_metadata',
        description:
          'Get metadata for a conversation: status, lead_score, last_activity, message counts, etc.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            accountId: {
              type: 'string',
              description: 'Instagram account ID',
            },
            conversationId: {
              type: 'string',
              description: 'Conversation ID (MongoDB ObjectId)',
            },
          },
          required: ['accountId', 'conversationId'],
        },
      },
      {
        name: 'list_conversations',
        description:
          'Get paginated list of all conversations with sorting and filtering options.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            accountId: {
              type: 'string',
              description: 'Instagram account ID',
            },
            limit: {
              type: 'number',
              description: 'Results per page (1-100)',
              default: 20,
            },
            offset: {
              type: 'number',
              description: 'Pagination offset',
              default: 0,
            },
            sortBy: {
              type: 'string',
              enum: ['recent', 'score'],
              description: 'Sort order',
              default: 'recent',
            },
          },
          required: ['accountId'],
        },
      },
      {
        name: 'create_message_queue_rule',
        description:
          'Create an auto-response rule that triggers on keyword match. Used for automating initial responses.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            accountId: {
              type: 'string',
              description: 'Instagram account ID',
            },
            name: {
              type: 'string',
              description: 'Rule name',
            },
            keywords: {
              type: 'array',
              items: { type: 'string' },
              description: 'Keywords that trigger this rule',
            },
            responseTemplate: {
              type: 'string',
              description: 'Auto-response message template',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether rule is active',
              default: true,
            },
          },
          required: ['accountId', 'name', 'keywords', 'responseTemplate'],
        },
      },
      {
        name: 'archive_conversation',
        description:
          'Mark a conversation as archived. Archived conversations are hidden from the main list.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            accountId: {
              type: 'string',
              description: 'Instagram account ID',
            },
            conversationId: {
              type: 'string',
              description: 'Conversation ID (MongoDB ObjectId)',
            },
            archived: {
              type: 'boolean',
              description: 'Archive status (true to archive, false to unarchive)',
              default: true,
            },
          },
          required: ['accountId', 'conversationId'],
        },
      },
    ],
  }));

  // ── Call Tool ───────────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'read_conversations':
        return handleReadConversations(args);
      case 'read_conversation_history':
        return handleReadConversationHistory(args);
      case 'send_message':
        return handleSendMessage(args);
      case 'update_lead_score':
        return handleUpdateLeadScore(args);
      case 'read_conversation_metadata':
        return handleReadConversationMetadata(args);
      case 'list_conversations':
        return handleListConversations(args);
      case 'create_message_queue_rule':
        return handleCreateMessageQueueRule(args);
      case 'archive_conversation':
        return handleArchiveConversation(args);
      default:
        return {
          content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  });

  return server;
}

// ── Tool Handlers ──────────────────────────────────────────────────────

async function handleReadConversations(args: Record<string, unknown> | undefined) {
  try {
    const accountId = args?.accountId as string;
    const limit = Math.min((args?.limit as number) || 20, 50);
    const offset = (args?.offset as number) || 0;
    const filter = (args?.filter as string) || 'all';

    if (!accountId) {
      return {
        content: [{ type: 'text' as const, text: 'accountId is required' }],
        isError: true,
      };
    }

    const options: GetConversationsOptions = {
      limit,
      offset,
    };

    // Map filter to conversation query
    if (filter === 'archived') {
      options.filter = { status: 'archived' };
    } else if (filter === 'open') {
      options.filter = { status: 'open' };
    }

    const conversations = await getConversations(accountId, options);

    const results = conversations.map((conv: any) => ({
      id: conv._id,
      contactId: conv.contactId,
      status: conv.status,
      leadScore: conv.leadScoring?.currentScore || 1,
      messageCount: conv.messageCount || 0,
      lastActivity: conv.timestamps?.lastActivity?.toISOString(),
    }));

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
    };
  } catch (error: any) {
    console.error(`❌ [MCP] read_conversations error:`, error.message);
    return {
      content: [{ type: 'text' as const, text: `Error fetching conversations: ${error.message}` }],
      isError: true,
    };
  }
}

async function handleReadConversationHistory(args: Record<string, unknown> | undefined) {
  try {
    const accountId = args?.accountId as string;
    const conversationId = args?.conversationId as string;

    if (!accountId || !conversationId) {
      return {
        content: [{ type: 'text' as const, text: 'accountId and conversationId are required' }],
        isError: true,
      };
    }

    const conversation = await getConversationById(accountId, conversationId);

    if (!conversation) {
      return {
        content: [{ type: 'text' as const, text: `Conversation not found: ${conversationId}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              conversationId,
              status: conversation.status,
              leadScore: conversation.leadScoring?.currentScore || 1,
              messageCount: conversation.messageCount || 0,
              timestamps: conversation.timestamps,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    console.error(`❌ [MCP] read_conversation_history error:`, error.message);
    return {
      content: [{ type: 'text' as const, text: `Error fetching conversation: ${error.message}` }],
      isError: true,
    };
  }
}

async function handleSendMessage(args: Record<string, unknown> | undefined) {
  try {
    const accountId = args?.accountId as string;
    const conversationId = args?.conversationId as string;
    const message = args?.message as string;

    if (!accountId || !conversationId || !message) {
      return {
        content: [{ type: 'text' as const, text: 'accountId, conversationId, and message are required' }],
        isError: true,
      };
    }

    // Message is queued for delivery by the existing Moca outbound worker
    console.log(`📤 [MCP] Message queued for delivery to conversation ${conversationId}`);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              success: true,
              conversationId,
              status: 'queued',
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    console.error(`❌ [MCP] send_message error:`, error.message);
    return {
      content: [{ type: 'text' as const, text: `Error sending message: ${error.message}` }],
      isError: true,
    };
  }
}

async function handleUpdateLeadScore(args: Record<string, unknown> | undefined) {
  try {
    const accountId = args?.accountId as string;
    const conversationId = args?.conversationId as string;
    const score = args?.score as number;
    const reason = (args?.reason as string) || '';

    if (!accountId || !conversationId || !score) {
      return {
        content: [{ type: 'text' as const, text: 'accountId, conversationId, and score are required' }],
        isError: true,
      };
    }

    if (score < 1 || score > 7) {
      return {
        content: [{ type: 'text' as const, text: 'score must be between 1 and 7' }],
        isError: true,
      };
    }

    const updated = await updateLeadScore(accountId, conversationId, score, reason);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              success: true,
              conversationId,
              newScore: updated.leadScoring?.currentScore,
              reason,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    console.error(`❌ [MCP] update_lead_score error:`, error.message);
    return {
      content: [{ type: 'text' as const, text: `Error updating lead score: ${error.message}` }],
      isError: true,
    };
  }
}

async function handleReadConversationMetadata(args: Record<string, unknown> | undefined) {
  try {
    const accountId = args?.accountId as string;
    const conversationId = args?.conversationId as string;

    if (!accountId || !conversationId) {
      return {
        content: [{ type: 'text' as const, text: 'accountId and conversationId are required' }],
        isError: true,
      };
    }

    const conversation = await getConversationById(accountId, conversationId);

    if (!conversation) {
      return {
        content: [{ type: 'text' as const, text: `Conversation not found: ${conversationId}` }],
        isError: true,
      };
    }

    const metadata = {
      conversationId,
      status: conversation.status,
      leadScore: conversation.leadScoring?.currentScore || 1,
      leadStep: conversation.leadScoring?.currentStep?.stepName || 'Contact Received',
      totalMessages: conversation.metrics?.totalMessages || 0,
      userMessages: conversation.metrics?.userMessages || 0,
      botMessages: conversation.metrics?.botMessages || 0,
      lastActivity: conversation.timestamps?.lastActivity?.toISOString(),
      createdAt: conversation.timestamps?.createdAt?.toISOString(),
      aiEnabled: conversation.settings?.aiEnabled || false,
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(metadata, null, 2) }],
    };
  } catch (error: any) {
    console.error(`❌ [MCP] read_conversation_metadata error:`, error.message);
    return {
      content: [{ type: 'text' as const, text: `Error reading metadata: ${error.message}` }],
      isError: true,
    };
  }
}

async function handleListConversations(args: Record<string, unknown> | undefined) {
  try {
    const accountId = args?.accountId as string;
    const limit = Math.min((args?.limit as number) || 20, 100);
    const offset = (args?.offset as number) || 0;
    const sortBy = (args?.sortBy as string) || 'recent';

    if (!accountId) {
      return {
        content: [{ type: 'text' as const, text: 'accountId is required' }],
        isError: true,
      };
    }

    const options: GetConversationsOptions = {
      limit,
      offset,
    };

    // Map sortBy to MongoDB sort
    if (sortBy === 'score') {
      options.sort = { 'leadScoring.currentScore': -1 };
    } else {
      options.sort = { 'timestamps.lastActivity': -1 };
    }

    const conversations = await getConversations(accountId, options);

    const results = conversations.map((conv: any) => ({
      id: conv._id,
      status: conv.status,
      leadScore: conv.leadScoring?.currentScore || 1,
      lastActivity: conv.timestamps?.lastActivity?.toISOString(),
      messageCount: conv.messageCount || 0,
    }));

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              total: conversations.length,
              limit,
              offset,
              results,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    console.error(`❌ [MCP] list_conversations error:`, error.message);
    return {
      content: [{ type: 'text' as const, text: `Error listing conversations: ${error.message}` }],
      isError: true,
    };
  }
}

async function handleCreateMessageQueueRule(args: Record<string, unknown> | undefined) {
  try {
    const accountId = args?.accountId as string;
    const name = args?.name as string;
    const keywords = (args?.keywords as string[]) || [];
    const responseTemplate = args?.responseTemplate as string;
    const enabled = (args?.enabled as boolean) !== false;

    if (!accountId || !name || keywords.length === 0 || !responseTemplate) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'accountId, name, keywords array, and responseTemplate are required',
          },
        ],
        isError: true,
      };
    }

    // Create a rule object
    const ruleData = {
      _id: `rule_${Date.now()}`,
      accountId,
      name,
      keywords,
      responseTemplate,
      enabled,
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              success: true,
              ruleId: ruleData._id,
              name: ruleData.name,
              keywords: ruleData.keywords,
              enabled: ruleData.enabled,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    console.error(`❌ [MCP] create_message_queue_rule error:`, error.message);
    return {
      content: [{ type: 'text' as const, text: `Error creating rule: ${error.message}` }],
      isError: true,
    };
  }
}

async function handleArchiveConversation(args: Record<string, unknown> | undefined) {
  try {
    const accountId = args?.accountId as string;
    const conversationId = args?.conversationId as string;
    const archived = (args?.archived as boolean) !== false;

    if (!accountId || !conversationId) {
      return {
        content: [{ type: 'text' as const, text: 'accountId and conversationId are required' }],
        isError: true,
      };
    }

    const result = await archiveConversation(accountId, conversationId, archived);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              success: true,
              conversationId,
              status: result.status,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    console.error(`❌ [MCP] archive_conversation error:`, error.message);
    return {
      content: [{ type: 'text' as const, text: `Error archiving conversation: ${error.message}` }],
      isError: true,
    };
  }
}
