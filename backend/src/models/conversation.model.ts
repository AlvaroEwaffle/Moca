import mongoose, { Document, Schema } from 'mongoose';

// Conversation timestamps sub-schema
const ConversationTimestampsSchema = new Schema({
  createdAt: { type: Date, default: Date.now },
  lastUserMessage: { type: Date, default: Date.now },
  lastBotMessage: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now }
});

// Conversation context sub-schema
const ConversationContextSchema = new Schema({
  topic: { type: String, required: false }, // Main conversation topic
  urgency: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  category: { type: String, required: false } // Business category
});

// Conversation metrics sub-schema
const ConversationMetricsSchema = new Schema({
  totalMessages: { type: Number, default: 0 },
  userMessages: { type: Number, default: 0 },
  botMessages: { type: Number, default: 0 }
});

// Conversation settings sub-schema
const ConversationSettingsSchema = new Schema({
  aiEnabled: { type: Boolean, default: true }, // Whether AI responses are enabled
  
  // Response counter for global agent limits
  responseCounter: {
    totalResponses: { type: Number, default: 0 }, // Total AI responses sent
    lastResetAt: { type: Date, default: Date.now }, // When counter was last reset
    disabledByResponseLimit: { type: Boolean, default: false }, // Disabled due to response limit
    disabledByLeadScore: { type: Boolean, default: false }, // Disabled due to lead score milestone
    disabledByMilestone: { type: Boolean, default: false } // Disabled due to conversation milestone
  },
  
  // Keyword activation tracking
  activatedByKeyword: { type: Boolean, default: false }, // Whether conversation was activated by keyword
  activationKeyword: { type: String, required: false } // The keyword that activated this conversation
});

// Lead scoring sub-schema - Updated to use 7-step scale
const LeadScoringSchema = new Schema({
  currentScore: { type: Number, min: 1, max: 7, default: 1 }, // Current lead score (1-7)
  progression: { type: String, enum: ['increased', 'decreased', 'maintained'], default: 'maintained' },
  scoreHistory: [{ 
    score: { type: Number, min: 1, max: 7 },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String },
    stepName: { type: String } // Name of the step (e.g., "Contact Received")
  }], // History of lead score changes
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
  conversationFlow: {
    totalTurns: { type: Number, default: 0 }
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
    lastActivity: Date;
  };
  context: {
    topic?: string;
    urgency: string;
    category?: string;
  };
  metrics: {
    totalMessages: number;
    userMessages: number;
    botMessages: number;
  };
  settings: {
    aiEnabled: boolean;
    responseCounter: {
      totalResponses: number;
      lastResetAt: Date;
      disabledByResponseLimit: boolean;
      disabledByLeadScore: boolean;
      disabledByMilestone: boolean;
    };
    activatedByKeyword?: boolean;
    activationKeyword?: string;
  };
  leadScoring: {
    currentScore: number;
    progression: 'increased' | 'decreased' | 'maintained';
    scoreHistory: Array<{
      score: number;
      timestamp: Date;
      reason: string;
      stepName: string;
    }>;
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
    conversationFlow: {
      totalTurns: number;
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
ConversationSchema.index({ 'context.urgency': 1 });
// Lead scoring indexes
ConversationSchema.index({ 'leadScoring.currentScore': -1 });
ConversationSchema.index({ 'leadScoring.progression': 1 });
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
  }
  
  next();
});

// Virtual for days since last activity
ConversationSchema.virtual('daysSinceLastActivity').get(function() {
  const now = new Date();
  return Math.floor((now.getTime() - this.timestamps.lastActivity.getTime()) / (1000 * 60 * 60 * 24));
});

export default mongoose.model<IConversation>('Conversation', ConversationSchema);
