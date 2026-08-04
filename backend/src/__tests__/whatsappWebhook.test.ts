import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import Contact from '../models/contact.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import WhatsappAccount from '../models/whatsappAccount.model';

// Set env before importing the service — the constructor reads it once.
process.env.WHATSAPP_VERIFY_TOKEN = 'test-wa-verify-token';
process.env.WHATSAPP_APP_SECRET = 'test-wa-app-secret-98765';

import { WhatsappWebhookService } from '../services/whatsappWebhook.service';

const APP_SECRET = 'test-wa-app-secret-98765';
const PHONE_NUMBER_ID = '111222333444555';
const WABA_ID = '999888777';
const CONTACT_WA_ID = '56912345678';

function sign(payload: string): string {
  return 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(payload).digest('hex');
}

async function seedAccount(overrides: Record<string, any> = {}) {
  return WhatsappAccount.create({
    userId: '665000000000000000000001',
    userEmail: 'owner@example.com',
    phoneNumberId: PHONE_NUMBER_ID,
    wabaId: WABA_ID,
    displayPhoneNumber: '+56 9 1111 2222',
    accountName: 'Test WhatsApp',
    accessToken: 'test-wa-token',
    isActive: true,
    ...overrides
  });
}

function inboundPayload(overrides: Record<string, any> = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: WABA_ID,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '56911112222',
                phone_number_id: PHONE_NUMBER_ID
              },
              contacts: [{ profile: { name: 'Ana Pérez' }, wa_id: CONTACT_WA_ID }],
              messages: [
                {
                  from: CONTACT_WA_ID,
                  id: 'wamid.TEST001',
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: 'Hola, quiero información' }
                }
              ],
              ...overrides
            }
          }
        ]
      }
    ]
  };
}

describe('WhatsappWebhookService.validateSignature', () => {
  let service: WhatsappWebhookService;

  beforeEach(() => {
    service = new WhatsappWebhookService();
  });

  it('accepts a valid HMAC-SHA256 signature', async () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    expect(await service.validateSignature(payload, sign(payload))).toBe(true);
  });

  it('rejects an invalid signature', async () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    expect(await service.validateSignature(payload, 'sha256=' + 'a'.repeat(64))).toBe(false);
  });

  it('rejects a tampered payload', async () => {
    const original = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const signature = sign(original);
    const tampered = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ hacked: true }] });
    expect(await service.validateSignature(tampered, signature)).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', async () => {
    // crypto.timingSafeEqual throws on length mismatch — the guard must catch it.
    const payload = JSON.stringify({ object: 'whatsapp_business_account' });
    await expect(service.validateSignature(payload, 'sha256=deadbeef')).resolves.toBe(false);
  });

  it('rejects when no app secret is configured', async () => {
    const original = process.env.WHATSAPP_APP_SECRET;
    const originalMeta = process.env.META_APP_SECRET;
    const originalIg = process.env.INSTAGRAM_APP_SECRET;
    process.env.WHATSAPP_APP_SECRET = '';
    process.env.META_APP_SECRET = '';
    process.env.INSTAGRAM_APP_SECRET = '';

    const noSecret = new WhatsappWebhookService();
    const payload = JSON.stringify({ object: 'whatsapp_business_account' });
    expect(await noSecret.validateSignature(payload, sign(payload))).toBe(false);

    process.env.WHATSAPP_APP_SECRET = original;
    process.env.META_APP_SECRET = originalMeta;
    process.env.INSTAGRAM_APP_SECRET = originalIg;
  });

  it('falls back to INSTAGRAM_APP_SECRET — both products run off one Meta app', async () => {
    const original = process.env.WHATSAPP_APP_SECRET;
    const originalMeta = process.env.META_APP_SECRET;
    const originalIg = process.env.INSTAGRAM_APP_SECRET;
    process.env.WHATSAPP_APP_SECRET = '';
    process.env.META_APP_SECRET = '';
    process.env.INSTAGRAM_APP_SECRET = APP_SECRET;

    const fallback = new WhatsappWebhookService();
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    expect(await fallback.validateSignature(payload, sign(payload))).toBe(true);

    process.env.WHATSAPP_APP_SECRET = original;
    process.env.META_APP_SECRET = originalMeta;
    process.env.INSTAGRAM_APP_SECRET = originalIg;
  });
});

