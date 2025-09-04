import mongoose, { Document, Schema } from 'mongoose';

// Instagram data sub-schema
const InstagramDataSchema = new Schema({
  username: { type: String, required: false }, // Instagram username
  profilePicture: { type: String, required: false }, // Instagram profile picture URL
  bio: { type: String, required: false }, // Instagram bio
  followersCount: { type: Number, required: false }, // Instagram followers count
  followingCount: { type: Number, required: false }, // Instagram following count
  postsCount: { type: Number, required: false }, // Instagram posts count
  isVerified: { type: Boolean, default: false }, // Instagram verification status
  isPrivate: { type: Boolean, default: false }, // Instagram privacy status
  lastFetched: { type: Date, default: Date.now } // When we last fetched this data
});

// Contact metadata sub-schema
const ContactMetadataSchema = new Schema({
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  messageCount: { type: Number, default: 0 },
  responseCount: { type: Number, default: 0 },
  lastResponseAt: { type: Date, required: false },
  averageResponseTime: { type: Number, default: 0 }, // in seconds
  engagementScore: { type: Number, default: 0 }, // 0-100 score
  source: { type: String, default: 'instagram_dm' }, // How they found us
  referrer: { type: String, required: false }, // If they came from somewhere specific
  instagramData: { type: InstagramDataSchema, required: false } // Instagram-specific data
});

// Contact preferences sub-schema
const ContactPreferencesSchema = new Schema({
  language: { type: String, default: 'es' }, // Preferred language
  timezone: { type: String, default: 'America/Santiago' },
  contactMethod: { type: String, default: 'instagram', enum: ['instagram', 'email', 'phone'] },
  notificationPreferences: {
    marketing: { type: Boolean, default: false },
    updates: { type: Boolean, default: true },
    reminders: { type: Boolean, default: true }
  }
});

// Business information sub-schema
const BusinessInfoSchema = new Schema({
  sector: { type: String, required: false }, // Business sector
  company: { type: String, required: false }, // Company name
  position: { type: String, required: false }, // Job position
  industry: { type: String, required: false }, // Industry type
  budget: { type: String, enum: ['low', 'medium', 'high', 'enterprise'], required: false },
  projectType: { type: String, required: false }, // Type of project they're interested in
  timeline: { type: String, enum: ['asap', '1-3months', '3-6months', '6+months'], required: false }
});

export interface IContact extends Document {
  id: string;
  psid: string; // Instagram PSID (unique identifier)
  name?: string; // Display name
  email?: string; // Contact email
  phone?: string; // Contact phone
  profilePicture?: string; // Instagram profile picture URL
  metadata: {
    firstSeen: Date;
    lastSeen: Date;
    messageCount: number;
    responseCount: number;
    lastResponseAt?: Date;
    averageResponseTime: number;
    engagementScore: number;
    source: string;
    referrer?: string;
    instagramData?: {
      username?: string;
      profilePicture?: string;
      bio?: string;
      followersCount?: number;
      followingCount?: number;
      postsCount?: number;
      isVerified: boolean;
      isPrivate: boolean;
      lastFetched: Date;
    };
  };
  preferences: {
    language: string;
    timezone: string;
    contactMethod: string;
    notificationPreferences: {
      marketing: boolean;
      updates: boolean;
      reminders: boolean;
    };
  };
  businessInfo: {
    sector?: string;
    company?: string;
    position?: string;
    industry?: string;
    budget?: string;
    projectType?: string;
    timeline?: string;
  };
  tags: string[]; // Custom tags for categorization
  notes: string[]; // Internal notes about the contact
  status: 'active' | 'inactive' | 'blocked' | 'converted'; // Contact status
  assignedTo?: string; // Team member assigned to this contact
  lastActivity: Date; // Last interaction timestamp
  isQualified: boolean; // Whether they're a qualified lead
  qualificationScore: number; // 0-100 qualification score
}

const ContactSchema = new Schema<IContact>({
  psid: { type: String, required: true, unique: true },
  name: { type: String, required: false },
  email: { type: String, required: false },
  phone: { type: String, required: false },
  profilePicture: { type: String, required: false },
  metadata: { type: ContactMetadataSchema, default: () => ({}) },
  preferences: { type: ContactPreferencesSchema, default: () => ({}) },
  businessInfo: { type: BusinessInfoSchema, default: () => ({}) },
  tags: [{ type: String }],
  notes: [{ type: String }],
  status: { type: String, enum: ['active', 'inactive', 'blocked', 'converted'], default: 'active' },
  assignedTo: { type: String, required: false },
  lastActivity: { type: Date, default: Date.now },
  isQualified: { type: Boolean, default: false },
  qualificationScore: { type: Number, default: 0, min: 0, max: 100 }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
ContactSchema.index({ status: 1 });
ContactSchema.index({ 'metadata.lastSeen': -1 });
ContactSchema.index({ 'metadata.engagementScore': -1 });
ContactSchema.index({ tags: 1 });
ContactSchema.index({ assignedTo: 1 });
ContactSchema.index({ isQualified: 1 });
ContactSchema.index({ 'businessInfo.sector': 1 });
ContactSchema.index({ 'businessInfo.budget': 1 });

// Pre-save middleware to update metadata
ContactSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  if (this.isModified('metadata.messageCount') || this.isModified('metadata.responseCount')) {
    // Update engagement score based on activity
    const messageRatio = this.metadata.responseCount / Math.max(this.metadata.messageCount, 1);
    this.metadata.engagementScore = Math.min(100, Math.round(messageRatio * 100));
  }
  next();
});

// Virtual for days since first contact
ContactSchema.virtual('daysSinceFirstContact').get(function() {
  const now = new Date();
  const firstSeen = this.metadata.firstSeen;
  return Math.floor((now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual for days since last activity
ContactSchema.virtual('daysSinceLastActivity').get(function() {
  const now = new Date();
  const lastActivity = this.lastActivity;
  return Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual for response rate
ContactSchema.virtual('responseRate').get(function() {
  if (this.metadata.messageCount === 0) return 0;
  return Math.round((this.metadata.responseCount / this.metadata.messageCount) * 100);
});

// Static method to find contacts by tag
ContactSchema.statics.findByTag = function(tag: string) {
  return this.find({ tags: tag });
};

// Static method to find qualified leads
ContactSchema.statics.findQualifiedLeads = function(minScore: number = 70) {
  return this.find({ 
    isQualified: true, 
    qualificationScore: { $gte: minScore },
    status: { $ne: 'converted' }
  });
};

export default mongoose.model<IContact>('Contact', ContactSchema);
