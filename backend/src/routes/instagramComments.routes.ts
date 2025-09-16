import express from 'express';
import InstagramComment from '../models/instagramComment.model';
import InstagramAccount from '../models/instagramAccount.model';
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
 * Update comment settings for an account
 */
router.put('/settings/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { commentSettings } = req.body;

    console.log(`⚙️ [Update Settings] Updating comment settings for account: ${accountId}`);

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

    // Update comment settings
    account.commentSettings = {
      ...account.commentSettings,
      ...commentSettings
    };

    await account.save();

    res.json({
      success: true,
      data: { 
        message: 'Comment settings updated successfully',
        commentSettings: account.commentSettings
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
      data: { commentSettings: account.commentSettings }
    });

  } catch (error) {
    console.error('❌ [Get Settings] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
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
