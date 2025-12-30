// @ts-nocheck
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  queueEmailDraft,
  getUserDraftQueueItems,
  getDraftQueueItem,
  processDraftQueueItem,
  resetDraftQueueItem,
  deleteDraftQueueItems
} from '../services/emailDraftQueue.service';
import { sendGmailDraft } from '../services/gmailDraft.service';
import Message from '../models/message.model';
import Conversation from '../models/conversation.model';

const router = express.Router();

/**
 * POST /api/gmail/drafts/queue
 * Queue an email for draft generation
 */
router.post('/queue', authenticateToken, async (req, res) => {
  try {
    const {
      emailId,
      threadId,
      subject,
      fromEmail,
      fromName,
      originalBody,
      agentId,
      conversationId,
      messageId,
      contactId,
      priority
    } = req.body;

    if (!emailId || !threadId || !subject || !fromEmail || !originalBody) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: emailId, threadId, subject, fromEmail, originalBody'
      });
    }

    const queueItem = await queueEmailDraft({
      userId: req.user!.userId,
      emailId,
      threadId,
      subject,
      fromEmail,
      fromName,
      originalBody,
      agentId,
      conversationId,
      messageId,
      contactId,
      priority
    });

    res.status(201).json({
      success: true,
      data: queueItem
    });
  } catch (error: any) {
    console.error('❌ [Email Draft API] Error queueing draft:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to queue draft'
    });
  }
});

/**
 * POST /api/gmail/drafts/queue-from-message/:messageId
 * Queue a draft from an existing message (helper endpoint)
 */
router.post('/queue-from-message/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { priority } = req.body;

    // Find the message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Verify user owns the message
    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Extract email metadata from message
    // For Gmail messages, we store emailId in mid (format: "gmail_{emailId}")
    const midParts = message.mid?.split('_') || [];
    if (midParts[0] !== 'gmail' || !midParts[1]) {
      return res.status(400).json({
        success: false,
        error: 'Message is not a Gmail message'
      });
    }

    const emailId = midParts[1];
    const threadId = conversation.context?.topic?.match(/\[Gmail Thread: ([^\]]+)\]/)?.[1] || '';

    if (!emailId || !threadId) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract email metadata from message'
      });
    }

    // Get contact email
    const contact = await Conversation.findById(message.conversationId).populate('contactId');
    const fromEmail = (contact as any)?.contactId?.email || '';

    if (!fromEmail) {
      return res.status(400).json({
        success: false,
        error: 'Could not find contact email'
      });
    }

    // Queue the draft
    const queueItem = await queueEmailDraft({
      userId: req.user!.userId,
      emailId,
      threadId,
      subject: conversation.context?.topic?.replace(/\[Gmail Thread: [^\]]+\]\s*/, '') || 'Email',
      fromEmail,
      originalBody: message.content?.text || '',
      agentId: message.agentId?.toString(),
      conversationId: message.conversationId?.toString(),
      messageId: message.id,
      contactId: message.contactId?.toString(),
      priority
    });

    res.status(201).json({
      success: true,
      data: queueItem
    });
  } catch (error: any) {
    console.error('❌ [Email Draft API] Error queueing draft from message:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to queue draft'
    });
  }
});

/**
 * GET /api/gmail/drafts
 * Get all draft queue items for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, conversationId, approvalState } = req.query;

    const filters: any = {};
    if (status) filters.status = status;
    if (conversationId) filters.conversationId = conversationId;
    if (approvalState) filters.approvalState = approvalState;

    const items = await getUserDraftQueueItems(req.user!.userId, filters);

    res.json({
      success: true,
      data: items
    });
  } catch (error: any) {
    console.error('❌ [Email Draft API] Error fetching drafts:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch drafts'
    });
  }
});

/**
 * POST /api/gmail/drafts/:id/process
 * Manually trigger processing of a draft queue item
 */
router.post('/:id/process', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify user owns the queue item
    const item = await getDraftQueueItem(id, req.user!.userId);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Draft queue item not found'
      });
    }

    const result = await processDraftQueueItem(id);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to process draft'
      });
    }

    res.json({
      success: true,
      data: {
        draftId: result.draftId,
        message: 'Draft generated successfully'
      }
    });
  } catch (error: any) {
    console.error('❌ [Email Draft API] Error processing draft:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process draft'
    });
  }
});

/**
 * POST /api/gmail/drafts/:id/send
 * Send a draft email in Gmail
 */
