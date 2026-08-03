import mongoose, { Document, Schema } from 'mongoose';

// Rate limiting configuration sub-schema — mirrors InstagramAccount.rateLimits so
// the sender worker can read rate limits the same way for either channel.
const RateLimitsSchema = new Schema({
  messagesPerSecond: { type: Number, default: 3 },
  userCooldown: { type: Number, default: 3 }, // Seconds between responses to same user
  debounceWindow: { type: Number, default: 4000 }, // Milliseconds to consolidate messages
  maxRetries: { type: Number, default: 3 },
  retryBackoffMs: { type: Number, default: 1000 }
});

// Agent settings sub-schema — same shape as InstagramSettingsSchema so the
// existing AI/debounce/scoring pipeline reads settings channel-agnostically.
const WhatsappSettingsSchema = new Schema({
  autoRespond: { type: Boolean, default: true },
  aiEnabled: { type: String, enum: ['off', 'test', 'on'], default: 'on' },
  defaultAgentEnabled: { type: Boolean, default: false },
  fallbackRules: [{ type: String }],
  defaultResponse: { type: String, default: "Gracias por tu mensaje, te respondo a la brevedad." },
  systemPrompt: { type: String, default: "Eres un asistente comercial. Responde de forma profesional y breve." },
  toneOfVoice: { type: String, default: 'professional', enum: ['professional', 'friendly', 'casual'] },
  keyInformation: { type: String, default: '' },
  businessHours: {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '18:00' },
    timezone: { type: String, default: 'America/Santiago' }
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

export interface IWhatsappAccount extends Document {
  id: string;
  userId: string; // Moca user ID (links to User model)
  userEmail: string; // User email for quick access
  /**
   * Phone Number ID from Meta. This is the canonical account key for the whole
   * pipeline: Conversation/Message/OutboundQueue all store it in `accountId`,
   * exactly like the Instagram accountId. It is also the value Meta sends as
   * `value.metadata.phone_number_id` on inbound webhooks, so routing is a
   * direct lookup with no translation table.
   */
  phoneNumberId: string;
  wabaId: string; // WhatsApp Business Account ID
  displayPhoneNumber: string; // E.164 number as shown by Meta, e.g. "+56912345678"
  accountName: string; // Friendly label ("Ewaffle WhatsApp")
  accessToken: string; // System User token with whatsapp_business_messaging
  tokenExpiry?: Date; // System User tokens can be permanent — optional by design
  /**
   * Per-account webhook verify token. Falls back to WHATSAPP_VERIFY_TOKEN when
   * unset; kept per-account so a second number can be onboarded later without
   * sharing one global secret.
   */
  verifyToken?: string;
  /**
   * Per-account app secret for X-Hub-Signature-256. Falls back to
   * WHATSAPP_APP_SECRET / META_APP_SECRET.
   */
  appSecret?: string;
  settings: {
    autoRespond?: boolean;
    aiEnabled?: 'off' | 'test' | 'on';
    defaultAgentEnabled?: boolean;
    systemPrompt: string;
    toneOfVoice: 'professional' | 'friendly' | 'casual';
    keyInformation: string;
    fallbackRules: string[];
    defaultResponse: string;
    businessHours?: {
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
  rateLimits: {
    messagesPerSecond: number;
    userCooldown: number;
  };
  fidelidappSlug?: string;
  isActive: boolean;
}

const WhatsappAccountSchema = new Schema<IWhatsappAccount>({
  userId: { type: String, required: true },
  userEmail: { type: String, required: true },
  phoneNumberId: { type: String, required: true, unique: true },
  wabaId: { type: String, required: true },
  displayPhoneNumber: { type: String, required: true },
  accountName: { type: String, required: true },
  accessToken: { type: String, required: true },
  tokenExpiry: { type: Date, required: false },
  verifyToken: { type: String, required: false },
  appSecret: { type: String, required: false },
  settings: { type: WhatsappSettingsSchema, default: () => ({}) },
  rateLimits: { type: RateLimitsSchema, default: () => ({}) },
  fidelidappSlug: { type: String, required: false },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

WhatsappAccountSchema.index({ userId: 1 });
WhatsappAccountSchema.index({ userEmail: 1 });
WhatsappAccountSchema.index({ wabaId: 1 });
WhatsappAccountSchema.index({ isActive: 1 });

export default mongoose.model<IWhatsappAccount>('WhatsappAccount', WhatsappAccountSchema);
