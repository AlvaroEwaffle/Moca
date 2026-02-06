import express from 'express';
import InstagramWebhookService from '../services/instagramWebhook.service';
import instagramApiService from '../services/instagramApi.service';
import Contact from '../models/contact.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import OutboundQueue from '../models/outboundQueue.model';
import InstagramAccount from '../models/instagramAccount.model';
import KeywordActivationRule from '../models/keywordActivationRule.model';
import { authenticateToken } from '../middleware/auth';
import { generateInstagramResponse } from '../services/openai.service';

const router = express.Router();
const webhookService = new InstagramWebhookService();

console.log('🔧 [Instagram Routes] Router initialized with custom instructions endpoint');

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
    const userAccounts = await InstagramAccount.find({ userId: req.user!.userId }).select('accountId accountName userEmail');
    console.log(`🔍 [API] Found ${userAccounts.length} Instagram accounts for user: ${req.user!.email}`);
    
    const userAccountIds = userAccounts.map(acc => acc.accountId);
    query.accountId = { $in: userAccountIds };

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const conversations = await Conversation.find(query)
      .sort({ 'timestamps.lastActivity': -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .populate('contactId', 'name psid email metadata')
      .select('+leadScoring +aiResponseMetadata +analytics');

    console.log(`🔍 [API] Found ${conversations.length} conversations`);

    // Check if contacts exist
    if (conversations.length > 0) {
      const contactIds = conversations.map(conv => conv.contactId).filter(Boolean);
      const existingContacts = await Contact.find({ _id: { $in: contactIds } }).select('_id psid metadata');
      console.log(`🔍 [API] Found ${existingContacts.length} existing contacts`);
    }

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
      .populate('contactId', 'name psid email profilePicture metadata')
      .select('+leadScoring +aiResponseMetadata +analytics');

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

// Get count of eligible conversations for bulk message
router.get('/conversations/bulk-message/eligible-count', authenticateToken, async (req, res) => {
  try {
    const { status, accountIds, minLeadScore } = req.query;
    const userId = req.user!.userId;

    // Get user's Instagram accounts
    const userAccounts = await InstagramAccount.find({ userId, isActive: true }).select('accountId accountName');
    const userAccountIds = userAccounts.map(acc => acc.accountId);

    if (userAccountIds.length === 0) {
      return res.json({
        success: true,
        data: {
          count: 0,
          accounts: []
        }
      });
    }

    // Build query - only conversations with agent explicitly turned ON
    const query: any = {
      accountId: { $in: userAccountIds },
      'settings.aiEnabled': true
    };

    if (status) {
      query.status = status;
    } else {
      query.status = 'open';
    }

    if (accountIds && typeof accountIds === 'string') {
      const accountIdArray = accountIds.split(',');
      query.accountId = { $in: accountIdArray };
    }

    if (minLeadScore) {
      query['leadScoring.currentScore'] = { $gte: parseInt(minLeadScore as string) };
    }

    // Count eligible conversations
    const count = await Conversation.countDocuments(query);

    // Also count conversations with valid contacts
    const conversationsWithContacts = await Conversation.find(query)
      .populate('contactId', 'psid')
      .lean();

    const validCount = conversationsWithContacts.filter(conv => {
      const contact = conv.contactId as any;
      return contact && contact.psid;
    }).length;

    res.json({
      success: true,
      data: {
        count: validCount,
        totalEligible: count,
        accounts: userAccounts.map(acc => ({
          accountId: acc.accountId,
          accountName: acc.accountName
        }))
      }
    });

  } catch (error: any) {
    console.error('❌ Error getting eligible count:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get eligible count'
    });
  }
});

// Get list of eligible conversations for bulk message
router.get('/conversations/bulk-message/eligible-list', authenticateToken, async (req, res) => {
  try {
    const { status, accountIds, minLeadScore } = req.query;
    const userId = req.user!.userId;

    // Get user's Instagram accounts
    const userAccounts = await InstagramAccount.find({ userId, isActive: true }).select('accountId accountName');
    const userAccountIds = userAccounts.map(acc => acc.accountId);

    if (userAccountIds.length === 0) {
      return res.json({
        success: true,
        data: {
          conversations: [],
          count: 0
        }
      });
    }

    // Build query - only conversations with agent explicitly turned ON
    const query: any = {
      accountId: { $in: userAccountIds },
      'settings.aiEnabled': true
    };

    if (status) {
      query.status = status;
    } else {
      query.status = 'open';
    }

    if (accountIds && typeof accountIds === 'string') {
      const accountIdArray = accountIds.split(',');
      query.accountId = { $in: accountIdArray };
    }

    if (minLeadScore) {
      query['leadScoring.currentScore'] = { $gte: parseInt(minLeadScore as string) };
    }

    // Get eligible conversations with contact info
    const conversations = await Conversation.find(query)
      .populate('contactId', 'psid name metadata')
      .select('_id status contactId leadScoring createdAt timestamps')
      .sort({ 'timestamps.lastActivity': -1 })
      .lean();

    // Filter conversations with valid contacts and format response
    const validConversations = conversations
      .filter(conv => {
        const contact = conv.contactId as any;
        return contact && contact.psid;
      })
      .map(conv => {
        const contact = conv.contactId as any;
        // Get username from metadata.instagramData.username (Instagram) or use psid as fallback
        const username = contact.metadata?.instagramData?.username || contact.psid || 'unknown';
        const name = contact.name || username || 'Unknown';
        
        return {
          id: conv._id.toString(),
          contact: {
            name: name,
            username: username,
            psid: contact.psid
          },
          status: conv.status,
          leadScore: conv.leadScoring?.currentScore || 1,
          lastActivity: conv.timestamps?.lastActivity || new Date()
        };
      });

    res.json({
      success: true,
      data: {
        conversations: validConversations,
        count: validConversations.length
      }
    });

  } catch (error: any) {
    console.error('❌ Error getting eligible conversations list:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get eligible conversations list'
    });
  }
});

