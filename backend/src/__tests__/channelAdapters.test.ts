import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import InstagramAccount from '../models/instagramAccount.model';
import WhatsappAccount from '../models/whatsappAccount.model';
import { getChannelAdapter, ChannelSendError } from '../services/channels';
import whatsappAdapter, { isWithinServiceWindow, SERVICE_WINDOW_MS } from '../services/channels/whatsapp.adapter';
import instagramAdapter from '../services/channels/instagram.adapter';

const PHONE_NUMBER_ID = '111222333444555';
const IG_ACCOUNT_ID = '17841401675262878';

describe('getChannelAdapter', () => {
  it('routes whatsapp to the WhatsApp adapter', () => {
    expect(getChannelAdapter('whatsapp').channel).toBe('whatsapp');
  });

  it('routes instagram to the Instagram adapter', () => {
    expect(getChannelAdapter('instagram').channel).toBe('instagram');
  });

  it('defaults to Instagram when the channel is missing', () => {
    // Every record written before the channel field existed hits this path.
    expect(getChannelAdapter(undefined).channel).toBe('instagram');
    expect(getChannelAdapter(null).channel).toBe('instagram');
  });

  it('defaults to Instagram for an unrecognized channel', () => {
    expect(getChannelAdapter('carrier-pigeon').channel).toBe('instagram');
  });
});

describe('isWithinServiceWindow', () => {
  it('is open just inside 24h', () => {
    const conversation = {
      timestamps: { lastInboundAt: new Date(Date.now() - (SERVICE_WINDOW_MS - 60_000)) }
    };
    expect(isWithinServiceWindow(conversation).allowed).toBe(true);
  });

  it('is closed just past 24h', () => {
    const conversation = {
      timestamps: { lastInboundAt: new Date(Date.now() - (SERVICE_WINDOW_MS + 60_000)) }
    };
    const result = isWithinServiceWindow(conversation);
    expect(result.allowed).toBe(false);
    expect(result.hoursSince).toBeGreaterThanOrEqual(24);
  });

  it('is closed when no inbound has ever been recorded', () => {
    expect(isWithinServiceWindow({ timestamps: {} }).allowed).toBe(false);
    expect(isWithinServiceWindow(null).allowed).toBe(false);
  });

  it('falls back to lastUserMessage for conversations predating lastInboundAt', () => {
    const conversation = {
      timestamps: { lastUserMessage: new Date(Date.now() - 60_000) }
    };
    expect(isWithinServiceWindow(conversation).allowed).toBe(true);
  });

  it('is closed on an unparseable timestamp', () => {
    expect(isWithinServiceWindow({ timestamps: { lastInboundAt: 'not-a-date' } }).allowed).toBe(false);
  });
});

