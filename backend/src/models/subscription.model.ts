import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscription extends Document {
  accountId: string;
  userId: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date;
  cancelledAt?: Date;
  paymentProvider: 'mercadopago' | 'stripe' | null;
  externalSubscriptionId?: string;
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
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>({
  accountId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  plan: {
    type: String,
    enum: ['free', 'starter', 'pro', 'enterprise'],
    default: 'free'
  },
  status: {
    type: String,
    enum: ['trial', 'active', 'past_due', 'cancelled', 'expired'],
    default: 'trial'
  },
  currentPeriodStart: { type: Date, default: () => new Date() },
  currentPeriodEnd: { type: Date, required: true },
  trialEndsAt: { type: Date },
  cancelledAt: { type: Date },
  paymentProvider: {
    type: String,
    enum: ['mercadopago', 'stripe', null],
    default: null
  },
  externalSubscriptionId: { type: String },
  monthlyAmount: { type: Number, default: 0 },
  currency: { type: String, default: 'CLP' },
  features: {
    maxAccounts: { type: Number, required: true },
    maxMessagesPerDay: { type: Number, required: true },
    aiModel: { type: String, required: true },
    customPrompts: { type: Boolean, default: false },
    analytics: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Indexes
SubscriptionSchema.index({ userId: 1, accountId: 1 });
SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ currentPeriodEnd: 1 });

export default mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