router.post('/:id/send', authenticateToken, async (req, res) => {
  try {
    console.log(`📧 [Email Draft API] Send request received for draft ID: ${req.params.id}`);
    const { id } = req.params;
    
    // Verify user owns the draft queue item
    const item = await getDraftQueueItem(id, req.user!.userId);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Draft queue item not found'
      });
    }

    if (!item.draftId) {
      return res.status(400).json({
        success: false,
        error: 'Draft has not been created in Gmail yet. Please generate the draft first.'
      });
    }

    // Send the draft
    let result;
    try {
      result = await sendGmailDraft(req.user!.userId, item.draftId);
    } catch (error: any) {
      // If draft not found, clear the draftId so it can be regenerated
      if (error.message?.includes('not found') || error.message?.includes('no se encuentra')) {
        console.log(`⚠️ [Email Draft API] Draft ${item.draftId} not found, clearing draftId from queue item`);
        item.draftId = undefined;
        item.status = 'pending';
        await item.save();
        
        return res.status(404).json({
          success: false,
          error: 'El borrador no se encuentra en Gmail. Por favor, genera un nuevo borrador.',
          canRegenerate: true
        });
      }
      throw error;
    }

    // Update the draft queue item status
    item.status = 'sent';
    item.approvalState = 'sent';
    item.metadata = item.metadata || {};
    item.metadata.sentAt = new Date();
    item.metadata.messageId = result.id;
    await item.save();

    res.json({
      success: true,
      data: {
        messageId: result.id,
        threadId: result.threadId,
        message: 'Email sent successfully'
      }
    });
  } catch (error: any) {
    console.error('❌ [Email Draft API] Error sending draft:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send draft'
    });
  }
});

/**
 * POST /api/gmail/drafts/:id/reset
 * Reset a stuck draft (force reset from generating/failed to pending)
 */
router.post('/:id/reset', authenticateToken, async (req, res) => {
  try {
    console.log(`🔄 [Email Draft API] Reset request received for draft ID: ${req.params.id}`);
    const { id } = req.params;
    
    const item = await resetDraftQueueItem(id, req.user!.userId);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Draft queue item not found'
      });
    }

    res.json({
      success: true,
      data: item,
      message: 'Draft reset successfully. It will be retried on the next worker cycle.'
    });
  } catch (error: any) {
    console.error('❌ [Email Draft API] Error resetting draft:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset draft'
    });
  }
});

/**
 * PUT /api/gmail/drafts/:id
 * Update a draft queue item (content, approval state, etc.)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { draftContent, approvalState } = req.body;

    // Verify user owns the draft queue item
    const item = await getDraftQueueItem(id, req.user!.userId);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Draft queue item not found'
      });
    }

    // Update fields if provided
    if (draftContent !== undefined) {
      item.draftContent = draftContent;
    }
    if (approvalState !== undefined) {
      if (!['new', 'approved', 'sent'].includes(approvalState)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid approvalState. Must be one of: new, approved, sent'
        });
      }
      item.approvalState = approvalState;
    }

    await item.save();

    res.json({
      success: true,
      data: item,
      message: 'Draft updated successfully'
    });
  } catch (error: any) {
    console.error('❌ [Email Draft API] Error updating draft:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update draft'
    });
  }
});

/**
 * GET /api/gmail/drafts/:id
 * Get a single draft queue item by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const item = await getDraftQueueItem(id, req.user!.userId);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Draft queue item not found'
      });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error: any) {
    console.error('❌ [Email Draft API] Error fetching draft:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch draft'
    });
  }
});

/**
 * DELETE /api/gmail/drafts/bulk
 * Delete multiple draft queue items
 */
router.delete('/bulk', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ids array is required and must not be empty'
      });
    }

    const result = await deleteDraftQueueItems(ids, req.user!.userId);

    res.json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
        errors: result.errors
      },
      message: `Deleted ${result.deletedCount} draft(s) successfully`
    });
  } catch (error: any) {
    console.error('❌ [Email Draft API] Error deleting drafts:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete drafts'
    });
  }
});

/**
 * DELETE /api/gmail/drafts/:id
 * Delete a single draft queue item
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await deleteDraftQueueItems([id], req.user!.userId);

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Draft queue item not found'
      });
    }

    res.json({
      success: true,
      message: 'Draft deleted successfully'
    });
  } catch (error: any) {
    console.error('❌ [Email Draft API] Error deleting draft:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete draft'
    });
  }
});

export default router;