// Send bulk message to all conversations with active agent
router.post('/conversations/bulk-message', authenticateToken, async (req, res) => {
  try {
    const { messageText, filters = {}, options = {} } = req.body;
    const userId = req.user!.userId;

    // Validation
    if (!messageText || typeof messageText !== 'string' || messageText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message text is required and cannot be empty'
      });
    }

    if (messageText.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Message text cannot exceed 1000 characters'
      });
    }

    console.log(`📢 [Bulk Message] User ${userId} initiating bulk message to conversations with active agent`);

    // Get user's Instagram accounts
    const userAccounts = await InstagramAccount.find({ userId, isActive: true }).select('accountId accountName');
    const userAccountIds = userAccounts.map(acc => acc.accountId);

    if (userAccountIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active Instagram accounts found for this user'
      });
    }

    // Build query for eligible conversations - only those with agent explicitly turned ON
    const query: any = {
      accountId: { $in: userAccountIds },
      'settings.aiEnabled': true
    };

    // Apply status filter
    if (filters.status) {
      query.status = filters.status;
    } else {
      // Default: only open conversations
      query.status = 'open';
    }

    // Apply account filter if specified
    if (filters.accountIds && Array.isArray(filters.accountIds) && filters.accountIds.length > 0) {
      query.accountId = { $in: filters.accountIds };
    }

    // Apply lead score filter if specified
    if (filters.minLeadScore && typeof filters.minLeadScore === 'number') {
      query['leadScoring.currentScore'] = { $gte: filters.minLeadScore };
    }

    // If specific conversation IDs are provided, use only those
    if (filters.conversationIds && Array.isArray(filters.conversationIds) && filters.conversationIds.length > 0) {
      query._id = { $in: filters.conversationIds };
    } else if (filters.excludeConversationIds && Array.isArray(filters.excludeConversationIds) && filters.excludeConversationIds.length > 0) {
      // Exclude specific conversation IDs if provided
      query._id = { $nin: filters.excludeConversationIds };
    }

    // Find eligible conversations
    const eligibleConversations = await Conversation.find(query)
      .populate('contactId', 'psid name username')
      .lean();

    console.log(`📊 [Bulk Message] Found ${eligibleConversations.length} eligible conversations`);

    if (eligibleConversations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No eligible conversations found with active agent'
      });
    }

    // Filter out conversations without valid contacts
    const validConversations = eligibleConversations.filter(conv => {
      const contact = conv.contactId as any;
      return contact && contact.psid;
    });

    console.log(`✅ [Bulk Message] ${validConversations.length} conversations with valid contacts`);

    if (validConversations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No conversations found with valid contacts'
      });
    }

    // Priority from options or default to 'normal'
    const priority = options.priority || 'normal';

    // Process conversations in batches to avoid overwhelming the database
    const batchSize = 50;
    const queueIds: string[] = [];
    const errors: Array<{ conversationId: string; error: string }> = [];
    let successCount = 0;

    for (let i = 0; i < validConversations.length; i += batchSize) {
      const batch = validConversations.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (conversation) => {
          try {
            const contact = conversation.contactId as any;
            const conversationId = conversation._id.toString();

            // Create bot message
            const message = new Message({
              mid: `bulk_${Date.now()}_${conversationId}_${Math.random().toString(36).substring(7)}`,
              conversationId,
              contactId: contact._id || contact.id,
              accountId: conversation.accountId,
              role: 'assistant',
              content: {
                text: messageText.trim(),
                attachments: [],
                quickReplies: [],
                buttons: []
              },
              metadata: {
                timestamp: new Date(),
                isConsolidated: false,
                originalMids: [],
                aiGenerated: false,
                processingTime: 0,
                bulkMessage: true,
                bulkMessageTimestamp: new Date()
              },
              status: 'queued',
              priority,
              tags: ['bulk_message', 'manual_response'],
              notes: ['Sent via bulk message']
            });

            await message.save();

            // Add to outbound queue
            const queueItem = new OutboundQueue({
              messageId: message.id,
              conversationId,
              contactId: contact._id || contact.id,
              accountId: conversation.accountId,
              priority,
              status: 'pending',
              content: {
                text: messageText.trim()
              },
              tags: ['bulk_message', 'manual_response'],
              notes: ['Sent via bulk message']
            });

            await queueItem.save();
            queueIds.push(queueItem.id);

            // Update conversation metadata (don't await to speed up)
            Conversation.findByIdAndUpdate(conversationId, {
              $inc: {
                messageCount: 1,
                'metrics.totalMessages': 1,
                'metrics.botMessages': 1
              },
              'timestamps.lastBotMessage': new Date(),
              'timestamps.lastActivity': new Date()
            }).catch(err => console.error(`Error updating conversation ${conversationId}:`, err));

            successCount++;

          } catch (error: any) {
            console.error(`❌ [Bulk Message] Error processing conversation ${conversation._id}:`, error);
            errors.push({
              conversationId: conversation._id.toString(),
              error: error.message || 'Unknown error'
            });
          }
        })
      );
    }

    // Calculate estimated time based on rate limits (default: 3 messages/second)
    const defaultRateLimit = 3; // messages per second
    const estimatedTimeToComplete = Math.ceil(successCount / defaultRateLimit);

    console.log(`✅ [Bulk Message] Successfully queued ${successCount} messages. Errors: ${errors.length}`);

    res.json({
      success: true,
      data: {
        totalTargeted: validConversations.length,
        messagesQueued: successCount,
        queueIds: queueIds.slice(0, 100), // Limit response size
        estimatedTimeToComplete, // in seconds
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error: any) {
    console.error('❌ Error sending bulk message:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send bulk message'
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
        // Handle aiEnabled: support both string ('off'|'test'|'on') and boolean (for migration)
        aiEnabled: (() => {
          if (!settings?.aiEnabled) return 'on'; // Default to 'on'
          if (typeof settings.aiEnabled === 'boolean') {
            return settings.aiEnabled ? 'on' : 'off'; // Convert boolean to string
          }
          return settings.aiEnabled as 'off' | 'test' | 'on'; // Already a string
        })(),
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
// Toggle account active status (isActive)
router.put('/accounts/:accountId/active', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive field must be a boolean'
      });
    }

    const account = await InstagramAccount.findOne({ accountId });
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Instagram account not found'
      });
    }

    const oldValue = account.isActive;
    console.log(`🔄 [Account Active Toggle] Updating isActive for account ${accountId}: ${oldValue} -> ${isActive}`);
    
    account.isActive = isActive;
    await account.save();
    
    console.log(`✅ [Account Active Toggle] Account ${isActive ? 'activated' : 'deactivated'} successfully: ${accountId}`);

    res.json({
      success: true,
      data: {
        accountId: account.accountId,
        accountName: account.accountName,
        isActive: account.isActive
      }
    });
  } catch (error: any) {
    console.error('❌ Error updating account active status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update account active status'
    });
  }
});

