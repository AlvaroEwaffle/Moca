import mongoose, { Document, Schema } from 'mongoose';

// Queue item metadata sub-schema
const QueueItemMetadataSchema = new Schema({
  createdAt: { type: Date, default: Date.now },
  scheduledFor: { type: Date, default: Date.now }, // When to send
  lastAttempt: { type: Date, required: false }, // Last attempt timestamp
  nextAttempt: { type: Date, required: false }, // Next attempt timestamp
  attempts: { type: Number, default: 0 }, // Number of attempts made
  maxAttempts: { type: Number, default: 3 }, // Maximum attempts allowed
  errorHistory: [{
    attempt: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
    errorCode: { type: String, required: true },
    errorMessage: { type: String, required: true },
    retryAfter: { type: Date, required: false }
  }]
});

// Rate limiting sub-schema - removed unused fields
const RateLimitInfoSchema = new Schema({
  // Keep empty for now - rate limiting handled elsewhere
});

export interface IOutboundQueue extends Document {
  id: string;
  messageId: string; // Reference to Message
  conversationId: string; // Reference to Conversation
  contactId: string; // Reference to Contact (for quick access)
  accountId: string; // Reference to InstagramAccount
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  metadata: {
    createdAt: Date;
    scheduledFor: Date;
    lastAttempt?: Date;
    nextAttempt?: Date;
    attempts: number;
    maxAttempts: number;
    errorHistory: Array<{
      attempt: number;
      timestamp: Date;
      errorCode: string;
      errorMessage: string;
      retryAfter?: Date;
    }>;
  };
  rateLimitInfo: any; // Flexible object
  content: {
    text: string;
  };
}

