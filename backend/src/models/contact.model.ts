import mongoose, { Document, Schema } from 'mongoose';

// Instagram data sub-schema
const InstagramDataSchema = new Schema({
  username: { type: String, required: false }, // Instagram username
  lastFetched: { type: Date, default: Date.now } // When we last fetched this data
});

// Contact metadata sub-schema
const ContactMetadataSchema = new Schema({
  lastSeen: { type: Date, default: Date.now },
  messageCount: { type: Number, default: 0 },
  instagramData: { type: InstagramDataSchema, required: false } // Instagram-specific data
});

// Contact preferences sub-schema
const ContactPreferencesSchema = new Schema({
  // Keep empty for now - will be populated by AI context
});

// Business information sub-schema
const BusinessInfoSchema = new Schema({
  sector: { type: String, required: false }, // Business sector
  company: { type: String, required: false } // Company name
});

export interface IContact extends Document {
  id: string;
  psid?: string; // Instagram PSID (unique identifier for Instagram contacts)
  email?: string; // Contact email (unique identifier for Gmail contacts)
  phone?: string; // Contact phone number (extracted from messages)
  /**
   * WhatsApp id as Meta reports it (`contacts[].wa_id` / `messages[].from`) —
   * digits only, no '+'. This is the send target for the Cloud API, and it is
   * NOT the same thing as `phone`: `phone` is a free-text number harvested from
   * message bodies by the contact extractor, while waId is Meta-authoritative.
   * Keeping them apart is what stops an extracted typo from redirecting a send.
   */
  waId?: string;
  channel?: 'instagram' | 'gmail' | 'whatsapp'; // Channel source
  name?: string; // Display name
  lastActivity: Date; // Last interaction timestamp
  metadata: {
    lastSeen: Date;
    messageCount: number;
    instagramData?: {
      username?: string;
      lastFetched: Date;
    };
  };
  preferences: any; // Flexible object for AI context
  businessInfo: {
    sector?: string;
    company?: string;
  };
}

const ContactSchema = new Schema<IContact>({
  psid: { type: String, required: false, sparse: true },
  email: { type: String, required: false, sparse: true },
  phone: { type: String, required: false },
  waId: { type: String, required: false, sparse: true },
  channel: { 
    type: String, 
    enum: ['instagram', 'gmail', 'whatsapp'], 
    required: false 
  },
  name: { type: String, required: false },
  metadata: { type: ContactMetadataSchema, default: () => ({}) },
  preferences: { type: ContactPreferencesSchema, default: () => ({}) },
  businessInfo: { type: BusinessInfoSchema, default: () => ({}) },
  lastActivity: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound unique indexes: one contact per external id per channel. The partial
// filter keeps contacts that lack the id out of the constraint entirely, so a
// Gmail contact with no psid never collides with another one.
//
// Two spec rules are easy to get wrong and both fail *silently* in production —
// Mongoose logs the rejection and the app keeps running, so a "unique" index can
// simply not exist for months:
//
//   1. `sparse` and `partialFilterExpression` cannot both be set. MongoDB
//      rejects the spec outright. partialFilterExpression alone already skips
//      the documents sparse would have skipped.
//   2. partialFilterExpression supports only a small operator subset —
//      $exists / $eq / $gt / $gte / $lt / $lte / $type / $and. `$ne` is NOT
//      allowed. `$type: 'string'` is the right way to say "present and not
//      null", and it is stricter than $exists, which would still match an
//      explicit null.
//
// Ordering matters too: Mongoose builds indexes in series and stops at the
// first rejection, so one bad spec takes out every index declared after it.
// waId goes first because it is the new one — if legacy duplicate psids ever
// block that index from building, WhatsApp uniqueness still gets enforced.
ContactSchema.index({ waId: 1, channel: 1 }, { unique: true, partialFilterExpression: { waId: { $type: 'string' } } });
ContactSchema.index({ psid: 1, channel: 1 }, { unique: true, partialFilterExpression: { psid: { $type: 'string' } } });
ContactSchema.index({ email: 1, channel: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
ContactSchema.index({ channel: 1 });
ContactSchema.index({ 'metadata.lastSeen': -1 });
ContactSchema.index({ 'businessInfo.sector': 1 });

// Pre-save middleware to update metadata
ContactSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  next();
});

// Virtual for days since last activity
ContactSchema.virtual('daysSinceLastActivity').get(function() {
  const now = new Date();
  const lastActivity = this.lastActivity;
  if (!lastActivity) return 0;
  return Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
});

export default mongoose.model<IContact>('Contact', ContactSchema);