// Update default agent enabled setting for new conversations
router.put('/accounts/:accountId/default-agent-enabled', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { defaultAgentEnabled } = req.body;

    if (typeof defaultAgentEnabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'defaultAgentEnabled must be a boolean'
      });
    }

    const account = await InstagramAccount.findOne({ accountId });
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Instagram account not found'
      });
    }

    // Ensure settings object exists
    if (!account.settings) {
      account.settings = {
        systemPrompt: "You are a helpful customer service assistant for a business. Respond to customer inquiries professionally and helpfully.",
        toneOfVoice: 'professional',
        keyInformation: '',
        fallbackRules: [],
        defaultResponse: "Thanks for your message! I'll get back to you soon.",
        autoRespond: true,
        aiEnabled: 'on',
        defaultAgentEnabled: false
      };
    }

    account.settings.defaultAgentEnabled = defaultAgentEnabled;
    account.markModified('settings');
    await account.save({ validateBeforeSave: false });

    console.log(`✅ [Default Agent Enabled] Updated for account ${accountId}: ${defaultAgentEnabled}`);

    res.json({
      success: true,
      data: {
        accountId: account.accountId,
        accountName: account.accountName,
        defaultAgentEnabled: account.settings.defaultAgentEnabled
      }
    });
  } catch (error: any) {
    console.error('❌ Error updating default agent enabled:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update default agent enabled'
    });
  }
});

