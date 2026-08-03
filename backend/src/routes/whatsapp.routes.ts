import express from 'express';
import whatsappWebhookService, { WhatsappWebhookService } from '../services/whatsappWebhook.service';
import whatsappCloudApi from '../services/channels/whatsappCloudApi.service';
import { isWithinServiceWindow } from '../services/channels/whatsapp.adapter';
import WhatsappAccount from '../models/whatsappAccount.model';
import Contact from '../models/contact.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import OutboundQueue from '../models/outboundQueue.model';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
const webhookService: WhatsappWebhookService = whatsappWebhookService;

console.log('🔧 [WhatsApp Routes] Router initialized');

// ===== WEBHOOK =====

// Meta verification handshake
router.get('/webhook', (req, res) => {
  try {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    if (!mode || !token || !challenge) {
      console.log('⚠️ [WhatsApp Webhook] Missing verification parameters');
      return res.status(400).send('Bad Request');
    }

    const response = webhookService.handleVerification(mode, token, challenge);
    if (response) {
      return res.status(200).send(response);
    }
    return res.status(403).send('Forbidden');
  } catch (error) {
    console.error('❌ [WhatsApp Webhook] Error in verification:', error);
    return res.status(500).send('Internal Server Error');
  }
});

// Inbound messages and status callbacks
router.post('/webhook', async (req, res) => {
  // Answer immediately. Meta retries anything slower than ~5s, and a retry storm
  // is far more damaging than a dropped log line — processing continues below.
  res.status(200).send('OK');

  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      console.error('❌ [WhatsApp Webhook] Missing X-Hub-Signature-256 — rejecting');
      return;
    }

    // Must be the raw body: re-serializing JSON changes bytes Meta signed.
    const rawBody = (req as any).rawBody ?? JSON.stringify(req.body);
    const isValid = await webhookService.validateSignature(rawBody, signature);
    if (!isValid) {
      console.error('❌ [WhatsApp Webhook] Invalid signature — rejecting');
      return;
    }

    await webhookService.handleWebhook(req.body);
  } catch (error) {
    console.error('❌ [WhatsApp Webhook] Error processing webhook:', error);
  }
});

// ===== ACCOUNTS =====

/** Never return credentials, not even to the owner. */
const ACCOUNT_PROJECTION = '-accessToken -appSecret -verifyToken -__v';

router.post('/accounts', authenticateToken, async (req, res) => {
  try {
    const {
      phoneNumberId,
      wabaId,
      displayPhoneNumber,
      accountName,
      accessToken,
      verifyToken,
      appSecret,
      settings,
      rateLimits
    } = req.body;

    if (!phoneNumberId || !wabaId || !accessToken || !displayPhoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumberId, wabaId, displayPhoneNumber and accessToken are required'
      });
    }

    const existing = await WhatsappAccount.findOne({ phoneNumberId });
    if (existing) {
      return res.status(409).json({ success: false, error: 'WhatsApp account already exists' });
    }

    const account = new WhatsappAccount({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      phoneNumberId,
      wabaId,
      displayPhoneNumber,
      accountName: accountName || `WhatsApp ${displayPhoneNumber}`,
      accessToken,
      verifyToken,
      appSecret,
      settings: settings || {},
      rateLimits: rateLimits || {}
    });

    await account.save();
    console.log(`✅ [WhatsApp Routes] Created account ${phoneNumberId}`);

    res.status(201).json({
      success: true,
      data: {
        message: 'WhatsApp account created successfully',
        account: {
          id: account.id,
          phoneNumberId: account.phoneNumberId,
          displayPhoneNumber: account.displayPhoneNumber,
          accountName: account.accountName,
          settings: account.settings,
          rateLimits: account.rateLimits
        }
      }
    });
  } catch (error: any) {
    console.error('❌ [WhatsApp Routes] Error creating account:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create account' });
  }
});

router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const accounts = await WhatsappAccount.find({ userId: req.user!.userId })
      .select(ACCOUNT_PROJECTION)
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { accounts, count: accounts.length } });
  } catch (error: any) {
    console.error('❌ [WhatsApp Routes] Error listing accounts:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to list accounts' });
  }
});

