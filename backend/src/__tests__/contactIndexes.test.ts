import { describe, it, expect } from 'vitest';
import Contact from '../models/contact.model';

/**
 * These indexes are the uniqueness guarantee for contacts. They are worth a
 * test because a bad spec does not crash the app — Mongoose logs the rejection
 * and carries on, so a "unique" index can be absent in production for months
 * without anyone noticing.
 *
 * Specifically: MongoDB rejects any index declaring both `sparse` and
 * `partialFilterExpression`, and Mongoose builds indexes in series and stops at
 * the first rejection — so one bad spec silently takes out every index after it.
 */
describe('Contact indexes', () => {
  it('builds every declared index, including the unique partial ones', async () => {
    // init() runs ensureIndexes and rejects if any spec is invalid, so simply
    // awaiting it is the assertion — a bad spec fails the test here.
    await Contact.init();

    const indexes = await Contact.collection.indexes();
    const byName = new Map(indexes.map((index: any) => [index.name, index]));

    for (const name of ['psid_1_channel_1', 'email_1_channel_1', 'waId_1_channel_1']) {
      const index = byName.get(name);
      expect(index, `${name} was not created`).toBeTruthy();
      expect(index.unique).toBe(true);
      expect(index.partialFilterExpression).toBeTruthy();
      expect(index.sparse).toBeUndefined(); // mixing the two is a hard rejection
    }
  });

  it('enforces one contact per wa_id on the whatsapp channel', async () => {
    await Contact.init();
    await Contact.create({ waId: '56911112222', channel: 'whatsapp', name: 'Ana' });

    await expect(
      Contact.create({ waId: '56911112222', channel: 'whatsapp', name: 'Ana duplicada' })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('lets Instagram contacts coexist without a waId', async () => {
    await Contact.init();
    await Contact.create({ psid: 'psid-1', channel: 'instagram' });
    // A second waId-less contact must not collide on the partial index.
    await expect(Contact.create({ psid: 'psid-2', channel: 'instagram' })).resolves.toBeTruthy();
  });
});