describe('WhatsappWebhookService.handleVerification', () => {
  let service: WhatsappWebhookService;

  beforeEach(() => {
    service = new WhatsappWebhookService();
  });

  it('returns the challenge when mode and token match', () => {
    expect(service.handleVerification('subscribe', 'test-wa-verify-token', 'chal-1')).toBe('chal-1');
  });

  it('returns null on wrong mode', () => {
    expect(service.handleVerification('unsubscribe', 'test-wa-verify-token', 'chal-1')).toBeNull();
  });

  it('returns null on wrong token', () => {
    expect(service.handleVerification('subscribe', 'nope', 'chal-1')).toBeNull();
  });
});

describe('WhatsappWebhookService inbound handling', () => {
  let service: WhatsappWebhookService;

  beforeEach(async () => {
    service = new WhatsappWebhookService();
    // markAsRead is fire-and-forget against Graph; stub it out.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => ''
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates contact, conversation and message for a new inbound text', async () => {
    await seedAccount();
    await service.handleWebhook(inboundPayload());

    const contact = await Contact.findOne({ waId: CONTACT_WA_ID });
    expect(contact).toBeTruthy();
    expect(contact?.channel).toBe('whatsapp');
    expect(contact?.name).toBe('Ana Pérez');
    expect(contact?.phone).toBe(`+${CONTACT_WA_ID}`);

    const conversation = await Conversation.findOne({ accountId: PHONE_NUMBER_ID });
    expect(conversation).toBeTruthy();
    expect(conversation?.channel).toBe('whatsapp');
    // The 24h window is measured from this stamp — without it every send is blocked.
    expect(conversation?.timestamps?.lastInboundAt).toBeTruthy();

    const message = await Message.findOne({ mid: 'wamid.TEST001' });
    expect(message).toBeTruthy();
    expect(message?.channel).toBe('whatsapp');
    expect(message?.role).toBe('user');
    expect(message?.content?.text).toBe('Hola, quiero información');
  });

  it('does not duplicate a message when the same webhook is delivered twice', async () => {
    await seedAccount();

    await service.handleWebhook(inboundPayload());
    await service.handleWebhook(inboundPayload());

    expect(await Message.countDocuments({ mid: 'wamid.TEST001' })).toBe(1);
    expect(await Conversation.countDocuments({ accountId: PHONE_NUMBER_ID })).toBe(1);
    expect(await Contact.countDocuments({ waId: CONTACT_WA_ID })).toBe(1);
  });

  it('reuses the existing conversation for a second message from the same contact', async () => {
    await seedAccount();

    await service.handleWebhook(inboundPayload());
    await service.handleWebhook(
      inboundPayload({
        messages: [
          {
            from: CONTACT_WA_ID,
            id: 'wamid.TEST002',
            timestamp: String(Math.floor(Date.now() / 1000)),
            type: 'text',
            text: { body: '¿Cuánto cuesta?' }
          }
        ]
      })
    );

    expect(await Conversation.countDocuments({ accountId: PHONE_NUMBER_ID })).toBe(1);
    expect(await Message.countDocuments({ channel: 'whatsapp' })).toBe(2);
  });

  it('skips messages for an unregistered phone_number_id', async () => {
    // No account seeded — routing must fail closed, not invent an account.
    await service.handleWebhook(inboundPayload());

    expect(await Message.countDocuments({})).toBe(0);
    expect(await Contact.countDocuments({})).toBe(0);
  });

  it('ignores payloads for other Meta products', async () => {
    await seedAccount();
    await service.handleWebhook({ object: 'instagram', entry: [] });

    expect(await Message.countDocuments({})).toBe(0);
  });

  it('parses Meta UNIX-second timestamps into the correct year', async () => {
    await seedAccount();
    const seconds = Math.floor(Date.now() / 1000);

    await service.handleWebhook(
      inboundPayload({
        messages: [
          {
            from: CONTACT_WA_ID,
            id: 'wamid.TS',
            timestamp: String(seconds),
            type: 'text',
            text: { body: 'hora' }
          }
        ]
      })
    );

    const message = await Message.findOne({ mid: 'wamid.TS' });
    // Treating seconds as milliseconds would land this in 1970.
    expect(message?.metadata?.timestamp?.getFullYear()).toBe(new Date().getFullYear());
  });

  it('stores a placeholder for non-text message types instead of dropping the turn', async () => {
    await seedAccount();

    await service.handleWebhook(
      inboundPayload({
        messages: [
          {
            from: CONTACT_WA_ID,
            id: 'wamid.IMG',
            timestamp: String(Math.floor(Date.now() / 1000)),
            type: 'image',
            image: { id: 'media-1', mime_type: 'image/jpeg' }
          }
        ]
      })
    );

    const message = await Message.findOne({ mid: 'wamid.IMG' });
    expect(message?.content?.text).toBe('[image]');
  });
});

