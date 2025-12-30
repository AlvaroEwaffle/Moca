import express from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  createFetchRule,
  updateFetchRule,
  deleteFetchRule,
  getUserFetchRules,
  getFetchRule,
  executeFetchRule
} from '../services/gmailFetchRule.service';
import { fetchEmails } from '../services/gmail.service';
import GmailFetchRule from '../models/gmailFetchRule.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import Contact from '../models/contact.model';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * GET /api/gmail/fetch-rules
 * Get all fetch rules for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { agentId, status, enabled } = req.query;

    const filters: any = {};
    if (agentId) filters.agentId = agentId as string;
    if (status) filters.status = status as string;
    if (enabled !== undefined) filters.enabled = enabled === 'true';

    const rules = await getUserFetchRules(req.user!.userId, filters);

    res.json({
      success: true,
      data: rules
    });
  } catch (error: any) {
    console.error('❌ [Gmail Fetch Rules API] Error fetching rules:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch rules'
    });
  }
});

/**
 * GET /api/gmail/fetch-rules/:id
 * Get a single fetch rule by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await getFetchRule(id, req.user!.userId);

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Fetch rule not found'
      });
    }

    res.json({
      success: true,
      data: rule
    });
  } catch (error: any) {
    console.error('❌ [Gmail Fetch Rules API] Error fetching rule:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch rule'
    });
  }
});

/**
 * POST /api/gmail/fetch-rules
 * Create a new fetch rule
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      agentId,
      name,
      dateRange,
      maxResults,
      query,
      labelIds,
      includeSpam,
      enabled,
      scheduleInterval,
      scheduleTime,
      systemPrompt,
      tags
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Rule name is required'
      });
    }

    if (!dateRange || !dateRange.type) {
      return res.status(400).json({
        success: false,
        error: 'Date range configuration is required'
      });
    }

    const rule = await createFetchRule({
      userId: req.user!.userId,
      agentId,
      name,
      dateRange,
      maxResults,
      query,
      labelIds,
      includeSpam,
      enabled,
      scheduleInterval,
      scheduleTime,
      systemPrompt,
      tags
    });

    res.status(201).json({
      success: true,
      data: rule
    });
  } catch (error: any) {
    console.error('❌ [Gmail Fetch Rules API] Error creating rule:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create rule'
    });
  }
});

/**
 * PUT /api/gmail/fetch-rules/:id
 * Update an existing fetch rule
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const rule = await updateFetchRule(id, req.user!.userId, updates);

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Fetch rule not found'
      });
    }

    res.json({
      success: true,
      data: rule
    });
  } catch (error: any) {
    console.error('❌ [Gmail Fetch Rules API] Error updating rule:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update rule'
    });
  }
});

/**
 * DELETE /api/gmail/fetch-rules/:id
 * Delete a fetch rule
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteFetchRule(id, req.user!.userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Fetch rule not found'
      });
    }

    res.json({
      success: true,
      data: { message: 'Fetch rule deleted successfully' }
    });
  } catch (error: any) {
    console.error('❌ [Gmail Fetch Rules API] Error deleting rule:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete rule'
    });
  }
});

/**
 * POST /api/gmail/fetch-rules/:id/execute
 * Manually execute a fetch rule
 */
router.post('/:id/execute', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await executeFetchRule(id, req.user!.userId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to execute rule'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('❌ [Gmail Fetch Rules API] Error executing rule:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute rule'
    });
  }
});

/**
 * GET /api/gmail/fetch-rules/:id/emails
 * Fetch emails matching the rule's criteria (without processing)
 */
router.get('/:id/emails', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await GmailFetchRule.findOne({ _id: id, userId: req.user!.userId });

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Fetch rule not found'
      });
    }

    // Build query from rule
    const query = rule.buildQuery();

    // Fetch emails using rule's criteria
    const emails = await fetchEmails(req.user!.userId, {
      maxResults: rule.maxResults,
      query,
      labelIds: rule.labelIds,
      includeSpam: rule.includeSpam
    });

    // Return simplified email data
    const emailList = emails.map((email) => ({
      id: email.id,
      threadId: email.threadId,
      subject: email.subject || '(Sin asunto)',
      from: email.from || 'Desconocido',
      to: email.to || [],
      date: email.date,
      snippet: email.snippet || '',
      labels: email.labels || []
    }));

    res.json({
      success: true,
      data: {
        emails: emailList,
        count: emailList.length,
        ruleName: rule.name
      }
    });
  } catch (error: any) {
    console.error('❌ [Gmail Fetch Rules API] Error fetching emails for rule:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch emails'
    });
  }
});

/**
 * GET /api/gmail/fetch-rules/:id/threads
 * Get email threads (conversations) processed by this rule
 */