// Update AI agent mode for an account (off | test | on)
router.put('/accounts/:accountId/ai-enabled', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { aiEnabled } = req.body;

    // Validate that aiEnabled is one of the allowed values
    if (!['off', 'test', 'on'].includes(aiEnabled)) {
      return res.status(400).json({
        success: false,
        error: 'aiEnabled field must be one of: "off", "test", or "on"'
      });
    }

    const account = await InstagramAccount.findOne({ accountId });
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Instagram account not found'
      });
    }

    // Ensure settings object exists with defaults if needed
    if (!account.settings) {
      account.settings = {
        systemPrompt: "You are a helpful customer service assistant for a business. Respond to customer inquiries professionally and helpfully.",
        toneOfVoice: 'professional',
        keyInformation: '',
        fallbackRules: [],
        defaultResponse: "Thanks for your message! I'll get back to you soon.",
        autoRespond: true,
        aiEnabled: 'on' // Default to 'on' for new accounts
      };
    }

    // Handle migration: if old boolean value exists, convert it
    const oldValue = account.settings?.aiEnabled;
    if (typeof oldValue === 'boolean') {
      // Migrate: true -> 'on', false -> 'off'
      account.settings.aiEnabled = oldValue ? 'on' : 'off';
      console.log(`🔄 [AI Mode] Migrating boolean value: ${oldValue} -> ${account.settings.aiEnabled}`);
    }

    console.log(`🔄 [AI Mode] Updating agent mode for account ${accountId}: ${account.settings.aiEnabled} -> ${aiEnabled}`);
    
    // Update the field
    account.settings.aiEnabled = aiEnabled as 'off' | 'test' | 'on';
    
    // Mark the nested object as modified (IMPORTANT for Mongoose to detect changes in nested objects)
    account.markModified('settings');
    
    // Save with validation disabled to ensure it saves even if other fields have issues
    await account.save({ validateBeforeSave: false });
    
    // Verify the change was saved by re-fetching from DB
    const savedAccount = await InstagramAccount.findOne({ accountId }).lean();
    const savedValue = savedAccount?.settings?.aiEnabled;
    console.log(`✅ [AI Mode] Saved value from DB: ${savedValue} (requested: ${aiEnabled})`);
    
    if (savedValue !== aiEnabled) {
      console.error(`❌ [AI Mode] ERROR: Saved value (${savedValue}) does not match requested value (${aiEnabled})!`);
    }

    res.json({
      success: true,
      data: {
        accountId: account.accountId,
        accountName: account.accountName,
        aiEnabled: account.settings.aiEnabled
      }
    });
  } catch (error: any) {
    console.error('❌ Error updating AI agent mode:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update AI agent mode'
    });
  }
});

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
router.get('/test-connection', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Find the user's Instagram account
    const account = await InstagramAccount.findOne({ 
      userId: userId,
      isActive: true 
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'No active Instagram account found for this user'
      });
    }

    // Initialize the service with the account's access token
    const initialized = await instagramApiService.initialize(account.accountId);
    
    if (!initialized) {
      return res.json({
        success: true,
        data: {
          connected: false,
          message: 'Failed to initialize Instagram API service'
        }
      });
    }

    // Test the connection
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

// Update Instagram account custom instructions
router.put('/accounts/:accountId/instructions', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 [Custom Instructions] PUT request received');
    console.log('🔧 [Custom Instructions] URL:', req.url);
    console.log('🔧 [Custom Instructions] Params:', req.params);
    console.log('🔧 [Custom Instructions] Body:', req.body);
    
    const { accountId } = req.params;
    const { customInstructions } = req.body;

    if (!customInstructions) {
      console.log('🔧 [Custom Instructions] Missing customInstructions in body');
      return res.status(400).json({
        success: false,
        error: 'Custom instructions are required'
      });
    }

    console.log('🔧 [Custom Instructions] Searching for account with ID:', accountId);
    const account = await InstagramAccount.findOne({ accountId });
    console.log('🔧 [Custom Instructions] Account found:', !!account);
    if (account) {
      console.log('🔧 [Custom Instructions] Account details:', {
        id: account._id,
        accountId: account.accountId,
        accountName: account.accountName
      });
    }
    
    if (!account) {
      console.log('🔧 [Custom Instructions] Account not found for ID:', accountId);
      return res.status(404).json({
        success: false,
        error: 'Instagram account not found'
      });
    }

    // Update the system prompt in settings
    console.log('🔧 [Custom Instructions] Updating system prompt...');
    account.settings.systemPrompt = customInstructions;
    await account.save();
    console.log('🔧 [Custom Instructions] Account saved successfully');

    console.log(`✅ Updated custom instructions for account: ${accountId}`);

    res.json({
      success: true,
      data: {
        message: 'Custom instructions updated successfully',
        account: {
          id: account._id,
          accountId: account.accountId,
          accountName: account.accountName,
          customInstructions: account.settings.systemPrompt
        }
      }
    });

  } catch (error) {
    console.error('❌ Error updating custom instructions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update custom instructions'
    });
  }
});

// Get account MCP tools configuration
router.get('/accounts/:accountId/mcp-tools', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const account = await InstagramAccount.findOne({ accountId });
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Instagram account not found'
      });
    }

    res.json({
      success: true,
      data: account.mcpTools || { enabled: false, servers: [] }
    });
  } catch (error: any) {
    console.error('❌ Error fetching account MCP tools:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch MCP tools'
    });
  }
});

// Update account MCP tools configuration (enable/disable)
router.put('/accounts/:accountId/mcp-tools', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { enabled } = req.body;

    const account = await InstagramAccount.findOne({ accountId });
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Instagram account not found'
      });
    }

    if (!account.mcpTools) {
      account.mcpTools = { enabled: false, servers: [] };
    }
    account.mcpTools.enabled = enabled !== undefined ? enabled : account.mcpTools.enabled;
    await account.save();

    res.json({
      success: true,
      data: account.mcpTools
    });
  } catch (error: any) {
    console.error('❌ Error updating account MCP tools:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update MCP tools'
    });
  }
});

