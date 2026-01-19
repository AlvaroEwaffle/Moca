import express from 'express';
import InstagramComment from '../models/instagramComment.model';
import InstagramAccount from '../models/instagramAccount.model';
import CommentAutoReplyRule from '../models/commentAutoReplyRule.model';
import { InstagramCommentService } from '../services/instagramComment.service';
import commentWorkerService from '../services/commentWorker.service';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * Process comment webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('📥 [Comment Webhook] Received comment webhook');
    
    // This will be handled by the main webhook service
    // This endpoint is here for future use if needed
    res.status(200).json({ success: true, message: 'Comment webhook received' });
  } catch (error) {
    console.error('❌ [Comment Webhook] Error:', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

/**
 * Get comments for an account
 */
router.get('/comments/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    console.log(`📝 [Get Comments] Fetching comments for account: ${accountId}`);

    // Verify account belongs to user
    const account = await InstagramAccount.findOne({ 
      accountId, 
      userId: req.user!.userId 
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Build query
    const query: any = { accountId };
    if (status) {
      query.status = status;
    }

    // Get comments with pagination
    const comments = await InstagramComment.find(query)
      .sort({ timestamp: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    // Get total count
    const total = await InstagramComment.countDocuments(query);

    res.json({
      success: true,
      data: {
        comments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('❌ [Get Comments] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comments' });
  }
});

/**
 * Reply to a comment manually
 */
router.post('/comments/:commentId/reply', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log(`💬 [Manual Reply] Replying to comment: ${commentId}`);

    // Find comment
    const comment = await InstagramComment.findOne({ commentId });
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    // Verify account belongs to user
    const account = await InstagramAccount.findOne({ 
      accountId: comment.accountId, 
      userId: req.user!.userId 
    });

    if (!account) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Reply to comment
    const commentService = new InstagramCommentService();
    await commentService.replyToComment(commentId, message, account.accessToken);

    // Update comment record
    comment.status = 'replied';
    comment.replyText = message;
    comment.replyTimestamp = new Date();
    await comment.save();

    res.json({
      success: true,
      data: { message: 'Reply sent successfully' }
    });

  } catch (error) {
    console.error('❌ [Manual Reply] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
});

/**
 * Update comment auto-reply enabled status for an account
 */
router.put('/settings/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { enabled } = req.body;

    console.log(`⚙️ [Update Settings] Updating comment auto-reply enabled status for account: ${accountId}`);

    // Verify account belongs to user
    const account = await InstagramAccount.findOne({ 
      accountId, 
      userId: req.user!.userId 
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Update comment settings - only the enabled flag
    if (!account.commentSettings) {
    account.commentSettings = {
        enabled: false,
        autoReplyComment: false,
        autoReplyDM: false,
        commentMessage: '',
        dmMessage: '',
        replyDelay: 0
      };
    }
    account.commentSettings.enabled = enabled === true;

    await account.save();

    res.json({
      success: true,
      data: { 
        message: 'Comment auto-reply settings updated successfully',
        enabled: account.commentSettings.enabled
      }
    });

  } catch (error) {
    console.error('❌ [Update Settings] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

/**
 * Get comment settings for an account
 */
router.get('/settings/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    console.log(`⚙️ [Get Settings] Fetching comment settings for account: ${accountId}`);

    // Verify account belongs to user
    const account = await InstagramAccount.findOne({ 
      accountId, 
      userId: req.user!.userId 
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    res.json({
      success: true,
      data: { 
        enabled: account.commentSettings?.enabled || false
      }
    });

  } catch (error) {
    console.error('❌ [Get Settings] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

/**
 * Get all auto-reply rules for an account
 */
router.get('/rules/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    console.log(`📋 [Get Rules] Fetching auto-reply rules for account: ${accountId}`);

    // Verify account belongs to user
    const account = await InstagramAccount.findOne({ 
      accountId, 
      userId: req.user!.userId 
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Get all rules for this account
    const rules = await CommentAutoReplyRule.find({ 
      accountId,
      userId: req.user!.userId 
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { rules }
    });

  } catch (error) {
    console.error('❌ [Get Rules] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch rules' });
  }
});

/**
 * Create a new auto-reply rule
 */
router.post('/rules/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { keyword, responseMessage, enabled = true, sendDM = false, dmMessage } = req.body;

    if (!keyword || !responseMessage) {
      return res.status(400).json({
        success: false,
        error: 'Keyword and response message are required'
      });
    }

    // Validate DM configuration
    if (sendDM === true && !dmMessage) {
      return res.status(400).json({
        success: false,
        error: 'DM message is required when sendDM is enabled'
      });
    }

    console.log(`➕ [Create Rule] Creating auto-reply rule for account: ${accountId}`);

    // Verify account belongs to user
    const account = await InstagramAccount.findOne({ 
      accountId, 
      userId: req.user!.userId 
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Create new rule
    const rule = new CommentAutoReplyRule({
      accountId,
      userId: req.user!.userId,
      keyword: keyword.trim().toLowerCase(),
      responseMessage: responseMessage.trim(),
      enabled: enabled === true,
      sendDM: sendDM === true,
      dmMessage: sendDM === true ? dmMessage?.trim() : undefined
    });

    await rule.save();

    res.json({
      success: true,
      data: { rule, message: 'Rule created successfully' }
    });

  } catch (error: any) {
    console.error('❌ [Create Rule] Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'A rule with this keyword already exists for this account'
      });
    }
    res.status(500).json({ success: false, error: 'Failed to create rule' });
  }
});

/**
 * Update an auto-reply rule
 */
router.put('/rules/:ruleId', authenticateToken, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { keyword, responseMessage, enabled, sendDM, dmMessage } = req.body;

    console.log(`✏️ [Update Rule] Updating rule: ${ruleId}`);

    // Find rule and verify ownership
    const rule = await CommentAutoReplyRule.findById(ruleId);
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }

    // Verify account belongs to user
    const account = await InstagramAccount.findOne({ 
      accountId: rule.accountId, 
      userId: req.user!.userId 
    });

    if (!account || rule.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Validate DM configuration
    const newSendDM = sendDM !== undefined ? sendDM === true : rule.sendDM;
    if (newSendDM === true && !dmMessage && !rule.dmMessage) {
      return res.status(400).json({
        success: false,
        error: 'DM message is required when sendDM is enabled'
      });
    }

    // Update rule fields
    if (keyword !== undefined) {
      rule.keyword = keyword.trim().toLowerCase();
    }
    if (responseMessage !== undefined) {
      rule.responseMessage = responseMessage.trim();
    }
    if (enabled !== undefined) {
      rule.enabled = enabled === true;
    }
    if (sendDM !== undefined) {
      rule.sendDM = sendDM === true;
    }
    if (dmMessage !== undefined) {
      rule.dmMessage = sendDM === true ? dmMessage.trim() : undefined;
    }

    await rule.save();

    res.json({
      success: true,
      data: { rule, message: 'Rule updated successfully' }
    });

  } catch (error: any) {
    console.error('❌ [Update Rule] Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'A rule with this keyword already exists for this account'
      });
    }
    res.status(500).json({ success: false, error: 'Failed to update rule' });
  }
});

/**
 * Delete an auto-reply rule
 */
router.delete('/rules/:ruleId', authenticateToken, async (req, res) => {
  try {
    const { ruleId } = req.params;

    console.log(`🗑️ [Delete Rule] Deleting rule: ${ruleId}`);

    // Find rule and verify ownership
    const rule = await CommentAutoReplyRule.findById(ruleId);
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }

    // Verify account belongs to user
    const account = await InstagramAccount.findOne({ 
      accountId: rule.accountId, 
      userId: req.user!.userId 
    });

    if (!account || rule.userId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await CommentAutoReplyRule.findByIdAndDelete(ruleId);

    res.json({
      success: true,
      data: { message: 'Rule deleted successfully' }
    });

  } catch (error) {
    console.error('❌ [Delete Rule] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete rule' });
  }
});

/**
 * Get comment statistics
 */
router.get('/stats/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    console.log(`📊 [Get Stats] Fetching comment stats for account: ${accountId}`);

    // Verify account belongs to user
    const account = await InstagramAccount.findOne({ 
      accountId, 
      userId: req.user!.userId 
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Get stats
    const stats = await commentWorkerService.getStats();

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    console.error('❌ [Get Stats] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

/**
 * Get worker status
 */
router.get('/worker/status', authenticateToken, async (req, res) => {
  try {
    const status = commentWorkerService.getStatus();
    const pendingCount = await commentWorkerService.getPendingCount();

    res.json({
      success: true,
      data: { 
        ...status, 
        pendingCount 
      }
    });

  } catch (error) {
    console.error('❌ [Worker Status] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to get worker status' });
  }
});

/**
 * Start/stop comment worker
 */
router.post('/worker/:action', authenticateToken, async (req, res) => {
  try {
    const { action } = req.params;

    if (action === 'start') {
      commentWorkerService.start();
      res.json({
        success: true,
        data: { message: 'Comment worker started' }
      });
    } else if (action === 'stop') {
      commentWorkerService.stop();
      res.json({
        success: true,
        data: { message: 'Comment worker stopped' }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid action. Use "start" or "stop"'
      });
    }

  } catch (error) {
    console.error('❌ [Worker Control] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to control worker' });
  }
});

export default router;