router.get('/:id/threads', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await GmailFetchRule.findOne({ _id: id, userId: req.user!.userId });

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Fetch rule not found'
      });
    }

    // Get Gmail account ID
    const Integration = (await import('../models/integration.model')).default;
    const gmailIntegration = await Integration.findOne({
      userId: req.user!.userId,
      type: 'gmail',
      status: 'connected'
    });

    if (!gmailIntegration) {
      return res.json({
        success: true,
        data: {
          threads: [],
          count: 0
        }
      });
    }

    const accountId = gmailIntegration.id;

    // Build query to find conversations created by this rule
    // We'll search by agentId and accountId, and filter by Gmail conversations
    const query: any = {
      accountId,
      'context.topic': { $regex: '^\\[Gmail Thread:' }
    };

    if (rule.agentId) {
      query.agentId = rule.agentId;
    }

    // If we have a lastRunAt, filter conversations created after that
    if (rule.lastRunAt) {
      query['timestamps.createdAt'] = { $gte: rule.lastRunAt };
    }

    const conversations = await Conversation.find(query)
      .sort({ 'timestamps.lastActivity': -1 })
      .limit(50)
      .populate('contactId', 'name email')
      .lean();

    // Extract thread IDs and get messages for each thread
    const threadsData = await Promise.all(
      conversations.map(async (conv: any) => {
        // Extract threadId from context.topic: "[Gmail Thread: threadId] subject"
        const topicMatch = conv.context?.topic?.match(/^\[Gmail Thread: ([^\]]+)\]/);
        const threadId = topicMatch ? topicMatch[1] : null;

        if (!threadId) return null;

        // Get all messages for this conversation
        const messages = await Message.find({
          conversationId: conv._id
        })
          .sort({ 'metadata.timestamp': 1 })
          .select('content role metadata.mid')
          .lean();

        // Get contact info
        const contact = conv.contactId;

        return {
          threadId,
          conversationId: conv._id.toString(),
          subject: conv.context?.topic?.replace(/^\[Gmail Thread: [^\]]+\]\s*/, '') || 'Email conversation',
          contact: contact ? {
            name: contact.name || contact.email,
            email: contact.email
          } : null,
          messages: messages.map((msg: any) => ({
            id: msg._id.toString(),
            role: msg.role,
            content: msg.content?.text || '',
            timestamp: msg.metadata?.timestamp || conv.timestamps?.lastActivity,
            mid: msg.metadata?.mid
          })),
          createdAt: conv.timestamps?.createdAt,
          lastActivity: conv.timestamps?.lastActivity,
          messageCount: messages.length
        };
      })
    );

    const threads = threadsData.filter(Boolean);

    res.json({
      success: true,
      data: {
        threads,
        count: threads.length
      }
    });
  } catch (error: any) {
    console.error('❌ [Gmail Fetch Rules API] Error fetching threads for rule:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch threads'
    });
  }
});

/**
 * GET /api/gmail/fetch-rules/:id/logs
 * Get execution logs for a specific fetch rule
 */
router.get('/:id/logs', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, service, level, limit, startTime, endTime, search } = req.query;

    // Verify rule exists and belongs to user
    const rule = await GmailFetchRule.findOne({ _id: id, userId: req.user!.userId });
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Fetch rule not found'
      });
    }

    // Get logs with filters
    const logEntries = logger.getLogs({
      date: date as string | undefined,
      service: service as string | undefined,
      level: level as 'info' | 'warn' | 'error' | 'debug' | undefined,
      limit: limit ? parseInt(limit as string) : 100,
      startTime: startTime as string | undefined,
      endTime: endTime as string | undefined,
      search: search as string | undefined
    });

    // Filter logs related to this rule execution
    // We can identify rule-related logs by checking metadata for userId and looking for gmail-processor logs
    const ruleLogs = logEntries.filter(entry => {
      // Include gmail-processor logs (they process emails for rules)
      if (entry.service === 'gmail-processor') {
        // Check if metadata has userId matching
        if (entry.metadata?.userId === req.user!.userId) {
          return true;
        }
      }
      // Include email-draft-queue logs (they create drafts from rule processing)
      if (entry.service === 'email-draft-queue') {
        return true;
      }
      // Include gmail-draft logs (they create drafts in Gmail)
      if (entry.service === 'gmail-draft') {
        return true;
      }
      return false;
    });

    // Group logs by execution session (group consecutive logs within 5 minutes)
    const groupedLogs: Array<{
      sessionId: string;
      startTime: string;
      endTime: string;
      logs: typeof logEntries;
      summary: {
        totalLogs: number;
        errors: number;
        warnings: number;
        emailsProcessed?: number;
        draftsCreated?: number;
        decisions?: Array<{ type: string; count: number }>;
      };
    }> = [];

    let currentSession: typeof groupedLogs[0] | null = null;
    const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    for (const log of ruleLogs) {
      const logTime = new Date(log.timestamp).getTime();
      
      if (!currentSession || 
          (logTime - new Date(currentSession.endTime).getTime()) > SESSION_TIMEOUT) {
        // Start new session
        currentSession = {
          sessionId: `session-${logTime}`,
          startTime: log.timestamp,
          endTime: log.timestamp,
          logs: [],
          summary: {
            totalLogs: 0,
            errors: 0,
            warnings: 0
          }
        };
        groupedLogs.push(currentSession);
      }

      currentSession.logs.push(log);
      currentSession.endTime = log.timestamp;
      currentSession.summary.totalLogs++;
      
      if (log.level === 'error') currentSession.summary.errors++;
      if (log.level === 'warn') currentSession.summary.warnings++;

      // Extract summary information from logs
      if (log.message.includes('Processing complete')) {
        currentSession.summary.emailsProcessed = log.metadata?.totalEmails || 0;
      }
      if (log.message.includes('Draft queued successfully')) {
        currentSession.summary.draftsCreated = (currentSession.summary.draftsCreated || 0) + 1;
      }
      if (log.metadata?.decision) {
        if (!currentSession.summary.decisions) {
          currentSession.summary.decisions = [];
        }
        const decisionType = log.metadata.decision;
        const existing = currentSession.summary.decisions.find(d => d.type === decisionType);
        if (existing) {
          existing.count++;
        } else {
          currentSession.summary.decisions.push({ type: decisionType, count: 1 });
        }
      }
    }

    res.json({
      success: true,
      data: {
        ruleId: id,
        ruleName: rule.name,
        totalLogs: ruleLogs.length,
        sessions: groupedLogs,
        logs: ruleLogs // Also return flat list for backward compatibility
      }
    });
  } catch (error: any) {
    console.error('❌ [Gmail Fetch Rules API] Error fetching logs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch logs'
    });
  }
});

export default router;

