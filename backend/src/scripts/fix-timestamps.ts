/**
 * R2.6: One-time migration script to fix corrupted timestamps in conversations.
 *
 * Problem: Some `lastActivity` (and other timestamp) fields show years like `+058244`
 * because a Unix timestamp in milliseconds was treated as seconds (or vice versa).
 *
 * Fix: Find conversations with year > 2100 and divide the timestamp by 1000.
 *
 * Usage: npx tsx src/scripts/fix-timestamps.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Conversation from '../models/conversation.model';

const MAX_VALID_YEAR = 2100;
const TIMESTAMP_FIELDS = [
  'timestamps.createdAt',
  'timestamps.lastUserMessage',
  'timestamps.lastBotMessage',
  'timestamps.lastActivity'
] as const;

async function fixTimestamps(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const maxValidDate = new Date(`${MAX_VALID_YEAR}-01-01`);

  let totalFixed = 0;

  for (const field of TIMESTAMP_FIELDS) {
    const query = { [field]: { $gt: maxValidDate } };
    const conversations = await Conversation.find(query);

    console.log(`Found ${conversations.length} conversations with corrupted ${field}`);

    for (const conv of conversations) {
      const parts = field.split('.');
      const parent = parts[0] as 'timestamps';
      const child = parts[1] as 'createdAt' | 'lastUserMessage' | 'lastBotMessage' | 'lastActivity';
      const badDate = (conv as any)[parent]?.[child] as Date | undefined;

      if (!badDate) continue;

      const corrected = new Date(badDate.getTime() / 1000);
      if (corrected.getFullYear() >= 2020 && corrected.getFullYear() <= MAX_VALID_YEAR) {
        (conv as any)[parent][child] = corrected;
        console.log(`  Fixed ${conv._id} ${field}: ${badDate.toISOString()} -> ${corrected.toISOString()}`);
        totalFixed++;
      } else {
        // If dividing by 1000 still doesn't give a valid date, set to now
        (conv as any)[parent][child] = new Date();
        console.log(`  Reset ${conv._id} ${field}: ${badDate.toISOString()} -> now (could not recover)`);
        totalFixed++;
      }

      // Use markModified to ensure Mongoose detects the change on nested paths
      conv.markModified(field);
      await conv.save();
    }
  }

  console.log(`\nDone. Fixed ${totalFixed} timestamp values.`);
  await mongoose.disconnect();
}

fixTimestamps().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