describe('WhatsappWebhookService status callbacks', () => {
  let service: WhatsappWebhookService;

  beforeEach(async () => {
    service = new WhatsappWebhookService();
    await seedAccount();
  });

  async function seedOutboundMessage(wamid = 'wamid.OUT001') {
    return Message.create({
      mid: `bot_${Date.now()}`,
      conversationId: '69e8dafdb730d23e3941df05',
      contactId: '69e8dafdb730d23e3941df06',
      accountId: PHONE_NUMBER_ID,
      channel: 'whatsapp',
      role: 'assistant',
      content: { text: 'Hola!' },
      status: 'sent',
      metadata: {
        timestamp: new Date(),
        whatsappResponse: { messageId: wamid, status: 'sent' }
      }
    });
  }

  it('advances a message through sent → delivered → read', async () => {
    const message = await seedOutboundMessage();

    await service.processStatus({ wamid: 'wamid.OUT001', status: 'delivered', timestamp: new Date() });
    let updated = await Message.findById(message._id);
    expect(updated?.metadata?.whatsappResponse?.status).toBe('delivered');
    expect(updated?.deliveryConfirmed).toBe(true);

    await service.processStatus({ wamid: 'wamid.OUT001', status: 'read', timestamp: new Date() });
    updated = await Message.findById(message._id);
    expect(updated?.metadata?.whatsappResponse?.status).toBe('read');
  });

  it('ignores an out-of-order status that would regress state', async () => {
    const message = await seedOutboundMessage();

    await service.processStatus({ wamid: 'wamid.OUT001', status: 'read', timestamp: new Date() });
    // A late 'delivered' arriving after 'read' must not downgrade the message.
    await service.processStatus({ wamid: 'wamid.OUT001', status: 'delivered', timestamp: new Date() });

    const updated = await Message.findById(message._id);
    expect(updated?.metadata?.whatsappResponse?.status).toBe('read');
  });

  it('records the error code and message on failure', async () => {
    const message = await seedOutboundMessage();

    await service.processStatus({
      wamid: 'wamid.OUT001',
      status: 'failed',
      timestamp: new Date(),
      errorCode: '131047',
      errorMessage: 'Re-engagement message'
    });

    const updated = await Message.findById(message._id);
    expect(updated?.status).toBe('failed');
    expect(updated?.metadata?.whatsappResponse?.errorCode).toBe('131047');
    expect(updated?.metadata?.whatsappResponse?.errorMessage).toBe('Re-engagement message');
  });

  it('ignores a status for an unknown wamid', async () => {
    await expect(
      service.processStatus({ wamid: 'wamid.UNKNOWN', status: 'delivered', timestamp: new Date() })
    ).resolves.toBeUndefined();
  });
});