// Add or update MCP server for an account
router.post('/accounts/:accountId/mcp-tools/servers', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const server = req.body;

    if (!server.name || !server.url) {
      return res.status(400).json({
        success: false,
        error: 'Server name and URL are required'
      });
    }

    const account = await InstagramAccount.findOne({ accountId });
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Instagram account not found'
      });
    }

    if (!account.mcpTools) {
      account.mcpTools = { enabled: false, servers: [] };
    }

    const existingIndex = account.mcpTools.servers.findIndex(s => s.name === server.name);
    
    if (existingIndex >= 0) {
      account.mcpTools.servers[existingIndex] = {
        ...account.mcpTools.servers[existingIndex],
        ...server,
        name: server.name
      };
    } else {
      account.mcpTools.servers.push({
        name: server.name,
        url: server.url,
        connectionType: server.connectionType || 'http',
        authentication: server.authentication || { type: 'none' },
        tools: server.tools || [],
        enabled: server.enabled !== undefined ? server.enabled : true,
        timeout: server.timeout || 30000,
        retryAttempts: server.retryAttempts || 3
      });
    }

    await account.save();

    res.json({
      success: true,
      data: account.mcpTools.servers.find(s => s.name === server.name)
    });
  } catch (error: any) {
    console.error('❌ Error adding/updating account MCP server:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add/update MCP server'
    });
  }
});

// Delete MCP server from an account
router.delete('/accounts/:accountId/mcp-tools/servers/:serverName', authenticateToken, async (req, res) => {
  try {
    const { accountId, serverName } = req.params;

    const account = await InstagramAccount.findOne({ accountId });
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Instagram account not found'
      });
    }

    if (!account.mcpTools) {
      return res.status(404).json({
        success: false,
        error: 'No MCP tools configuration found'
      });
    }

    account.mcpTools.servers = account.mcpTools.servers.filter(s => s.name !== serverName);
    await account.save();

    res.json({
      success: true,
      message: 'MCP server deleted successfully'
    });
  } catch (error: any) {
    console.error('❌ Error deleting account MCP server:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete MCP server'
    });
  }
});

// Toggle agent status for a conversation
router.put('/conversations/:id/agent', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 [Agent Toggle] PUT request received');
    console.log('🔧 [Agent Toggle] URL:', req.url);
    console.log('🔧 [Agent Toggle] Params:', req.params);
    console.log('🔧 [Agent Toggle] Body:', req.body);
    
    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      console.log('🔧 [Agent Toggle] Invalid enabled value:', enabled);
      return res.status(400).json({
        success: false,
        error: 'enabled field must be a boolean'
      });
    }

    console.log('🔧 [Agent Toggle] Searching for conversation with ID:', id);
    const conversation = await Conversation.findById(id);
    console.log('🔧 [Agent Toggle] Conversation found:', !!conversation);
    
    if (conversation) {
      console.log('🔧 [Agent Toggle] Current AI enabled status:', conversation.settings?.aiEnabled);
    }
    
    if (!conversation) {
      console.log('🔧 [Agent Toggle] Conversation not found for ID:', id);
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Update the AI enabled status
    console.log('🔧 [Agent Toggle] Updating AI enabled status to:', enabled);
    if (!conversation.settings) {
      conversation.settings = {
        // autoRespond removed from simplified model
        aiEnabled: true,
        // priority removed from simplified model
        // tags removed from simplified model
        // notes removed from simplified model
        // followUpRequired removed from simplified model
        // businessHoursOnly removed from simplified model
        responseCounter: {
          totalResponses: 0,
          lastResetAt: new Date(),
          disabledByResponseLimit: false,
          disabledByLeadScore: false,
          disabledByMilestone: false
        }
      };
    }
    conversation.settings.aiEnabled = enabled;
    await conversation.save();
    console.log('🔧 [Agent Toggle] Conversation saved successfully');

    console.log(`✅ Updated agent status for conversation: ${id} to ${enabled}`);

    res.json({
      success: true,
      data: {
        message: 'Agent status updated successfully',
        conversation: {
          id: conversation._id,
          agentEnabled: conversation.settings.aiEnabled
        }
      }
    });

  } catch (error) {
    console.error('❌ Error updating agent status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update agent status'
    });
  }
});

// ===== ACCOUNT MILESTONE CONFIGURATION ENDPOINT =====

