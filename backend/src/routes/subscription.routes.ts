import express, { Request, Response } from 'express';
import { Subscription } from '../models';
import { authenticateToken } from '../middleware/auth';
import { MOCA_PLANS, TRIAL_DAYS } from '../config/subscription.config';

const router = express.Router();

// Get current subscription status
router.get('/api/subscription', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const accountId = req.query.accountId as string;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'accountId query parameter is required'
      });
    }

    const subscription = await Subscription.findOne({ userId, accountId }).lean();

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    // Check if subscription has expired
    if (subscription.status === 'active' && new Date() > subscription.currentPeriodEnd) {
      await Subscription.updateOne(
        { _id: subscription._id },
        { status: 'expired' }
      );
      subscription.status = 'expired';
    }

    res.json({
      success: true,
      data: subscription
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription'
    });
  }
});

// Get available plans
router.get('/api/subscription/plans', async (req: Request, res: Response) => {
  try {
    const plans = Object.values(MOCA_PLANS);
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plans'
    });
  }
});

// Get current usage vs limits
router.get('/api/subscription/usage', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const accountId = req.query.accountId as string;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'accountId query parameter is required'
      });
    }

    const subscription = await Subscription.findOne({ userId, accountId }).lean();

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    // Get usage data for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Count messages sent today
    const messageCount = 0; // TODO: Implement actual message counting from Message model

    const limits = subscription.features;

    res.json({
      success: true,
      data: {
        plan: subscription.plan,
        limits,
        usage: {
          messagestoday: messageCount,
          messageLimit: limits.maxMessagesPerDay === -1 ? 'unlimited' : limits.maxMessagesPerDay
        }
      }
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage'
    });
  }
});

// Create checkout (stub for MercadoPago)
router.post('/api/subscription/checkout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { accountId, planId } = req.body;

    if (!accountId || !planId) {
      return res.status(400).json({
        success: false,
        error: 'accountId and planId are required'
      });
    }

    const plan = MOCA_PLANS[planId as keyof typeof MOCA_PLANS];
    if (!plan) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan ID'
      });
    }

    // TODO: Integrate with MercadoPago SDK when available
    // For now, return a stub response
    res.json({
      success: true,
      message: 'Checkout preference would be created with MercadoPago',
      data: {
        planId,
        amount: plan.monthlyAmount,
        currency: plan.currency,
        checkoutUrl: null // Will be populated by MercadoPago integration
      }
    });
  } catch (error) {
    console.error('Error creating checkout:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout'
    });
  }
});

// Handle payment webhook
router.post('/api/subscription/webhook', async (req: Request, res: Response) => {
  try {
    const { id, type, data } = req.body;

    // TODO: Implement MercadoPago webhook verification
    // This is a stub implementation
    if (type === 'payment.success') {
      // Update subscription status to 'active'
      console.log('Payment received:', data);
    }

    res.json({
      success: true,
      message: 'Webhook processed'
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook'
    });
  }
});

// Cancel subscription
router.post('/api/subscription/cancel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'accountId is required'
      });
    }

    const subscription = await Subscription.findOneAndUpdate(
      { userId, accountId },
      {
        status: 'cancelled',
        cancelledAt: new Date()
      },
      { new: true }
    );

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: subscription
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
});

export default router;
