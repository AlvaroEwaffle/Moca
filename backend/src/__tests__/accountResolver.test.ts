import { describe, it, expect, beforeEach } from 'vitest';
import InstagramAccount from '../models/instagramAccount.model';
import WhatsappAccount from '../models/whatsappAccount.model';
import { resolveAccount } from '../services/channels/accountResolver';

const IG_ACCOUNT_ID = '17841401675262878';
const PHONE_NUMBER_ID = '111222333444555';

describe('resolveAccount', () => {
  beforeEach(async () => {
    await InstagramAccount.create({
      userId: '665000000000000000000001',
      userEmail: 'owner@example.com',
      accountId: IG_ACCOUNT_ID,
      accountName: 'moca_test',
      accessToken: 'test-token',
      tokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
      isActive: true,
      settings: { aiEnabled: 'on', systemPrompt: 'Sos el agente de Instagram' }
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
      settings: { aiEnabled: 'test', systemPrompt: 'Sos el agente de WhatsApp' }
    });
  });

  it('resolves a WhatsApp account by phoneNumberId', async () => {
    const account = await resolveAccount(PHONE_NUMBER_ID, 'whatsapp');

    expect(account).toBeTruthy();
    expect(account?.channel).toBe('whatsapp');
    expect(account?.accountId).toBe(PHONE_NUMBER_ID);
    expect(account?.accountName).toBe('Test WhatsApp');
    // The agent persona must come from the WhatsApp account, not a blank default.
    expect(account?.settings.systemPrompt).toBe('Sos el agente de WhatsApp');
    expect(account?.settings.aiEnabled).toBe('test');
  });

  it('resolves an Instagram account by accountId', async () => {
    const account = await resolveAccount(IG_ACCOUNT_ID, 'instagram');

    expect(account?.channel).toBe('instagram');
    expect(account?.settings.systemPrompt).toBe('Sos el agente de Instagram');
  });

  it('treats a missing channel as Instagram', async () => {
    const account = await resolveAccount(IG_ACCOUNT_ID, undefined);
    expect(account?.channel).toBe('instagram');
    expect(account?.accountName).toBe('moca_test');
  });

  it('does not find a WhatsApp phoneNumberId in the Instagram collection', async () => {
    // This is the bug the resolver exists to prevent: looking a WhatsApp
    // conversation's accountId up as an Instagram account returns null, and the
    // debounce worker used to read that null as "no account, do not answer".
    expect(await resolveAccount(PHONE_NUMBER_ID, 'instagram')).toBeNull();
  });

  it('honours activeOnly for both channels', async () => {
    await WhatsappAccount.updateOne({ phoneNumberId: PHONE_NUMBER_ID }, { isActive: false });
    await InstagramAccount.updateOne({ accountId: IG_ACCOUNT_ID }, { isActive: false });

    expect(await resolveAccount(PHONE_NUMBER_ID, 'whatsapp', { activeOnly: true })).toBeNull();
    expect(await resolveAccount(IG_ACCOUNT_ID, 'instagram', { activeOnly: true })).toBeNull();

    // Without activeOnly the account still resolves, so callers can report
    // "account is inactive" rather than "account not found".
    const inactive = await resolveAccount(PHONE_NUMBER_ID, 'whatsapp');
    expect(inactive?.isActive).toBe(false);
  });

  it('returns null for an unknown account id', async () => {
    expect(await resolveAccount('nope', 'whatsapp')).toBeNull();
    expect(await resolveAccount('nope', 'instagram')).toBeNull();
  });

  it('exposes the owner email through raw for both channels', async () => {
    const wa = await resolveAccount(PHONE_NUMBER_ID, 'whatsapp');
    const ig = await resolveAccount(IG_ACCOUNT_ID, 'instagram');
    expect(wa?.raw?.userEmail).toBe('owner@example.com');
    expect(ig?.raw?.userEmail).toBe('owner@example.com');
  });
});