// Set/Update default milestone configuration for an account
router.put('/accounts/:accountId/milestone', authenticateToken, async (req, res) => {
  try {
    console.log('🎯 [Account Milestone] PUT request received');
    console.log('🎯 [Account Milestone] URL:', req.url);
    console.log('🎯 [Account Milestone] Params:', req.params);
    console.log('🎯 [Account Milestone] Body:', req.body);

    const { accountId } = req.params;
    const { defaultMilestone } = req.body;

    if (!defaultMilestone) {
      console.log('🎯 [Account Milestone] Missing defaultMilestone in body');
      return res.status(400).json({
        success: false,
        error: 'defaultMilestone field is required'
      });
    }

    // Validate milestone target
    const validTargets = ['link_shared', 'meeting_scheduled', 'demo_booked', 'custom'];
    if (defaultMilestone.target && !validTargets.includes(defaultMilestone.target)) {
      console.log('🎯 [Account Milestone] Invalid target:', defaultMilestone.target);
      return res.status(400).json({
        success: false,
        error: 'Invalid target. Must be one of: link_shared, meeting_scheduled, demo_booked, custom'
      });
    }

    // If target is custom, customTarget is required
    if (defaultMilestone.target === 'custom' && !defaultMilestone.customTarget) {
      console.log('🎯 [Account Milestone] Custom target requires customTarget');
      return res.status(400).json({
        success: false,
        error: 'Custom target requires customTarget field'
      });
    }

    console.log('🎯 [Account Milestone] Searching for account with ID:', accountId);
    const account = await InstagramAccount.findOne({ accountId });
    console.log('🎯 [Account Milestone] Account found:', !!account);

    if (!account) {
      console.log('🎯 [Account Milestone] Account not found for ID:', accountId);
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Update account settings with default milestone
    console.log('🎯 [Account Milestone] Updating default milestone for account:', accountId);
    if (!account.settings) {
      account.settings = {
        autoRespond: true,
        aiEnabled: 'on',
        fallbackRules: [],
        defaultResponse: "Thanks for your message! I'll get back to you soon.",
        systemPrompt: "You are a helpful customer service assistant for a business. Respond to customer inquiries professionally and helpfully.",
        toneOfVoice: 'professional',
        keyInformation: '',
        defaultMilestone: defaultMilestone
      };
    } else {
      account.settings.defaultMilestone = defaultMilestone;
    }

    await account.save();
    console.log('🎯 [Account Milestone] Account saved successfully');

    console.log(`✅ Updated default milestone for account: ${accountId}`);
    res.json({
      success: true,
      data: {
        message: 'Default milestone configuration updated successfully',
        defaultMilestone: account.settings.defaultMilestone
      }
    });

  } catch (error) {
    console.error('❌ Error updating default milestone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update default milestone configuration'
    });
  }
});

// ===== MILESTONE MANAGEMENT ENDPOINTS =====

// Set/Update milestone for a conversation
router.put('/conversations/:id/milestone', authenticateToken, async (req, res) => {
  try {
    console.log('🎯 [Milestone] PUT request received');
    console.log('🎯 [Milestone] URL:', req.url);
    console.log('🎯 [Milestone] Params:', req.params);
    console.log('🎯 [Milestone] Body:', req.body);

    const { id } = req.params;
    const { target, customTarget, autoDisableAgent = true, notes } = req.body;

    // Validate target
    const validTargets = ['link_shared', 'meeting_scheduled', 'demo_booked', 'custom'];
    if (target && !validTargets.includes(target)) {
      console.log('🎯 [Milestone] Invalid target:', target);
      return res.status(400).json({
        success: false,
        error: 'Invalid target. Must be one of: link_shared, meeting_scheduled, demo_booked, custom'
      });
    }

    // If target is custom, customTarget is required
    if (target === 'custom' && !customTarget) {
      console.log('🎯 [Milestone] Custom target requires customTarget');
      return res.status(400).json({
        success: false,
        error: 'Custom target requires customTarget field'
      });
    }

    console.log('🎯 [Milestone] Searching for conversation with ID:', id);
    const conversation = await Conversation.findById(id);
    console.log('🎯 [Milestone] Conversation found:', !!conversation);

    if (!conversation) {
      console.log('🎯 [Milestone] Conversation not found for ID:', id);
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Update milestone
    console.log('🎯 [Milestone] Updating milestone for conversation:', id);
    conversation.milestone = {
      target: target || undefined,
      customTarget: customTarget || undefined,
      status: 'pending',
      autoDisableAgent: autoDisableAgent,
      notes: notes || undefined
    };

    await conversation.save();
    console.log('🎯 [Milestone] Conversation saved successfully');

    console.log(`✅ Updated milestone for conversation: ${id}`);
    res.json({
      success: true,
      data: {
        message: 'Milestone updated successfully',
        milestone: conversation.milestone
      }
    });

  } catch (error) {
    console.error('❌ Error updating milestone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update milestone'
    });
  }
});

// Get milestone for a conversation
router.get('/conversations/:id/milestone', authenticateToken, async (req, res) => {
  try {
    console.log('🎯 [Milestone] GET request received');
    console.log('🎯 [Milestone] URL:', req.url);
    console.log('🎯 [Milestone] Params:', req.params);

    const { id } = req.params;

    console.log('🎯 [Milestone] Searching for conversation with ID:', id);
    const conversation = await Conversation.findById(id);
    console.log('🎯 [Milestone] Conversation found:', !!conversation);

    if (!conversation) {
      console.log('🎯 [Milestone] Conversation not found for ID:', id);
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    console.log(`✅ Retrieved milestone for conversation: ${id}`);
    res.json({
      success: true,
      data: {
        milestone: conversation.milestone
      }
    });

  } catch (error) {
    console.error('❌ Error getting milestone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get milestone'
    });
  }
});

