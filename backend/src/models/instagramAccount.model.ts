import mongoose, { Document, Schema } from 'mongoose';

// Rate limiting configuration sub-schema
const RateLimitsSchema = new Schema({
  messagesPerSecond: { type: Number, default: 3 }, // Global rate limit
  userCooldown: { type: Number, default: 3 }, // Seconds between responses to same user
  debounceWindow: { type: Number, default: 4000 }, // Milliseconds to consolidate messages
  maxRetries: { type: Number, default: 3 }, // Maximum retry attempts for failed messages
  retryBackoffMs: { type: Number, default: 1000 } // Base backoff time in milliseconds
});

// Instagram API settings sub-schema
const InstagramSettingsSchema = new Schema({
  autoRespond: { type: Boolean, default: true }, // Enable/disable auto-responses
  aiEnabled: { type: Boolean, default: true }, // Use AI for responses
  fallbackRules: [{ type: String }], // Simple response rules when AI unavailable
  defaultResponse: { type: String, default: "Thanks for your message! I'll get back to you soon." },
  systemPrompt: { type: String, default: "You are a helpful customer service assistant for a business. Respond to customer inquiries professionally and helpfully." },
  toneOfVoice: { type: String, default: "professional", enum: ['professional', 'friendly', 'casual'] },
  keyInformation: { type: String, default: "" },
  businessHours: {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: "09:00" },
    endTime: { type: String, default: "18:00" },
    timezone: { type: String, default: "America/Santiago" }
  },
  defaultMilestone: {
    target: { 
      type: String, 
      enum: ['link_shared', 'meeting_scheduled', 'demo_booked', 'custom'], 
      required: false 
    },
    customTarget: { type: String, required: false },
    autoDisableAgent: { type: Boolean, default: true }
  }
});

// Webhook configuration sub-schema
const WebhookConfigSchema = new Schema({
  verifyToken: { type: String, required: true },
  webhookSecret: { type: String, required: false },
  isActive: { type: Boolean, default: true },
  lastVerified: { type: Date, default: Date.now }
});

export interface IInstagramAccount extends Document {
  id: string;
  userId: string; // Moca user ID (links to User model)
  userEmail: string; // User email for quick access
  accountId: string; // Instagram Business Account ID
  pageScopedId?: string; // Instagram Page-Scoped ID (for webhook matching)
  accountName: string; // Instagram username
  accessToken: string; // Instagram Graph API token
  refreshToken?: string; // For token refresh
  tokenExpiry: Date; // Token expiration
  tokenType: string; // Usually 'Bearer'
  scope: string; // API permissions scope
  rateLimits: {
    messagesPerSecond: number;
    userCooldown: number;
    debounceWindow: number;
    maxRetries: number;
    retryBackoffMs: number;
  };
  settings: {
    autoRespond: boolean;
    aiEnabled: boolean;
    fallbackRules: string[];
    defaultResponse: string;
    systemPrompt: string;
    toneOfVoice: 'professional' | 'friendly' | 'casual';
    keyInformation: string;
    businessHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      timezone: string;
    };
    defaultMilestone?: {
      target?: 'link_shared' | 'meeting_scheduled' | 'demo_booked' | 'custom';
      customTarget?: string;
      autoDisableAgent: boolean;
    };
  };
  webhook: {
    verifyToken: string;
    webhookSecret?: string;
    isActive: boolean;
    lastVerified: Date;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    lastSync: Date;
    messageCount: number;
    responseCount: number;
    errorCount: number;
  };
  isActive: boolean;
}

const InstagramAccountSchema = new Schema<IInstagramAccount>({
  userId: { type: String, required: true },
  userEmail: { type: String, required: true },
  accountId: { type: String, required: true, unique: true },
  pageScopedId: { type: String, required: false },
  accountName: { type: String, required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: false },
  tokenExpiry: { type: Date, required: true },
  tokenType: { type: String, default: 'Bearer' },
  scope: { type: String, default: 'instagram_basic,instagram_content_publish,pages_show_list' },
  rateLimits: { type: RateLimitsSchema, default: () => ({}) },
  settings: { type: InstagramSettingsSchema, default: () => ({}) },
  webhook: { type: WebhookConfigSchema, required: true },
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastSync: { type: Date, default: Date.now },
    messageCount: { type: Number, default: 0 },
    responseCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
InstagramAccountSchema.index({ userId: 1 });
InstagramAccountSchema.index({ userEmail: 1 });
InstagramAccountSchema.index({ accountName: 1 });
InstagramAccountSchema.index({ isActive: 1 });
InstagramAccountSchema.index({ 'metadata.lastSync': 1 });

// Pre-save middleware to update metadata
InstagramAccountSchema.pre('save', function(next) {
  this.metadata.updatedAt = new Date();
  next();
});

// Virtual for token status
InstagramAccountSchema.virtual('isTokenValid').get(function() {
  return this.tokenExpiry > new Date();
});

// Virtual for token expiry in seconds
InstagramAccountSchema.virtual('tokenExpirySeconds').get(function() {
  return Math.floor((this.tokenExpiry.getTime() - Date.now()) / 1000);
});

export default mongoose.model<IInstagramAccount>('InstagramAccount', InstagramAccountSchema);
