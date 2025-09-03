import express from 'express';
import InstagramWebhookService from '../services/instagramWebhook.service';
import instagramApiService from '../services/instagramApi.service';
import Contact from '../models/contact.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import OutboundQueue from '../models/outboundQueue.model';
import InstagramAccount from '../models/instagramAccount.model';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
const webhookService = new InstagramWebhookService();

// Webhook verification and message reception
router.get('/webhook', (req, res) => {
  try {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    console.log('🔗 Instagram webhook verification request:', { mode, token, challenge });

    if (mode && token && challenge) {
      const response = webhookService.handleVerification(mode, token, challenge);
      if (response) {
        console.log('✅ Webhook verified successfully');
        res.status(200).send(response);
      } else {
        console.log('❌ Webhook verification failed');
        res.status(403).send('Forbidden');
      }
    } else {
      console.log('⚠️ Missing webhook verification parameters');
      res.status(400).send('Bad Request');
    }
  } catch (error) {
    console.error('❌ Error in webhook verification:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Webhook message reception
router.post('/webhook', async (req, res) => {
  try {
    // Always respond with 200 OK immediately to prevent Meta retries
    res.status(200).send('OK');

    // Process webhook payload asynchronously
    const payload = req.body;
    console.log('📥 Received Instagram webhook payload:', {
      object: payload.object,
      entryCount: payload.entry?.length || 0
    });

    // Validate webhook signature if app secret is configured
    const signature = req.headers['x-hub-signature-256'] as string;
    if (signature) {
      const isValid = await webhookService.validateSignature(JSON.stringify(payload), signature);
      if (!isValid) {
        console.error('❌ Invalid webhook signature');
        return;
      }
    }

    // Process the webhook
    await webhookService.handleWebhook(payload);

  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    // Don't send error response since we already sent 200 OK
  }
});

// Get all contacts
router.get('/contacts', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, tag, search } = req.query;
    
    const query: any = {};
    if (status) query.status = status;
    if (tag) query.tags = tag;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'businessInfo.sector': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const contacts = await Contact.find(query)
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .select('-__v');

    const total = await Contact.countDocuments(query);

    res.json({
      success: true,
      data: {
        contacts,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting contacts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contacts'
    });
  }
});

// Get contact by ID
router.get('/contacts/:id', async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    res.json({
      success: true,
      data: { contact }
    });

  } catch (error) {
    console.error('❌ Error getting contact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contact'
    });
  }
});

// Get all conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority, assignedAgent } = req.query;
    
    const query: any = {};
    if (status) query.status = status;
    if (priority) query['settings.priority'] = priority;
    if (assignedAgent) query['settings.assignedAgent'] = assignedAgent;

    // Filter by user's Instagram accounts
    const userAccounts = await InstagramAccount.find({ userId: req.user!.userId }).select('accountId');
    const userAccountIds = userAccounts.map(acc => acc.accountId);
    query.accountId = { $in: userAccountIds };

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const conversations = await Conversation.find(query)
      .sort({ 'timestamps.lastActivity': -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .populate('contactId', 'name psid email')
      .select('-__v');

    const total = await Conversation.countDocuments(query);

    res.json({
      success: true,
      data: {
        conversations,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversations'
    });
  }
});

// Get conversation by ID with messages
router.get('/conversations/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('contactId', 'name psid email profilePicture')
      .select('-__v');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Get messages for this conversation
    const messages = await Message.find({ conversationId: req.params.id })
      .sort({ 'metadata.timestamp': 1 })
      .select('-__v');

    res.json({
      success: true,
      data: {
        conversation,
        messages
      }
    });

  } catch (error) {
    console.error('❌ Error getting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation'
    });
  }
});

// Send manual message
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { content, priority = 'normal' } = req.body;
    const conversationId = req.params.id;

    if (!content || !content.text) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Create bot message
    const message = new Message({
      mid: `manual_${Date.now()}_${conversationId}`,
      conversationId,
      contactId: conversation.contactId,
      accountId: conversation.accountId,
      role: 'assistant',
      content: {
        text: content.text,
        attachments: content.attachments || [],
        quickReplies: content.quickReplies || [],
        buttons: content.buttons || []
      },
      metadata: {
        timestamp: new Date(),
        isConsolidated: false,
        originalMids: [],
        aiGenerated: false,
        processingTime: 0
      },
      status: 'queued',
      priority,
      tags: ['manual_response'],
      notes: ['Manually sent by agent']
    });

    await message.save();

    // Add to outbound queue
    const queueItem = new OutboundQueue({
      messageId: message.id,
      conversationId,
      contactId: conversation.contactId,
      accountId: conversation.accountId,
      priority,
      status: 'pending',
      content: message.content,
      tags: ['manual_response'],
      notes: ['Manually sent by agent']
    });

    await queueItem.save();

    // Update conversation
    conversation.timestamps.lastBotMessage = new Date();
    conversation.timestamps.lastActivity = new Date();
    conversation.metrics.totalMessages += 1;
    conversation.metrics.botMessages += 1;
    conversation.messageCount += 1;
    await conversation.save();

    res.json({
      success: true,
      data: {
        message,
        queueItem
      }
    });

  } catch (error) {
    console.error('❌ Error sending manual message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// Get outbound queue status
router.get('/queue/status', async (req, res) => {
  try {
    const stats = await OutboundQueue.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      total: 0,
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      cancelled: 0
    };

    stats.forEach(stat => {
      result[stat._id as keyof typeof result] = stat.count;
      result.total += stat.count;
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Error getting queue status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get queue status'
    });
  }
});

// Retry failed messages
router.post('/queue/retry', async (req, res) => {
  try {
    const failedItems = await OutboundQueue.findNeedingRetry();
    
    let retryCount = 0;
    for (const item of failedItems) {
      try {
        item.status = 'pending';
        await item.save();
        retryCount++;
      } catch (error) {
        console.error(`❌ Error resetting failed item ${item.id}:`, error);
      }
    }

    res.json({
      success: true,
      data: {
        message: `Reset ${retryCount} failed items for retry`,
        retryCount
      }
    });

  } catch (error) {
    console.error('❌ Error retrying failed messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retry messages'
    });
  }
});

