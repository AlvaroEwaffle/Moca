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
  businessHoursOnly: { type: Boolean, default: false }, // Only respond during business hours
  
  // Response counter for global agent limits
  responseCounter: {
    totalResponses: { type: Number, default: 0 }, // Total AI responses sent
    lastResetAt: { type: Date, default: Date.now }, // When counter was last reset
    disabledByResponseLimit: { type: Boolean, default: false }, // Disabled due to response limit
    disabledByLeadScore: { type: Boolean, default: false }, // Disabled due to lead score milestone
    disabledByMilestone: { type: Boolean, default: false } // Disabled due to conversation milestone
  }
});

// Lead scoring sub-schema - Updated to use 7-step scale
const LeadScoringSchema = new Schema({
  currentScore: { type: Number, min: 1, max: 7, default: 1 }, // Current lead score (1-7)
  previousScore: { type: Number, min: 1, max: 7, required: false }, // Previous lead score
  progression: { type: String, enum: ['increased', 'decreased', 'maintained'], default: 'maintained' },
  scoreHistory: [{ 
    score: { type: Number, min: 1, max: 7 },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String },
    stepName: { type: String } // Name of the step (e.g., "Contact Received")
  }], // History of lead score changes
  lastScoredAt: { type: Date, default: Date.now }, // When lead was last scored
  confidence: { type: Number, min: 0, max: 1, default: 0.5 }, // Confidence in lead assessment
  
  // Current step information
  currentStep: {
    stepNumber: { type: Number, min: 1, max: 7, default: 1 },
    stepName: { type: String, default: 'Contact Received' },
    stepDescription: { type: String, default: 'Initial contact from customer' }
  }
});

// AI response metadata sub-schema
const AIResponseMetadataSchema = new Schema({
  lastResponseType: { type: String, enum: ['structured', 'fallback'], default: 'fallback' },
  lastIntent: { type: String, required: false }, // Last detected intent
  lastNextAction: { type: String, required: false }, // Last recommended next action
  repetitionDetected: { type: Boolean, default: false }, // Whether repetition was detected
  contextAwareness: { type: Boolean, default: false }, // Whether context was properly used
  businessNameUsed: { type: String, required: false }, // Business name used in response
  responseQuality: { type: Number, min: 0, max: 1, default: 0.5 } // Quality score of last response
});

// Conversation analytics sub-schema
const ConversationAnalyticsSchema = new Schema({
  leadProgression: {
    trend: { type: String, enum: ['improving', 'declining', 'stable'], default: 'stable' },
    averageScore: { type: Number, min: 1, max: 7, default: 1 },
    peakScore: { type: Number, min: 1, max: 7, default: 1 },
    progressionRate: { type: Number, min: 0, max: 1, default: 0 }
  },
  repetitionPatterns: [{ type: String }], // Detected repetition patterns
  conversationFlow: {
    totalTurns: { type: Number, default: 0 },
    averageTurnLength: { type: Number, default: 0 },
    questionCount: { type: Number, default: 0 },
    responseCount: { type: Number, default: 0 }
  }
});

// Conversation milestone sub-schema
const ConversationMilestoneSchema = new Schema({
  target: { 
    type: String, 
    enum: ['link_shared', 'meeting_scheduled', 'demo_booked', 'custom'], 
    required: false 
  },
  customTarget: { type: String, required: false }, // Custom milestone description
  status: { 
    type: String, 
    enum: ['pending', 'achieved', 'failed'], 
    default: 'pending' 
  },
  achievedAt: { type: Date, required: false },
  notes: { type: String, required: false },
  autoDisableAgent: { type: Boolean, default: true } // Whether to disable agent when achieved
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
    responseCounter: {
      totalResponses: number;
      lastResetAt: Date;
      disabledByResponseLimit: boolean;
      disabledByLeadScore: boolean;
      disabledByMilestone: boolean;
    };
  };
  leadScoring: {
    currentScore: number;
    previousScore?: number;
    progression: 'increased' | 'decreased' | 'maintained';
    scoreHistory: Array<{
      score: number;
      timestamp: Date;
      reason: string;
      stepName: string;
    }>;
    lastScoredAt: Date;
    confidence: number;
    currentStep: {
      stepNumber: number;
      stepName: string;
      stepDescription: string;
    };
  };
  aiResponseMetadata: {
    lastResponseType: 'structured' | 'fallback';
    lastIntent?: string;
    lastNextAction?: string;
    repetitionDetected: boolean;
    contextAwareness: boolean;
    businessNameUsed?: string;
    responseQuality: number;
  };
  analytics: {
    leadProgression: {
      trend: 'improving' | 'declining' | 'stable';
      averageScore: number;
      peakScore: number;
      progressionRate: number;
    };
    repetitionPatterns: string[];
    conversationFlow: {
      totalTurns: number;
      averageTurnLength: number;
      questionCount: number;
      responseCount: number;
    };
  };
  milestone: {
    target?: 'link_shared' | 'meeting_scheduled' | 'demo_booked' | 'custom';
    customTarget?: string;
    status: 'pending' | 'achieved' | 'failed';
    achievedAt?: Date;
    notes?: string;
    autoDisableAgent: boolean;
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
  leadScoring: { type: LeadScoringSchema, default: () => ({}) },
  aiResponseMetadata: { type: AIResponseMetadataSchema, default: () => ({}) },
  analytics: { type: ConversationAnalyticsSchema, default: () => ({}) },
  milestone: { type: ConversationMilestoneSchema, default: () => ({}) },
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
// Lead scoring indexes
ConversationSchema.index({ 'leadScoring.currentScore': -1 });
ConversationSchema.index({ 'leadScoring.progression': 1 });
ConversationSchema.index({ 'leadScoring.lastScoredAt': -1 });
// AI response metadata indexes
ConversationSchema.index({ 'aiResponseMetadata.lastResponseType': 1 });
ConversationSchema.index({ 'aiResponseMetadata.lastIntent': 1 });
ConversationSchema.index({ 'aiResponseMetadata.repetitionDetected': 1 });
// Analytics indexes
ConversationSchema.index({ 'analytics.leadProgression.trend': 1 });
ConversationSchema.index({ 'analytics.leadProgression.averageScore': -1 });
// Milestone indexes
ConversationSchema.index({ 'milestone.status': 1 });
ConversationSchema.index({ 'milestone.target': 1 });
ConversationSchema.index({ 'milestone.achievedAt': -1 });

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
