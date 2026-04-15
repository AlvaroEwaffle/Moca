import mongoose from 'mongoose';
import { Subscription } from '../models';

interface IUsageRecord {
  accountId: string;
  userId: string;
  date: Date;
  messageCount: number;
  createdAt: Date;
  _id?: any;
}

// In-memory collection schema (can be replaced with MongoDB model if needed)
const usageSchema = new mongoose.Schema<IUsageRecord>({
  accountId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  date: { type: Date, required: true, index: true },
  messageCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: () => new Date() }
});

// Create or use existing model
const UsageModel: mongoose.Model<IUsageRecord> =
  (mongoose.models.Usage as mongoose.Model<IUsageRecord> | undefined) ||
  mongoose.model<IUsageRecord>('Usage', usageSchema);

/**
 * Track a message usage for an account
 */
export async function trackMessageUsage(accountId: string, userId: string, count: number = 1): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await UsageModel.updateOne(
      { accountId, userId, date: { $gte: today } },
      { $inc: { messageCount: count } },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error tracking message usage:', error);
  }
}

/**
 * Get today's message usage for an account
 */
export async function getTodayUsage(accountId: string, userId: string): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await UsageModel.findOne({
      accountId,
      userId,
      date: { $gte: today }
    }).lean();

    return usage?.messageCount || 0;
  } catch (error) {
    console.error('Error getting today usage:', error);
    return 0;
  }
}

/**
 * Check if account has reached daily message limit
 */
export async function checkMessageLimit(accountId: string, userId: string): Promise<{
  allowed: boolean;
  currentUsage: number;
  limit: number;
}> {
  try {
    const subscription = await Subscription.findOne({ accountId, userId }).lean();

    if (!subscription) {
      return {
        allowed: false,
        currentUsage: 0,
        limit: 0
      };
    }

    const limit = subscription.features.maxMessagesPerDay;
    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        currentUsage: 0,
        limit: -1
      };
    }

    const currentUsage = await getTodayUsage(accountId, userId);

    return {
      allowed: currentUsage < limit,
      currentUsage,
      limit
    };
  } catch (error) {
    console.error('Error checking message limit:', error);
    return {
      allowed: false,
      currentUsage: 0,
      limit: 0
    };
  }
}

/**
 * Get usage statistics for a period
 */
export async function getUsageStats(
  accountId: string,
  userId: string,
  fromDate: Date,
  toDate: Date
): Promise<{ date: string; count: number }[]> {
  try {
    const stats = await UsageModel.find({
      accountId,
      userId,
      date: { $gte: fromDate, $lte: toDate }
    })
      .sort({ date: 1 })
      .lean();

    return stats.map(stat => ({
      date: stat.date.toISOString().split('T')[0],
      count: stat.messageCount
    }));
  } catch (error) {
    console.error('Error getting usage stats:', error);
    return [];
  }
}
