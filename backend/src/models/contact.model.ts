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

// Compound unique indexes: psid is unique per channel (only for Instagram), email is unique per channel (only for Gmail)
// This prevents duplicate key errors when psid is null for Gmail contacts
ContactSchema.index({ psid: 1, channel: 1 }, { unique: true, sparse: true, partialFilterExpression: { psid: { $exists: true, $ne: null } } });
ContactSchema.index({ email: 1, channel: 1 }, { unique: true, sparse: true, partialFilterExpression: { email: { $exists: true, $ne: null } } });
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
