import { Request, Response, NextFunction } from 'express';
import { Subscription } from '../models';
import type { ISubscription } from '../models/subscription.model';
import { checkMessageLimit as checkUsageMessageLimit } from '../services/usageTracking.service';

type SubscriptionFeature = keyof ISubscription['features'];

/**
 * Middleware to check if subscription is valid and not expired
 */
export async function checkSubscriptionStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const accountId = req.query.accountId as string || req.body.accountId;

    if (!userId || !accountId) {
      return next(); // Let route handle missing params
    }

    const subscription = await Subscription.findOne({ userId, accountId }).lean();

    if (!subscription) {
      return next();
    }

    // Check if subscription is expired
    if (subscription.status === 'active' && new Date() > subscription.currentPeriodEnd) {
      await Subscription.updateOne(
        { _id: subscription._id },
        { status: 'expired' }
      );
      subscription.status = 'expired';
    }

    // Attach subscription to request
    (req as any).subscription = subscription;

    next();
  } catch (error) {
    console.error('Error checking subscription status:', error);
    next(); // Continue even if check fails (don't block)
  }
}

/**
 * Middleware to check message rate limits
 * Returns 402 Payment Required if limit exceeded
 */
export async function checkMessageLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const accountId = req.query.accountId as string || req.body.accountId;

    if (!userId || !accountId) {
      return next();
    }

    const subscription = await Subscription.findOne({ userId, accountId }).lean();

    if (!subscription) {
      return next();
    }

    // Check if subscription is active/trial
    if (!['active', 'trial'].includes(subscription.status)) {
      res.status(402).json({
        success: false,
        error: 'Subscription is not active',
        code: 'SUBSCRIPTION_INACTIVE',
        upgradeUrl: '/pricing'
      });
      return;
    }

    const { allowed, currentUsage, limit } = await checkUsageMessageLimit(accountId, userId);

    if (!allowed && limit !== -1) {
      res.status(402).json({
        success: false,
        error: 'Daily message limit exceeded',
        code: 'LIMIT_EXCEEDED',
        usage: {
          current: currentUsage,
          limit
        },
        upgradeUrl: '/pricing'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error checking message limit:', error);
    next(); // Continue even if check fails
  }
}

/**
 * Middleware to check feature access (customPrompts, analytics, etc)
 */
export function checkFeatureAccess(feature: SubscriptionFeature) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      const accountId = req.query.accountId as string || req.body.accountId;

      if (!userId || !accountId) {
        return next();
      }

      const subscription = await Subscription.findOne({ userId, accountId }).lean();

      if (!subscription) {
        res.status(403).json({
          success: false,
          error: 'Subscription not found'
        });
        return;
      }

      const hasFeature = subscription.features[feature];

      if (!hasFeature) {
        res.status(403).json({
          success: false,
          error: `Feature "${feature}" is not available in your plan`,
          code: 'FEATURE_NOT_AVAILABLE',
          requiredPlan: getPlanForFeature(feature),
          upgradeUrl: '/pricing'
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Error checking feature access:', error);
      next();
    }
  };
}

/**
 * Helper to determine which plan includes a feature
 */
function getPlanForFeature(feature: SubscriptionFeature): string {
  const featureMap: Partial<Record<SubscriptionFeature, string>> = {
    customPrompts: 'starter',
    analytics: 'pro',
    prioritySupport: 'pro'
  };
  return featureMap[feature] || 'pro';
}