describe('WhatsappAdapter.sendText', () => {
  beforeEach(async () => {
    await WhatsappAccount.create({
      userId: '665000000000000000000001',
      userEmail: 'owner@example.com',
      phoneNumberId: PHONE_NUMBER_ID,
      wabaId: '999888777',
      displayPhoneNumber: '+56 9 1111 2222',
      accountName: 'Test WhatsApp',
      accessToken: 'test-wa-token',
      isActive: true
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function account() {
    const resolved = await whatsappAdapter.getAccount(PHONE_NUMBER_ID);
    if (!resolved) throw new Error('account fixture missing');
    return resolved;
  }

  const openConversation = () => ({ timestamps: { lastInboundAt: new Date() } });

  it('sends and returns the wamid', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.SENT001' }]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await whatsappAdapter.sendText({
      account: await account(),
      contact: { waId: '56912345678' },
      conversation: openConversation(),
      text: 'Hola'
    });

    expect(result.externalId).toBe('wamid.SENT001');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/${PHONE_NUMBER_ID}/messages`);
    const body = JSON.parse(init.body);
    expect(body.messaging_product).toBe('whatsapp');
    expect(body.to).toBe('56912345678');
    expect(body.text.body).toBe('Hola');
    // Link previews would render unreviewed cards on AI-written copy.
    expect(body.text.preview_url).toBe(false);
  });

  it('refuses to send outside the 24h window without calling Meta', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const stale = { timestamps: { lastInboundAt: new Date(Date.now() - (SERVICE_WINDOW_MS + 60_000)) } };

    await expect(
      whatsappAdapter.sendText({
        account: await account(),
        contact: { waId: '56912345678' },
        conversation: stale,
        text: 'Hola'
      })
    ).rejects.toMatchObject({ permanent: true, code: 'window_closed' });

    // A rejected send counts against the number's quality rating — never fire it.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails permanently when the contact has no wa_id', async () => {
    await expect(
      whatsappAdapter.sendText({
        account: await account(),
        contact: {},
        conversation: openConversation(),
        text: 'Hola'
      })
    ).rejects.toMatchObject({ permanent: true, code: 'no_recipient' });
  });

  it('marks a 24h-window rejection from Meta as permanent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 131047, message: 'Re-engagement message' } })
    }));

    await expect(
      whatsappAdapter.sendText({
        account: await account(),
        contact: { waId: '56912345678' },
        conversation: openConversation(),
        text: 'Hola'
      })
    ).rejects.toMatchObject({ permanent: true });
  });

  it('marks a rate-limit style error as retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { code: 130429, message: 'Rate limit hit' } })
    }));

    const error = await whatsappAdapter
      .sendText({
        account: await account(),
        contact: { waId: '56912345678' },
        conversation: openConversation(),
        text: 'Hola'
      })
      .catch(e => e);

    expect(error).toBeInstanceOf(ChannelSendError);
    expect(error.permanent).toBe(false);
  });

  it('marks an expired token as retryable with an auth code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 190, message: 'Access token has expired' } })
    }));

    const error = await whatsappAdapter
      .sendText({
        account: await account(),
        contact: { waId: '56912345678' },
        conversation: openConversation(),
        text: 'Hola'
      })
      .catch(e => e);

    expect(error.permanent).toBe(false);
    expect(error.code).toBe('auth');
  });

  it('treats a network failure as retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

    const error = await whatsappAdapter
      .sendText({
        account: await account(),
        contact: { waId: '56912345678' },
        conversation: openConversation(),
        text: 'Hola'
      })
      .catch(e => e);

    expect(error.permanent).toBe(false);
    expect(error.code).toBe('network');
  });

  it('returns null for an unknown or inactive account', async () => {
    expect(await whatsappAdapter.getAccount('does-not-exist')).toBeNull();

    await WhatsappAccount.updateOne({ phoneNumberId: PHONE_NUMBER_ID }, { isActive: false });
    expect(await whatsappAdapter.getAccount(PHONE_NUMBER_ID)).toBeNull();
  });

  it('writes the wamid to its own metadata slot', () => {
    const update = whatsappAdapter.buildSentUpdate('wamid.X');
    expect(update['metadata.whatsappResponse.messageId']).toBe('wamid.X');
    // Must never touch the Instagram slot.
    expect(update['metadata.instagramResponse.messageId']).toBeUndefined();
  });
});

describe('InstagramAdapter', () => {
  beforeEach(async () => {
    await InstagramAccount.create({
      userId: '665000000000000000000001',
      userEmail: 'owner@example.com',
      accountId: IG_ACCOUNT_ID,
      pageScopedId: IG_ACCOUNT_ID,
      accountName: 'moca_test',
      accessToken: 'test-token',
      tokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
      isActive: true
    });
  });

  it('projects the account onto the shared shape with its rate limits', async () => {
    const account = await instagramAdapter.getAccount(IG_ACCOUNT_ID);
    expect(account?.accountId).toBe(IG_ACCOUNT_ID);
    expect(account?.accountName).toBe('moca_test');
    expect(account?.rateLimits.messagesPerSecond).toBe(3);
  });

  it('fails permanently when the contact has no PSID', async () => {
    const account = await instagramAdapter.getAccount(IG_ACCOUNT_ID);
    await expect(
      instagramAdapter.sendText({ account: account!, contact: {}, conversation: null, text: 'hi' })
    ).rejects.toMatchObject({ permanent: true, code: 'no_recipient' });
  });

  it('writes the message_id to its own metadata slot', () => {
    const update = instagramAdapter.buildSentUpdate('mid.ABC');
    expect(update['metadata.instagramResponse.messageId']).toBe('mid.ABC');
    expect(update['metadata.whatsappResponse.messageId']).toBeUndefined();
  });

  it('returns an empty update when there is no external id', () => {
    expect(instagramAdapter.buildSentUpdate(undefined)).toEqual({});
  });
});