router.put('/accounts/:phoneNumberId', authenticateToken, async (req, res) => {
  try {
    const { phoneNumberId } = req.params;
    const { accessToken, accountName, settings, rateLimits, isActive, verifyToken, appSecret } = req.body;

    const account = await WhatsappAccount.findOne({ phoneNumberId, userId: req.user!.userId });
    if (!account) {
      return res.status(404).json({ success: false, error: 'WhatsApp account not found' });
    }

    if (accessToken) account.accessToken = accessToken;
    if (verifyToken !== undefined) account.verifyToken = verifyToken;
    if (appSecret !== undefined) account.appSecret = appSecret;
    if (accountName) account.accountName = accountName;
    if (typeof isActive === 'boolean') account.isActive = isActive;
    if (rateLimits) account.rateLimits = { ...account.rateLimits, ...rateLimits };
    if (settings) {
      account.settings = { ...account.settings, ...settings };
      account.markModified('settings');
    }

    await account.save();

    res.json({
      success: true,
      data: {
        phoneNumberId: account.phoneNumberId,
        accountName: account.accountName,
        isActive: account.isActive,
        settings: account.settings,
        rateLimits: account.rateLimits
      }
    });
  } catch (error: any) {
    console.error('❌ [WhatsApp Routes] Error updating account:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update account' });
  }
});

router.put('/accounts/:phoneNumberId/ai-enabled', authenticateToken, async (req, res) => {
  try {
    const { phoneNumberId } = req.params;
    const { aiEnabled } = req.body;

    if (!['off', 'test', 'on'].includes(aiEnabled)) {
      return res.status(400).json({ success: false, error: 'aiEnabled must be "off", "test" or "on"' });
    }

    const account = await WhatsappAccount.findOne({ phoneNumberId, userId: req.user!.userId });
    if (!account) {
      return res.status(404).json({ success: false, error: 'WhatsApp account not found' });
    }

    account.settings.aiEnabled = aiEnabled;
    account.markModified('settings');
    await account.save({ validateBeforeSave: false });

    res.json({
      success: true,
      data: { phoneNumberId: account.phoneNumberId, aiEnabled: account.settings.aiEnabled }
    });
  } catch (error: any) {
    console.error('❌ [WhatsApp Routes] Error updating aiEnabled:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update aiEnabled' });
  }
});

router.get('/accounts/:phoneNumberId/test-connection', authenticateToken, async (req, res) => {
  try {
    const { phoneNumberId } = req.params;
    const account = await WhatsappAccount.findOne({ phoneNumberId, userId: req.user!.userId });
    if (!account) {
      return res.status(404).json({ success: false, error: 'WhatsApp account not found' });
    }

    const result = await whatsappCloudApi.testConnection({
      phoneNumberId: account.phoneNumberId,
      accessToken: account.accessToken
    });

    res.json({ success: true, data: { connected: result.ok, ...result } });
  } catch (error: any) {
    console.error('❌ [WhatsApp Routes] Error testing connection:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to test connection' });
  }
});

// ===== CONVERSATIONS / HANDOFF =====

async function getUserPhoneNumberIds(userId: string): Promise<string[]> {
  const accounts = await WhatsappAccount.find({ userId }).select('phoneNumberId');
  return accounts.map(account => account.phoneNumberId);
}

router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const accountIds = await getUserPhoneNumberIds(req.user!.userId);

    if (accountIds.length === 0) {
      return res.json({ success: true, data: { conversations: [], count: 0 } });
    }

    const query: any = { channel: 'whatsapp', accountId: { $in: accountIds } };
    if (status) query.status = status;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const conversations = await Conversation.find(query)
      .sort({ 'timestamps.lastActivity': -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .populate('contactId', 'name waId phone metadata')
      .lean();

    const total = await Conversation.countDocuments(query);

    // The window state is what the operator needs before typing: outside it,
    // a free-form reply cannot be delivered at all.
    const enriched = conversations.map(conversation => {
      const window = isWithinServiceWindow(conversation);
      return {
        ...conversation,
        id: conversation._id.toString(),
        serviceWindow: {
          open: window.allowed,
          lastInboundAt: window.lastInboundAt ?? null,
          hoursSinceLastInbound: window.hoursSince ?? null
        }
      };
    });

    res.json({
      success: true,
      data: {
        conversations: enriched,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });
  } catch (error: any) {
    console.error('❌ [WhatsApp Routes] Error listing conversations:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to list conversations' });
  }
});

