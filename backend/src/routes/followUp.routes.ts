import express from 'express';
import { FollowUpConfig, LeadFollowUp, Conversation } from '../models';
import { followUpWorkerService } from '../services/followUpWorker.service';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get follow-up configuration for an account
router.get('/config/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    let config = await FollowUpConfig.findOne({ userId, accountId });

    // Create default config if none exists
    if (!config) {
      config = new FollowUpConfig({
        userId,
        accountId,
        enabled: false,
        minLeadScore: 2,
        maxFollowUps: 3,
        timeSinceLastAnswer: 24,
        messageTemplate: "Hola! 👋 Vi que te interesó nuestro servicio. ¿Te gustaría que te cuente más detalles? Estoy aquí para ayudarte! 😊"
      });
      await config.save();
    }

    res.json(config);
  } catch (error) {
    console.error('Error getting follow-up config:', error);
    res.status(500).json({ error: 'Failed to get follow-up configuration' });
  }
});

// Update follow-up configuration
router.put('/config/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user?.userId;
    const { enabled, minLeadScore, maxFollowUps, timeSinceLastAnswer, messageTemplate } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Validate input
    if (minLeadScore < 1 || minLeadScore > 7) {
      return res.status(400).json({ error: 'Lead score must be between 1 and 7' });
    }

    if (maxFollowUps < 1 || maxFollowUps > 10) {
      return res.status(400).json({ error: 'Max follow-ups must be between 1 and 10' });
    }

    if (timeSinceLastAnswer < 1 || timeSinceLastAnswer > 168) {
      return res.status(400).json({ error: 'Time since last answer must be between 1 and 168 hours' });
    }

    const config = await FollowUpConfig.findOneAndUpdate(
      { userId, accountId },
      {
        enabled: Boolean(enabled),
        minLeadScore: Number(minLeadScore),
        maxFollowUps: Number(maxFollowUps),
        timeSinceLastAnswer: Number(timeSinceLastAnswer),
        messageTemplate: String(messageTemplate)
      },
      { upsert: true, new: true }
    );

    res.json(config);
  } catch (error) {
    console.error('Error updating follow-up config:', error);
    res.status(500).json({ error: 'Failed to update follow-up configuration' });
  }
});

// Get follow-up statistics for an account
router.get('/stats/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const stats = await followUpWorkerService.getFollowUpStats(accountId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting follow-up stats:', error);
    res.status(500).json({ error: 'Failed to get follow-up statistics' });
  }
});

// Get follow-up history for an account
router.get('/history/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user?.userId;
    const { page = 1, limit = 20 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const skip = (Number(page) - 1) * Number(limit);

    const followUps = await LeadFollowUp.find({ accountId, userId })
      .populate('conversationId', 'contactId leadScoring.currentScore')
      .populate('contactId', 'name psid')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await LeadFollowUp.countDocuments({ accountId, userId });

    res.json({
      followUps,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error getting follow-up history:', error);
    res.status(500).json({ error: 'Failed to get follow-up history' });
  }
});

// Test follow-up configuration
router.post('/test/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get configuration
    const config = await FollowUpConfig.findOne({ userId, accountId });
    if (!config) {
      return res.status(404).json({ error: 'Follow-up configuration not found' });
    }

    // Get test leads
    const leads = await followUpWorkerService['getLeadsForFollowUp'](config);

    // Additional debugging - get all conversations for this account
    const allConversations = await Conversation.find({ accountId }).populate('contactId');
    console.log(`🔍 [Follow-up Test] Total conversations for account ${accountId}: ${allConversations.length}`);
    
    allConversations.forEach((conv, index) => {
      console.log(`📊 [Follow-up Test] All Conversation ${index + 1}:`, {
        id: conv._id,
        leadScore: conv.leadScoring?.currentScore,
        lastUserMessage: conv.timestamps?.lastUserMessage,
        aiEnabled: conv.settings?.aiEnabled,
        status: conv.status,
        contactName: conv.contactId?.name || conv.contactId?.metadata?.instagramData?.username || 'Unknown'
      });
    });

    res.json({
      message: 'Test completed successfully',
      leadsFound: leads.length,
      totalConversations: allConversations.length,
      config: {
        enabled: config.enabled,
        minLeadScore: config.minLeadScore,
        maxFollowUps: config.maxFollowUps,
        timeSinceLastAnswer: config.timeSinceLastAnswer
      }
    });
  } catch (error) {
    console.error('Error testing follow-up config:', error);
    res.status(500).json({ error: 'Failed to test follow-up configuration' });
  }
});

export default router;
