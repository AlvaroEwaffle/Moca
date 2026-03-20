/**
 * One-time migration: fix orphaned conversations after accountId changed on re-auth.
 *
 * What happened: OAuth re-auth updated InstagramAccount.accountId from the old value
 * (e.g. appScopedId) to the canonical IG_ID, but conversations/messages/etc. still
 * reference the old accountId string.
 *
 * This script:
 * 1. Finds all unique accountIds referenced by conversations
 * 2. Checks which ones don't match any InstagramAccount.accountId
 * 3. For each orphaned accountId, tries to match by username/appScopedId
 * 4. Updates all related documents to use the correct accountId
 *
 * Usage: npx ts-node scripts/fix-orphaned-conversations.ts
 * Add --dry-run to preview changes without writing.
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
// Import models directly (not via barrel) to avoid transitive config/startup assertions
import Conversation from '../src/models/conversation.model';
import Message from '../src/models/message.model';
import OutboundQueue from '../src/models/outboundQueue.model';
import InstagramComment from '../src/models/instagramComment.model';
import LeadFollowUp from '../src/models/leadFollowUp.model';
import FollowUpConfig from '../src/models/followUpConfig.model';
import InstagramAccount from '../src/models/instagramAccount.model';
import KeywordActivationRule from '../src/models/keywordActivationRule.model';
import CommentAutoReplyRule from '../src/models/commentAutoReplyRule.model';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  // 1. Get all unique accountIds from conversations
  const conversationAccountIds: string[] = await Conversation.distinct('accountId');
  console.log(`📊 Found ${conversationAccountIds.length} unique accountIds in conversations`);

  // 2. Get all valid accountIds from InstagramAccount
  const accounts = await InstagramAccount.find({}).select('accountId appScopedId accountName userId').lean();
  const validAccountIds = new Set(accounts.map(a => a.accountId));
  console.log(`📊 Found ${accounts.length} Instagram accounts with valid accountIds`);

  // 3. Find orphaned accountIds
  const orphanedIds = conversationAccountIds.filter(id => !validAccountIds.has(id));

  if (orphanedIds.length === 0) {
    console.log('✅ No orphaned conversations found. All accountIds match an existing account.');
    await mongoose.disconnect();
    return;
  }

  console.log(`⚠️  Found ${orphanedIds.length} orphaned accountId(s):`, orphanedIds);

  // 4. For each orphaned ID, try to find which account it belongs to
  for (const orphanedId of orphanedIds) {
    // Try matching by appScopedId or alternateRecipientIds
    const matchedAccount = accounts.find(
      a => a.appScopedId === orphanedId || (a as any).alternateRecipientIds?.includes(orphanedId)
    );

    if (!matchedAccount) {
      console.log(`❓ Could not find a matching account for orphaned accountId: ${orphanedId}`);
      console.log(`   Conversations with this accountId:`);
      const orphanedConvos = await Conversation.find({ accountId: orphanedId })
        .select('contactId createdAt')
        .lean();
      console.log(`   ${orphanedConvos.length} conversations`);
      continue;
    }

    const newAccountId = matchedAccount.accountId;
    console.log(`🔗 Orphaned accountId ${orphanedId} → matches account "${matchedAccount.accountName}" (${newAccountId})`);

    const convCount = await Conversation.countDocuments({ accountId: orphanedId });
    const msgCount = await Message.countDocuments({ accountId: orphanedId });
    console.log(`   ${convCount} conversations, ${msgCount} messages to migrate`);

    if (DRY_RUN) {
      console.log(`   [DRY RUN] Would update all documents from ${orphanedId} → ${newAccountId}`);
      continue;
    }

    // Migrate core documents (no unique constraints that would conflict)
    const coreResults = await Promise.all([
      Conversation.updateMany({ accountId: orphanedId }, { $set: { accountId: newAccountId } }),
      Message.updateMany({ accountId: orphanedId }, { $set: { accountId: newAccountId } }),
      OutboundQueue.updateMany({ accountId: orphanedId }, { $set: { accountId: newAccountId } }),
      InstagramComment.updateMany({ accountId: orphanedId }, { $set: { accountId: newAccountId } }),
      LeadFollowUp.updateMany({ accountId: orphanedId }, { $set: { accountId: newAccountId } }),
    ]);

    // For collections with unique compound indexes on accountId, delete stale copies
    // rather than updating (the new accountId already has current versions).
    const delFollowUp = await FollowUpConfig.deleteMany({ accountId: orphanedId });
    const delKeyword = await KeywordActivationRule.deleteMany({ accountId: orphanedId });
    const delComment = await CommentAutoReplyRule.deleteMany({ accountId: orphanedId });

    const totalMigrated = coreResults.reduce((sum, r) => sum + r.modifiedCount, 0);
    const totalDeleted = delFollowUp.deletedCount + delKeyword.deletedCount + delComment.deletedCount;
    console.log(`   ✅ Migrated ${totalMigrated} documents: ${orphanedId} → ${newAccountId}`);
    if (totalDeleted) {
      console.log(`   🗑️  Deleted ${totalDeleted} stale config docs (follow-up: ${delFollowUp.deletedCount}, keyword rules: ${delKeyword.deletedCount}, comment rules: ${delComment.deletedCount})`);
    }
  }

  await mongoose.disconnect();
  console.log('✅ Done');
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