// Delete conversation
router.delete('/conversations/:id', authenticateToken, async (req, res) => {
  try {
    console.log('🗑️ [Delete] DELETE conversation request received');
    console.log('🗑️ [Delete] URL:', req.url);
    console.log('🗑️ [Delete] Params:', req.params);

    const { id } = req.params;

    console.log('🗑️ [Delete] Searching for conversation with ID:', id);
    const conversation = await Conversation.findById(id);
    console.log('🗑️ [Delete] Conversation found:', !!conversation);

    if (!conversation) {
      console.log('🗑️ [Delete] Conversation not found for ID:', id);
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Check if user owns this conversation
    const userAccounts = await InstagramAccount.find({ userId: req.user!.userId }).select('accountId');
    const userAccountIds = userAccounts.map(acc => acc.accountId);
    
    if (!userAccountIds.includes(conversation.accountId)) {
      console.log('🗑️ [Delete] User does not own this conversation');
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Delete all messages associated with this conversation
    const messageDeleteResult = await Message.deleteMany({ conversationId: id });
    console.log('🗑️ [Delete] Deleted messages:', messageDeleteResult.deletedCount);

    // Delete the conversation
    await Conversation.findByIdAndDelete(id);
    console.log('🗑️ [Delete] Deleted conversation:', id);

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation'
    });
  }
});

// Mark milestone as achieved
router.post('/conversations/:id/milestone/achieve', authenticateToken, async (req, res) => {
  try {
    console.log('🎯 [Milestone] POST achieve request received');
    console.log('🎯 [Milestone] URL:', req.url);
    console.log('🎯 [Milestone] Params:', req.params);
    console.log('🎯 [Milestone] Body:', req.body);

    const { id } = req.params;
    const { notes } = req.body;

    console.log('🎯 [Milestone] Searching for conversation with ID:', id);
    const conversation = await Conversation.findById(id);
    console.log('🎯 [Milestone] Conversation found:', !!conversation);

    if (!conversation) {
      console.log('🎯 [Milestone] Conversation not found for ID:', id);
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    if (!conversation.milestone || !conversation.milestone.target) {
      console.log('🎯 [Milestone] No milestone set for conversation:', id);
      return res.status(400).json({
        success: false,
        error: 'No milestone set for this conversation'
      });
    }

    // Mark milestone as achieved
    console.log('🎯 [Milestone] Marking milestone as achieved for conversation:', id);
    conversation.milestone.status = 'achieved';
    conversation.milestone.achievedAt = new Date();
    if (notes) {
      conversation.milestone.notes = notes;
    }

    // Auto-disable agent if configured
    if (conversation.milestone.autoDisableAgent) {
      console.log('🎯 [Milestone] Auto-disabling agent for conversation:', id);
      if (!conversation.settings) {
        conversation.settings = {
          // autoRespond removed from simplified model
          aiEnabled: true,
          // priority removed from simplified model
          // tags removed from simplified model
          // notes removed from simplified model
          // followUpRequired removed from simplified model
          // businessHoursOnly removed from simplified model
          responseCounter: {
            totalResponses: 0,
            lastResetAt: new Date(),
            disabledByResponseLimit: false,
            disabledByLeadScore: false,
            disabledByMilestone: false
          }
        };
      }
      conversation.settings.aiEnabled = false;
    }

    await conversation.save();
    console.log('🎯 [Milestone] Conversation saved successfully');

    console.log(`✅ Milestone achieved for conversation: ${id}`);
    res.json({
      success: true,
      data: {
        message: 'Milestone marked as achieved',
        milestone: conversation.milestone,
        agentDisabled: conversation.milestone.autoDisableAgent
      }
    });

  } catch (error) {
    console.error('❌ Error achieving milestone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to achieve milestone'
    });
  }
});

// Test chat endpoint for testing agent responses
router.post('/test-chat', authenticateToken, async (req, res) => {
  try {
    console.log('💬 [Test Chat] POST request received');
    console.log('📥 [Test Chat] Request body:', JSON.stringify({
      message: req.body.message,
      conversationHistoryLength: req.body.conversationHistory?.length || 0
    }, null, 2));
    
    const { message, conversationHistory } = req.body;
    
    if (!message) {
      console.log('❌ [Test Chat] Missing message in request');
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log('👤 [Test Chat] User ID:', req.user?.userId);
    console.log('💬 [Test Chat] Current message:', message);
    console.log('📜 [Test Chat] Previous conversation history length:', conversationHistory?.length || 0);

    // Get user's Instagram account settings for agent behavior
    const userId = req.user?.userId;
    let agentBehavior = {
      systemPrompt: undefined as string | undefined,
      toneOfVoice: undefined as string | undefined,
      keyInformation: undefined as string | undefined,
      fallbackRules: undefined as string[] | undefined
    };

    let accountMcpConfig: { enabled: boolean; servers: any[] } | undefined;
    if (userId) {
      console.log('🔍 [Test Chat] Looking up Instagram account for userId:', userId);
      const account = await InstagramAccount.findOne({ userId });
      if (account?.settings) {
        agentBehavior = {
          systemPrompt: account.settings.systemPrompt,
          toneOfVoice: account.settings.toneOfVoice,
          keyInformation: account.settings.keyInformation,
          fallbackRules: account.settings.fallbackRules
        };
        // Get account-specific MCP configuration
        accountMcpConfig = account.mcpTools || undefined;
        console.log('✅ [Test Chat] Found account settings:', {
          hasSystemPrompt: !!agentBehavior.systemPrompt,
          systemPromptLength: agentBehavior.systemPrompt?.length || 0,
          toneOfVoice: agentBehavior.toneOfVoice,
          hasKeyInformation: !!agentBehavior.keyInformation,
          fallbackRulesCount: agentBehavior.fallbackRules?.length || 0,
          hasMcpConfig: !!accountMcpConfig,
          mcpServersCount: accountMcpConfig?.servers?.length || 0
        });
      } else {
        console.log('⚠️ [Test Chat] No account or settings found for userId:', userId);
      }
    } else {
      console.log('⚠️ [Test Chat] No userId in request');
    }

    // Build complete conversation history including current message
    const fullHistory = [
      ...(conversationHistory || []),
      {
        role: 'user' as const,
        content: message,
        timestamp: new Date()
      }
    ];

    console.log('📋 [Test Chat] Full conversation history:', JSON.stringify(
      fullHistory.map(msg => ({
        role: msg.role,
        content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
        timestamp: msg.timestamp
      })),
      null,
      2
    ));

    console.log('🤖 [Test Chat] Calling generateInstagramResponse...');
    const startTime = Date.now();

    // Generate response using OpenAI service
    const response = await generateInstagramResponse({
      conversationHistory: fullHistory,
      language: 'es',
      agentBehavior: agentBehavior,
      accountMcpConfig: accountMcpConfig
    });

    const duration = Date.now() - startTime;
    console.log(`✅ [Test Chat] Response generated successfully in ${duration}ms`);
    console.log('📤 [Test Chat] Response length:', response.length);
    console.log('📤 [Test Chat] Response preview:', response.substring(0, 200) + (response.length > 200 ? '...' : ''));
    
    res.json({
      success: true,
      data: {
        response: response
      }
    });
  } catch (error: any) {
    console.error('❌ [Test Chat] Error in test chat:', error);
    console.error('❌ [Test Chat] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate response'
    });
  }
});

