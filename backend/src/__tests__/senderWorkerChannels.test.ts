import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import InstagramAccount from '../models/instagramAccount.model';
import WhatsappAccount from '../models/whatsappAccount.model';
import Contact from '../models/contact.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import OutboundQueue from '../models/outboundQueue.model';
import senderWorker from '../services/senderWorker.service';
import instagramApiService from '../services/instagramApi.service';

const IG_ACCOUNT_ID = '17841401675262878';
const PHONE_NUMBER_ID = '111222333444555';

async function seedAccounts() {
  await InstagramAccount.create({
    userId: '665000000000000000000001',
    userEmail: 'owner@example.com',
    accountId: IG_ACCOUNT_ID,
    pageScopedId: IG_ACCOUNT_ID,
    accountName: 'moca_test',
    accessToken: 'test-token',
    tokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
    isActive: true,
    // Cooldowns make the rate limiter reject the second send in a test run.
    rateLimits: { messagesPerSecond: 0, userCooldown: 0 }
  });

  await WhatsappAccount.create({
    userId: '665000000000000000000001',
    userEmail: 'owner@example.com',
    phoneNumberId: PHONE_NUMBER_ID,
    wabaId: '999888777',
    displayPhoneNumber: '+56 9 1111 2222',
    accountName: 'Test WhatsApp',
    accessToken: 'test-wa-token',
    isActive: true,
    rateLimits: { messagesPerSecond: 0, userCooldown: 0 }
  });
}

/** Build a full contact → conversation → message → queue-item chain. */
async function seedQueueItem(channel: 'instagram' | 'whatsapp', options: { lastInboundAt?: Date } = {}) {
  const contact = await Contact.create(
    channel === 'whatsapp'
      ? { waId: '56912345678', phone: '+56912345678', channel: 'whatsapp', name: 'Ana' }
      : { psid: 'psid-abc-123', channel: 'instagram', name: 'Ana' }
  );

  const accountId = channel === 'whatsapp' ? PHONE_NUMBER_ID : IG_ACCOUNT_ID;

  const conversation = await Conversation.create({
    contactId: contact._id,
    accountId,
    channel,
    status: 'open',
    timestamps: {
      createdAt: new Date(),
      lastUserMessage: new Date(),
      lastActivity: new Date(),
      lastInboundAt: options.lastInboundAt ?? new Date()
    }
  });

  const message = await Message.create({
    mid: `bot_${channel}_${Date.now()}`,
    conversationId: conversation.id,
    contactId: contact.id,
    accountId,
    channel,
    role: 'assistant',
    content: { text: 'Hola desde Moca' },
    status: 'queued',
    metadata: { timestamp: new Date(), aiGenerated: true }
  });

  const queueItem = await OutboundQueue.create({
    messageId: message.id,
    conversationId: conversation.id,
    contactId: contact.id,
    accountId,
    channel,
    priority: 'normal',
    status: 'pending',
    content: { text: 'Hola desde Moca' },
    metadata: { scheduledFor: new Date(), attempts: 0, maxAttempts: 3 }
  });

  return { contact, conversation, message, queueItem };
}

const processQueueItem = (item: any) => (senderWorker as any).processQueueItem(item);

