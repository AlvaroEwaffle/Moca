export interface PlanConfig {
  id: string;
  name: string;
  monthlyAmount: number;
  currency: string;
  features: {
    maxAccounts: number;
    maxMessagesPerDay: number;
    aiModel: string;
    customPrompts: boolean;
    analytics: boolean;
    prioritySupport: boolean;
  };
}

export const MOCA_PLANS: Record<string, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free Plan',
    monthlyAmount: 0,
    currency: 'CLP',
    features: {
      maxAccounts: 1,
      maxMessagesPerDay: 50,
      aiModel: 'gpt-3.5-turbo',
      customPrompts: false,
      analytics: false,
      prioritySupport: false
    }
  },
  starter: {
    id: 'starter',
    name: 'Starter Plan',
    monthlyAmount: 49990,
    currency: 'CLP',
    features: {
      maxAccounts: 2,
      maxMessagesPerDay: 200,
      aiModel: 'gpt-4o-mini',
      customPrompts: true,
      analytics: false,
      prioritySupport: false
    }
  },
  pro: {
    id: 'pro',
    name: 'Pro Plan',
    monthlyAmount: 99990,
    currency: 'CLP',
    features: {
      maxAccounts: 5,
      maxMessagesPerDay: -1, // Unlimited
      aiModel: 'gpt-4o',
      customPrompts: true,
      analytics: true,
      prioritySupport: true
    }
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Plan',
    monthlyAmount: 249990,
    currency: 'CLP',
    features: {
      maxAccounts: -1, // Unlimited
      maxMessagesPerDay: -1, // Unlimited
      aiModel: 'gpt-4o',
      customPrompts: true,
      analytics: true,
      prioritySupport: true
    }
  }
};

export const TRIAL_DAYS = 14;