// Keyword Activation Routes
// Get all keyword activation rules for an account
router.get('/:accountId/keyword-activation', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.userId;

    const rules = await KeywordActivationRule.find({
      accountId,
      userId
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { rules }
    });
  } catch (error: any) {
    console.error('❌ Error fetching keyword activation rules:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch keyword activation rules'
    });
  }
});

// Create a new keyword activation rule
router.post('/:accountId/keyword-activation', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.userId;
    const { keyword, enabled = true } = req.body;

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Keyword is required and must be a non-empty string'
      });
    }

    // Normalize keyword to lowercase
    const normalizedKeyword = keyword.trim().toLowerCase();

    // Check if keyword already exists for this account
    const existingRule = await KeywordActivationRule.findOne({
      accountId,
      keyword: normalizedKeyword
    });

    if (existingRule) {
      return res.status(400).json({
        success: false,
        error: `Keyword "${keyword}" already exists for this account`
      });
    }

    const rule = new KeywordActivationRule({
      accountId,
      userId,
      keyword: normalizedKeyword,
      enabled: enabled === true
    });

    await rule.save();

    res.json({
      success: true,
      data: { rule, message: 'Keyword activation rule created successfully' }
    });
  } catch (error: any) {
    console.error('❌ Error creating keyword activation rule:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Keyword already exists for this account'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create keyword activation rule'
    });
  }
});

// Update a keyword activation rule
router.put('/:accountId/keyword-activation/:ruleId', authenticateToken, async (req, res) => {
  try {
    const { accountId, ruleId } = req.params;
    const userId = req.user!.userId;
    const { keyword, enabled } = req.body;

    const rule = await KeywordActivationRule.findOne({
      _id: ruleId,
      accountId,
      userId
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Keyword activation rule not found'
      });
    }

    // Update keyword if provided
    if (keyword !== undefined) {
      if (typeof keyword !== 'string' || keyword.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Keyword must be a non-empty string'
        });
      }

      const normalizedKeyword = keyword.trim().toLowerCase();

      // Check if new keyword already exists (excluding current rule)
      const existingRule = await KeywordActivationRule.findOne({
        accountId,
        keyword: normalizedKeyword,
        _id: { $ne: ruleId }
      });

      if (existingRule) {
        return res.status(400).json({
          success: false,
          error: `Keyword "${keyword}" already exists for this account`
        });
      }

      rule.keyword = normalizedKeyword;
    }

    // Update enabled status if provided
    if (enabled !== undefined) {
      rule.enabled = enabled === true;
    }

    await rule.save();

    res.json({
      success: true,
      data: { rule, message: 'Keyword activation rule updated successfully' }
    });
  } catch (error: any) {
    console.error('❌ Error updating keyword activation rule:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Keyword already exists for this account'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update keyword activation rule'
    });
  }
});

// Delete a keyword activation rule
router.delete('/:accountId/keyword-activation/:ruleId', authenticateToken, async (req, res) => {
  try {
    const { accountId, ruleId } = req.params;
    const userId = req.user!.userId;

    const rule = await KeywordActivationRule.findOneAndDelete({
      _id: ruleId,
      accountId,
      userId
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Keyword activation rule not found'
      });
    }

    res.json({
      success: true,
      data: { message: 'Keyword activation rule deleted successfully' }
    });
  } catch (error: any) {
    console.error('❌ Error deleting keyword activation rule:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete keyword activation rule'
    });
  }
});

export default router;