describe('SenderWorker channel routing', () => {
  beforeEach(async () => {
    await seedAccounts();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends a WhatsApp queue item through the Cloud API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.OUT42' }] })
    });
    vi.stubGlobal('fetch', fetchMock);

    const { queueItem, message } = await seedQueueItem('whatsapp');
    const sent = await processQueueItem(queueItem);

    expect(sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(`/${PHONE_NUMBER_ID}/messages`);

    const updatedMessage = await Message.findById(message.id);
    expect(updatedMessage?.status).toBe('sent');
    expect(updatedMessage?.metadata?.whatsappResponse?.messageId).toBe('wamid.OUT42');
    // The Instagram slot must stay untouched — two id namespaces, two fields.
    expect(updatedMessage?.metadata?.instagramResponse?.messageId).toBeFalsy();

    expect((await OutboundQueue.findById(queueItem.id))?.status).toBe('sent');
  });

  it('sends an Instagram queue item through the Instagram service, unchanged', async () => {
    const initSpy = vi.spyOn(instagramApiService, 'initialize').mockResolvedValue(true);
    const sendSpy = vi
      .spyOn(instagramApiService, 'sendTextMessage')
      .mockResolvedValue({ message_id: 'mid.IG99', recipient_id: 'psid-abc-123' });

    const { queueItem, message } = await seedQueueItem('instagram');
    const sent = await processQueueItem(queueItem);

    expect(sent).toBe(true);
    expect(initSpy).toHaveBeenCalledWith(IG_ACCOUNT_ID);
    expect(sendSpy).toHaveBeenCalledWith('psid-abc-123', 'Hola desde Moca');

    const updatedMessage = await Message.findById(message.id);
    expect(updatedMessage?.metadata?.instagramResponse?.messageId).toBe('mid.IG99');
    expect(updatedMessage?.metadata?.whatsappResponse?.messageId).toBeFalsy();
  });

  it('treats a queue item with no channel field as Instagram', async () => {
    const initSpy = vi.spyOn(instagramApiService, 'initialize').mockResolvedValue(true);
    vi.spyOn(instagramApiService, 'sendTextMessage').mockResolvedValue({
      message_id: 'mid.LEGACY',
      recipient_id: 'psid-abc-123'
    });

    const { queueItem } = await seedQueueItem('instagram');
    // Strip the field the way every pre-migration document looks on disk.
    await OutboundQueue.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(queueItem.id) },
      { $unset: { channel: '' } }
    );

    const onDisk = await OutboundQueue.collection.findOne({
      _id: new mongoose.Types.ObjectId(queueItem.id)
    });
    expect(onDisk?.channel).toBeUndefined(); // genuinely absent, no backfill

    // Mongoose applies the schema default on hydration, so a legacy document
    // reads back as 'instagram' — which is exactly why no migration is needed.
    const legacyItem = await OutboundQueue.findById(queueItem.id);
    expect(legacyItem?.channel).toBe('instagram');

    expect(await processQueueItem(legacyItem)).toBe(true);
    expect(initSpy).toHaveBeenCalledWith(IG_ACCOUNT_ID);
  });

  it('fails a WhatsApp send outside the 24h window without retrying', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const staleInbound = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const { queueItem, message } = await seedQueueItem('whatsapp', { lastInboundAt: staleInbound });

    expect(await processQueueItem(queueItem)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    const updatedQueueItem = await OutboundQueue.findById(queueItem.id);
    expect(updatedQueueItem?.status).toBe('failed');
    // Terminal on the first attempt — no retry budget burned on a wall.
    expect(updatedQueueItem?.metadata?.nextAttempt).toBeFalsy();

    // And the reason is written down, not just the fact of failure.
    const history = updatedQueueItem?.metadata?.errorHistory ?? [];
    expect(history.length).toBe(1);
    expect(history[0].errorCode).toBe('window_closed');
    expect(history[0].errorMessage).toMatch(/24h service window/i);

    expect((await Message.findById(message.id))?.status).toBe('failed');
  });

  it('schedules a retry for a transient WhatsApp failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { code: 130429, message: 'Rate limit hit' } })
    }));

    const { queueItem } = await seedQueueItem('whatsapp');
    expect(await processQueueItem(queueItem)).toBe(false);

    const updated = await OutboundQueue.findById(queueItem.id);
    expect(updated?.status).toBe('pending'); // still retryable
    expect(updated?.metadata?.attempts).toBe(1);
    expect(updated?.metadata?.nextAttempt).toBeTruthy();
    expect(updated?.metadata?.errorHistory?.[0]?.errorMessage).toMatch(/Rate limit/i);
  });

  it('fails the item when the WhatsApp account is missing', async () => {
    const { queueItem } = await seedQueueItem('whatsapp');
    await WhatsappAccount.deleteOne({ phoneNumberId: PHONE_NUMBER_ID });

    expect(await processQueueItem(queueItem)).toBe(false);

    const updated = await OutboundQueue.findById(queueItem.id);
    expect(updated?.metadata?.errorHistory?.[0]?.errorMessage).toMatch(/account not found/i);
  });
});