router.get('/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const accountIds = await getUserPhoneNumberIds(req.user!.userId);
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      channel: 'whatsapp',
      accountId: { $in: accountIds }
    }).populate('contactId', 'name waId phone metadata');

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const messages = await Message.find({ conversationId: req.params.id })
      .sort({ 'metadata.timestamp': 1 })
      .select('-__v');

    const window = isWithinServiceWindow(conversation);

    res.json({
      success: true,
      data: {
        conversation,
        messages,
        serviceWindow: {
          open: window.allowed,
          lastInboundAt: window.lastInboundAt ?? null,
          hoursSinceLastInbound: window.hoursSince ?? null
        }
      }
    });
  } catch (error: any) {
    console.error('❌ [WhatsApp Routes] Error getting conversation:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get conversation' });
  }
});

/** Pause/resume the AI for one conversation — the human handoff switch. */
router.put('/conversations/:id/agent', authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
    }

    const accountIds = await getUserPhoneNumberIds(req.user!.userId);
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      channel: 'whatsapp',
      accountId: { $in: accountIds }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    conversation.settings.aiEnabled = enabled;
    await conversation.save();

    console.log(`✅ [WhatsApp Routes] Agent ${enabled ? 'resumed' : 'paused'} for conversation ${conversation.id}`);

    res.json({
      success: true,
      data: { id: conversation.id, agentEnabled: conversation.settings.aiEnabled }
    });
  } catch (error: any) {
    console.error('❌ [WhatsApp Routes] Error toggling agent:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to toggle agent' });
  }
});

/** Send a manual reply — queued through the same outbound worker as the AI. */
router.post('/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { content, priority = 'normal' } = req.body;
    if (!content?.text?.trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }

    const accountIds = await getUserPhoneNumberIds(req.user!.userId);
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      channel: 'whatsapp',
      accountId: { $in: accountIds }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // Reject at the API boundary rather than letting the operator watch a
    // message sit in the queue only to die there — the answer is the same
    // either way, but here it arrives while they are still looking at it.
    const window = isWithinServiceWindow(conversation);
    if (!window.allowed) {
      return res.status(409).json({
        success: false,
        error: 'WhatsApp 24h service window is closed for this conversation. ' +
          'Free-form messages cannot be delivered until the contact writes again.',
        data: {
          lastInboundAt: window.lastInboundAt ?? null,
          hoursSinceLastInbound: window.hoursSince ?? null
        }
      });
    }

    const contact = await Contact.findById(conversation.contactId);
    if (!contact?.waId) {
      return res.status(400).json({ success: false, error: 'Contact has no WhatsApp id' });
    }

    const message = new Message({
      mid: `manual_wa_${Date.now()}_${conversation.id}`,
      conversationId: conversation.id,
      contactId: conversation.contactId,
      accountId: conversation.accountId,
      channel: 'whatsapp',
      role: 'assistant',
      content: { text: content.text.trim() },
      metadata: {
        timestamp: new Date(),
        aiGenerated: false,
        isManual: true
      },
      status: 'queued'
    });
    await message.save();

    const queueItem = new OutboundQueue({
      messageId: message.id,
      conversationId: conversation.id,
      contactId: conversation.contactId,
      accountId: conversation.accountId,
      channel: 'whatsapp',
      priority,
      status: 'pending',
      content: { text: content.text.trim() }
    });
    await queueItem.save();

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $inc: { messageCount: 1, 'metrics.totalMessages': 1, 'metrics.botMessages': 1 },
        $set: { 'timestamps.lastBotMessage': new Date(), 'timestamps.lastActivity': new Date() }
      }
    );

    res.json({ success: true, data: { message, queueItem } });
  } catch (error: any) {
    console.error('❌ [WhatsApp Routes] Error sending manual message:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to send message' });
  }
});

export default router;
