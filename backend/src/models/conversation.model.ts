import mongoose, { Document, Schema } from 'mongoose';

// Conversation timestamps sub-schema
const ConversationTimestampsSchema = new Schema({
  createdAt: { type: Date, default: Date.now },
  lastUserMessage: { type: Date, default: Date.now },
  lastBotMessage: { type: Date, default: Date.now },
  cooldownUntil: { type: Date, required: false }, // When bot can respond again
  lastActivity: { type: Date, default: Date.now },
  closedAt: { type: Date, required: false }
});

// Conversation context sub-schema
const ConversationContextSchema = new Schema({
  topic: { type: String, required: false }, // Main conversation topic
  intent: { type: String, required: false }, // User's intent (inquiry, complaint, etc.)
  sentiment: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' },
  urgency: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  category: { type: String, required: false }, // Business category
  keywords: [{ type: String }], // Important keywords from conversation
  language: { type: String, default: 'es' }, // Conversation language
  timezone: { type: String, default: 'America/Santiago' }
});

// Conversation metrics sub-schema
const ConversationMetricsSchema = new Schema({
  totalMessages: { type: Number, default: 0 },
  userMessages: { type: Number, default: 0 },
  botMessages: { type: Number, default: 0 },
  averageResponseTime: { type: Number, default: 0 }, // Average bot response time in seconds
  responseRate: { type: Number, default: 0 }, // Percentage of user messages that got responses
  engagementScore: { type: Number, default: 0 }, // 0-100 engagement score
  satisfactionScore: { type: Number, default: 0 }, // 0-100 satisfaction score (if available)
  conversionProbability: { type: Number, default: 0 } // 0-100 conversion probability
});

// Conversation settings sub-schema
const ConversationSettingsSchema = new Schema({
  autoRespond: { type: Boolean, default: true }, // Whether auto-respond is enabled
  aiEnabled: { type: Boolean, default: true }, // Whether AI responses are enabled
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  assignedAgent: { type: String, required: false }, // Human agent assigned to conversation
  tags: [{ type: String }], // Custom tags for categorization
  notes: [{ type: String }], // Internal notes about the conversation
  followUpRequired: { type: Boolean, default: false }, // Whether follow-up is needed
  followUpDate: { type: Date, required: false }, // When to follow up
  businessHoursOnly: { type: Boolean, default: false } // Only respond during business hours
});

export interface IConversation extends Document {
  id: string;
  contactId: string | any; // Reference to Contact (ObjectId or populated object)
  accountId: string; // Reference to InstagramAccount
  status: 'open' | 'scheduled' | 'closed' | 'archived';
  timestamps: {
    createdAt: Date;
    lastUserMessage: Date;
    lastBotMessage: Date;
    cooldownUntil?: Date;
    lastActivity: Date;
    closedAt?: Date;
  };
  context: {
    topic?: string;
    intent?: string;
    sentiment: string;
    urgency: string;
    category?: string;
    keywords: string[];
    language: string;
    timezone: string;
  };
  metrics: {
    totalMessages: number;
    userMessages: number;
    botMessages: number;
    averageResponseTime: number;
    responseRate: number;
    engagementScore: number;
    satisfactionScore: number;
    conversionProbability: number;
  };
  settings: {
    autoRespond: boolean;
    aiEnabled: boolean;
    priority: string;
    assignedAgent?: string;
    tags: string[];
    notes: string[];
    followUpRequired: boolean;
    followUpDate?: Date;
    businessHoursOnly: boolean;
  };
  isActive: boolean; // Whether conversation is currently active
  lastMessageId?: string; // ID of the last message in the conversation
  messageCount: number; // Total number of messages
  unreadCount: number; // Number of unread messages
}

const ConversationSchema = new Schema<IConversation>({
  contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  accountId: { type: String, required: true },
  status: { type: String, enum: ['open', 'scheduled', 'closed', 'archived'], default: 'open' },
  timestamps: { type: ConversationTimestampsSchema, default: () => ({}) },
  context: { type: ConversationContextSchema, default: () => ({}) },
  metrics: { type: ConversationMetricsSchema, default: () => ({}) },
  settings: { type: ConversationSettingsSchema, default: () => ({}) },
  isActive: { type: Boolean, default: true },
  lastMessageId: { type: String, required: false },
  messageCount: { type: Number, default: 0 },
  unreadCount: { type: Number, default: 0 }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
ConversationSchema.index({ contactId: 1 });
ConversationSchema.index({ accountId: 1 });
ConversationSchema.index({ status: 1 });
ConversationSchema.index({ 'timestamps.lastActivity': -1 });
ConversationSchema.index({ 'timestamps.createdAt': -1 });
ConversationSchema.index({ 'settings.priority': 1 });
ConversationSchema.index({ 'settings.assignedAgent': 1 });
ConversationSchema.index({ 'context.urgency': 1 });
ConversationSchema.index({ 'context.sentiment': 1 });
ConversationSchema.index({ isActive: 1 });

// Pre-save middleware to update timestamps and metrics
ConversationSchema.pre('save', function(next) {
  this.timestamps.lastActivity = new Date();
  
  // Update metrics if message count changed
  if (this.isModified('messageCount')) {
    this.metrics.totalMessages = this.messageCount;
    this.metrics.responseRate = this.metrics.userMessages > 0 
      ? Math.round((this.metrics.botMessages / this.metrics.userMessages) * 100)
      : 0;
  }
  
  // Update status based on activity
  if (this.isModified('timestamps.lastActivity')) {
    const daysSinceLastActivity = Math.floor(
      (Date.now() - this.timestamps.lastActivity.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceLastActivity > 30 && this.status === 'open') {
      this.status = 'closed';
      this.timestamps.closedAt = new Date();
    }
  }
  
  next();
});

// Virtual for conversation duration
ConversationSchema.virtual('duration').get(function() {
  const now = this.status === 'closed' && this.timestamps.closedAt 
    ? this.timestamps.closedAt 
    : new Date();
  return Math.floor((now.getTime() - this.timestamps.createdAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual for days since last activity
ConversationSchema.virtual('daysSinceLastActivity').get(function() {
  const now = new Date();
  return Math.floor((now.getTime() - this.timestamps.lastActivity.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual for is in cooldown
ConversationSchema.virtual('isInCooldown').get(function() {
  if (!this.timestamps.cooldownUntil) return false;
  return new Date() < this.timestamps.cooldownUntil;
});

// Virtual for cooldown remaining seconds
ConversationSchema.virtual('cooldownRemainingSeconds').get(function() {
  if (!this.timestamps.cooldownUntil) return 0;
  const remaining = this.timestamps.cooldownUntil.getTime() - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
});

// Static method to find active conversations
ConversationSchema.statics.findActive = function() {
  return this.find({ status: 'open', isActive: true });
};

// Static method to find conversations by priority
ConversationSchema.statics.findByPriority = function(priority: string) {
  return this.find({ 'settings.priority': priority, status: 'open' });
};

// Static method to find conversations needing follow-up
ConversationSchema.statics.findNeedingFollowUp = function() {
  const now = new Date();
  return this.find({
    'settings.followUpRequired': true,
    'settings.followUpDate': { $lte: now },
    status: { $in: ['open', 'scheduled'] }
  });
};

// Static method to find conversations by sentiment
ConversationSchema.statics.findBySentiment = function(sentiment: string) {
  return this.find({ 'context.sentiment': sentiment });
};

export default mongoose.model<IConversation>('Conversation', ConversationSchema);