// ===== INSTAGRAM ACCOUNT MANAGEMENT =====

// Create Instagram account
router.post('/accounts', authenticateToken, async (req, res) => {
  try {
    const { accountId, accountName, accessToken, refreshToken, rateLimits, settings } = req.body;

    // Validate required fields
    if (!accountId || !accessToken) {
      return res.status(400).json({
        success: false,
        error: 'accountId and accessToken are required'
      });
    }

    // Check if account already exists for this user
    const existingAccount = await InstagramAccount.findOne({ 
      accountId,
      userId: req.user!.userId 
    });
    if (existingAccount) {
      return res.status(409).json({
        success: false,
        error: 'Instagram account already exists for this user'
      });
    }

    // Create new Instagram account
    const newAccount = new InstagramAccount({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      accountId,
      accountName: accountName || `Account ${accountId}`,
      accessToken,
      refreshToken,
      tokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      rateLimits: {
        messagesPerSecond: rateLimits?.messagesPerSecond || 3,
        userCooldown: rateLimits?.userCooldown || 7,
        debounceWindow: rateLimits?.debounceWindow || 4000
      },
      settings: {
        autoRespond: settings?.autoRespond !== false, // Default to true
        aiEnabled: settings?.aiEnabled !== false, // Default to true
        fallbackRules: settings?.fallbackRules || [
          'Thank you for your message! We\'ll get back to you soon.',
          'Thanks for reaching out! Our team will respond shortly.'
        ]
      },
      webhook: {
        verifyToken: process.env.INSTAGRAM_VERIFY_TOKEN || 'default_token',
        endpoint: `${req.protocol}://${req.get('host')}/api/instagram/webhook`
      }
    });

    await newAccount.save();

    console.log(`✅ Created Instagram account: ${accountId}`);

    res.status(201).json({
      success: true,
      data: {
        message: 'Instagram account created successfully',
        account: {
          id: newAccount.id,
          accountId: newAccount.accountId,
          settings: newAccount.settings,
          rateLimits: newAccount.rateLimits
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating Instagram account:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      error: 'Failed to create Instagram account',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all Instagram accounts
router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const accounts = await InstagramAccount.find({ userId: req.user!.userId })
      .select('-accessToken -refreshToken -__v')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        accounts,
        count: accounts.length
      }
    });

  } catch (error) {
    console.error('❌ Error getting Instagram accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Instagram accounts'
    });
  }
});

// Get specific Instagram account
router.get('/accounts/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await InstagramAccount.findOne({ 
      accountId,
      userId: req.user!.userId 
    })
      .select('-accessToken -refreshToken -__v');

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Instagram account not found'
      });
    }

    res.json({
      success: true,
      data: account
    });

  } catch (error) {
    console.error('❌ Error getting Instagram account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Instagram account'
    });
  }
});

// Update Instagram account
router.put('/accounts/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { accessToken, refreshToken, rateLimits, settings } = req.body;

    const account = await InstagramAccount.findOne({ accountId });
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Instagram account not found'
      });
    }

    // Update fields if provided
    if (accessToken) account.accessToken = accessToken;
    if (refreshToken) account.refreshToken = refreshToken;
    if (rateLimits) account.rateLimits = { ...account.rateLimits, ...rateLimits };
    if (settings) account.settings = { ...account.settings, ...settings };

    await account.save();

    console.log(`✅ Updated Instagram account: ${accountId}`);

    res.json({
      success: true,
      data: {
        message: 'Instagram account updated successfully',
        account: {
          id: account.id,
          accountId: account.accountId,
          settings: account.settings,
          rateLimits: account.rateLimits
        }
      }
    });

  } catch (error) {
    console.error('❌ Error updating Instagram account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update Instagram account'
    });
  }
});

// Delete Instagram account
router.delete('/accounts/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await InstagramAccount.findOne({ accountId });
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Instagram account not found'
      });
    }

    await InstagramAccount.deleteOne({ accountId });

    console.log(`✅ Deleted Instagram account: ${accountId}`);

    res.json({
      success: true,
      data: {
        message: 'Instagram account deleted successfully'
      }
    });

  } catch (error) {
    console.error('❌ Error deleting Instagram account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete Instagram account'
    });
  }
});

// Test Instagram API connection
router.get('/test-connection', async (req, res) => {
  try {
    const account = await Conversation.findOne().select('accountId');
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'No Instagram account found'
      });
    }

    const isValid = await instagramApiService.testConnection();

    res.json({
      success: true,
      data: {
        connected: isValid,
        message: isValid ? 'Instagram API connection successful' : 'Instagram API connection failed'
      }
    });

  } catch (error) {
    console.error('❌ Error testing Instagram connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test connection'
    });
  }
});

export default router;