const OutboundQueueSchema = new Schema<IOutboundQueue>({
  messageId: { type: String, required: true, unique: true },
  conversationId: { type: String, required: true },
  contactId: { type: String, required: true },
  accountId: { type: String, required: true },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  status: { type: String, enum: ['pending', 'processing', 'sent', 'failed', 'cancelled'], default: 'pending' },
  metadata: { type: QueueItemMetadataSchema, default: () => ({}) },
  rateLimitInfo: { type: RateLimitInfoSchema, default: () => ({}) },
  content: {
    text: { type: String, required: true }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
OutboundQueueSchema.index({ conversationId: 1 });
OutboundQueueSchema.index({ contactId: 1 });
OutboundQueueSchema.index({ accountId: 1 });
OutboundQueueSchema.index({ priority: 1 });
OutboundQueueSchema.index({ status: 1 });
OutboundQueueSchema.index({ 'metadata.scheduledFor': 1 });
OutboundQueueSchema.index({ 'metadata.nextAttempt': 1 });

// Compound indexes for rate limiting
OutboundQueueSchema.index({ accountId: 1, 'metadata.scheduledFor': 1 });
OutboundQueueSchema.index({ contactId: 1, 'metadata.scheduledFor': 1 });
OutboundQueueSchema.index({ status: 1, priority: 1, 'metadata.scheduledFor': 1 });

// Pre-save middleware to update metadata
OutboundQueueSchema.pre('save', function(next) {
  // Set next attempt if not set and status is failed
  if (this.status === 'failed' && !this.metadata.nextAttempt) {
    const delay = 1000 * Math.pow(2, this.metadata.attempts); // Simple exponential backoff
    this.metadata.nextAttempt = new Date(Date.now() + delay);
  }
  
  next();
});

// Virtual for is ready to process
OutboundQueueSchema.virtual('isReadyToProcess').get(function() {
  if (this.status !== 'pending') return false;
  if (this.metadata.scheduledFor > new Date()) return false;
  if (this.metadata.nextAttempt && this.metadata.nextAttempt > new Date()) return false;
  return true;
});

// Virtual for can retry
OutboundQueueSchema.virtual('canRetry').get(function() {
  return this.status === 'failed' && 
         this.metadata.attempts < this.metadata.maxAttempts &&
         (!this.metadata.nextAttempt || this.metadata.nextAttempt <= new Date());
});

// Virtual for retry delay in milliseconds
OutboundQueueSchema.virtual('retryDelayMs').get(function() {
  // Simple exponential backoff
  return 1000 * Math.pow(2, this.metadata.attempts);
});

// Virtual for age in seconds
OutboundQueueSchema.virtual('ageSeconds').get(function() {
  const now = new Date();
  return Math.floor((now.getTime() - this.metadata.createdAt.getTime()) / 1000);
});

// Virtual for time until next attempt
OutboundQueueSchema.virtual('timeUntilNextAttempt').get(function() {
  if (!this.metadata.nextAttempt) return 0;
  const now = new Date();
  const timeUntil = this.metadata.nextAttempt.getTime() - now.getTime();
  return Math.max(0, Math.floor(timeUntil / 1000));
});

// Method to calculate next attempt time
OutboundQueueSchema.methods.calculateNextAttempt = function(): Date {
  const now = new Date();
  const delayMs = this.retryDelayMs;
  return new Date(now.getTime() + delayMs);
};

// Method to increment attempt count
OutboundQueueSchema.methods.incrementAttempt = function(): void {
  this.metadata.attempts += 1;
  this.metadata.lastAttempt = new Date();
  this.metadata.nextAttempt = this.calculateNextAttempt();
};

// Method to add error to history
OutboundQueueSchema.methods.addError = function(errorCode: string, errorMessage: string, retryAfter?: Date): void {
  this.metadata.errorHistory.push({
    attempt: this.metadata.attempts,
    timestamp: new Date(),
    errorCode,
    errorMessage,
    retryAfter
  });
};

// Static method to find items ready to process
OutboundQueueSchema.statics.findReadyToProcess = function(limit: number = 10) {
  const now = new Date();
  return this.find({
    status: 'pending',
    $or: [
      { 'metadata.scheduledFor': { $lte: now } },
      { 'metadata.scheduledFor': { $exists: false } }
    ],
    $and: [
      {
        $or: [
          { 'metadata.nextAttempt': { $lte: now } },
          { 'metadata.nextAttempt': { $exists: false } }
        ]
      },
      {
        $or: [
          { expiresAt: { $gt: now } },
          { expiresAt: { $exists: false } }
        ]
      }
    ]
  })
  .sort({ priority: -1, 'metadata.scheduledFor': 1 })
  .limit(limit);
};

// Static method to find items needing retry
OutboundQueueSchema.statics.findNeedingRetry = function() {
  const now = new Date();
  return this.find({
    status: 'failed',
    'metadata.retryCount': { $lt: 3 },
    $or: [
      { 'metadata.errorDetails.retryAfter': { $lte: now } },
      { 'metadata.errorDetails.retryAfter': { $exists: false } }
    ]
  });
};

// Static method to find expired items
OutboundQueueSchema.statics.findExpired = function() {
  const now = new Date();
  return this.find({
    expiresAt: { $lte: now },
    status: 'pending'
  });
};

// Static method to find failed items
OutboundQueueSchema.statics.findFailed = function() {
  return this.find({ status: 'failed' });
};

// Static method to find urgent items
OutboundQueueSchema.statics.findUrgent = function() {
  return this.find({ isUrgent: true, status: 'pending' });
};

// Static method to find expired items
OutboundQueueSchema.statics.findExpired = function() {
  const now = new Date();
  return this.find({
    expiresAt: { $lte: now },
    status: 'pending'
  });
};

// Define the interface for static methods
interface IOutboundQueueModel extends mongoose.Model<IOutboundQueue> {
  findReadyToProcess(limit?: number): Promise<IOutboundQueue[]>;
  findNeedingRetry(): Promise<IOutboundQueue[]>;
  findExpired(): Promise<IOutboundQueue[]>;
  findFailed(): Promise<IOutboundQueue[]>;
  findUrgent(): Promise<IOutboundQueue[]>;
}

export default mongoose.model<IOutboundQueue, IOutboundQueueModel>('OutboundQueue', OutboundQueueSchema);
