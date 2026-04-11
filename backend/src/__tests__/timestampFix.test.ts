import { describe, it, expect } from 'vitest';
import Conversation from '../models/conversation.model';
import Contact from '../models/contact.model';

describe('Timestamp Fix (R2.6)', () => {
  it('auto-corrects corrupted timestamps on save (year > 2100)', async () => {
    const contact = await Contact.create({
      name: 'Timestamp Test',
      psid: 'psid-ts-1',
      accountId: 'account-ts'
    });

    // Create a conversation with a corrupted timestamp
    // Simulate: a Unix timestamp in milliseconds (e.g., 1712756400000 = 2024-04-10)
    // being treated as seconds, producing year +056244
    const corruptedTimestamp = new Date(1712756400000 * 1000); // Way in the future

    const conversation = await Conversation.create({
      contactId: contact._id,
      accountId: 'account-ts',
      timestamps: {
        createdAt: new Date(),
        lastUserMessage: corruptedTimestamp,
        lastBotMessage: new Date(),
        lastActivity: corruptedTimestamp
      }
    });

    // Trigger a save (pre-save hook should fix it)
    const loaded = await Conversation.findById(conversation._id);
    expect(loaded).not.toBeNull();

    // The corrupted timestamp should have been fixed during save
    // Since save is called during create, it should already be fixed
    // Let's verify the lastUserMessage is in a reasonable year range
    const lastUserMsgYear = loaded!.timestamps.lastUserMessage.getFullYear();
    // After division by 1000, the corrected date should be around 2024
    expect(lastUserMsgYear).toBeLessThanOrEqual(2100);
    expect(lastUserMsgYear).toBeGreaterThanOrEqual(2020);
  });

  it('does not modify valid timestamps', async () => {
    const contact = await Contact.create({
      name: 'Valid Timestamp Test',
      psid: 'psid-ts-2',
      accountId: 'account-ts'
    });

    const validDate = new Date('2026-04-10T12:00:00Z');

    const conversation = await Conversation.create({
      contactId: contact._id,
      accountId: 'account-ts',
      timestamps: {
        createdAt: validDate,
        lastUserMessage: validDate,
        lastBotMessage: validDate,
        lastActivity: validDate
      }
    });

    const loaded = await Conversation.findById(conversation._id);
    expect(loaded).not.toBeNull();

    // lastActivity gets updated to now() by pre-save hook, but other fields should be preserved
    expect(loaded!.timestamps.lastUserMessage.getFullYear()).toBe(2026);
    expect(loaded!.timestamps.lastBotMessage.getFullYear()).toBe(2026);
  });
});
