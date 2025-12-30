import mongoose, { Document, Schema } from 'mongoose';

export type DateRangeType = '1d' | '7d' | '30d' | '90d' | 'custom';
export type FetchRuleStatus = 'active' | 'paused' | 'archived';

export interface IGmailFetchRule extends Document {
  id: string;
  userId: Schema.Types.ObjectId;
  agentId?: Schema.Types.ObjectId; // Optional: which agent this rule is for
  name: string; // Rule name/description (e.g., "Lead Emails from Last Week")
  status: FetchRuleStatus;
  
  // Fetch configuration
  dateRange: {
    type: DateRangeType;
    days?: number; // For custom range
    customStartDate?: Date;
    customEndDate?: Date;
  };
  
  maxResults: number; // Max emails to fetch per run
  query?: string; // Gmail search query (e.g., "label:Lead", "is:unread")
  labelIds?: string[]; // Specific label IDs to search
  includeSpam: boolean;
  
  // AI Configuration
  systemPrompt?: string; // Custom system prompt for AI processing (draft generation, email categorization, etc.)
  
  // Draft Generation Settings
  draftSettings?: {
    enabled: boolean; // Enable automatic draft generation
    // Option 1: Create draft if user hasn't responded
    onlyIfUserNoResponse?: boolean; // Only create draft if user hasn't responded in X days
    userNoResponseDays?: number; // Number of days without user response before creating draft
    // Option 2: Create draft if other party hasn't responded (after user replied)
    onlyIfOtherNoResponse?: boolean; // Only create draft if other party hasn't responded in X days (after user replied)
    otherNoResponseDays?: number; // Number of days without other party response before creating draft
  };
  
  // Scheduling
  enabled: boolean;
  scheduleInterval?: number; // Minutes between fetches (e.g., 60 = every hour)
  scheduleTime?: {
    hour: number; // 0-23
    minute: number; // 0-59
    timezone?: string; // Optional timezone (e.g., "America/Santiago")
  };
  lastRunAt?: Date;
  nextRunAt?: Date;
  
  // Metadata
  metadata: {
    totalRuns: number;
    totalEmailsFetched: number;
    lastError?: string;
    lastErrorAt?: Date;
    tags?: string[];
  };
  
  createdAt: Date;
  updatedAt: Date;
  buildQuery(): string;
  calculateNextRun(): Date;
}

const GmailFetchRuleSchema = new Schema<IGmailFetchRule>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: false, index: true },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['active', 'paused', 'archived'],
      default: 'active'
    },
    
    // Fetch configuration
    dateRange: {
      type: {
        type: String,
        enum: ['1d', '7d', '30d', '90d', 'custom'],
        default: '7d'
      },
      days: { type: Number, required: false },
      customStartDate: { type: Date, required: false },
      customEndDate: { type: Date, required: false }
    },
    
    maxResults: { type: Number, default: 50, min: 1, max: 500 },
    query: { type: String, required: false, trim: true },
    labelIds: { type: [String], default: ['INBOX'] },
    includeSpam: { type: Boolean, default: false },
    
    // AI Configuration
    systemPrompt: { type: String, required: false, trim: true },
    
    // Draft Generation Settings
    draftSettings: {
      enabled: { type: Boolean, default: true },
      onlyIfUserNoResponse: { type: Boolean, default: false },
      userNoResponseDays: { type: Number, required: false, min: 1, max: 90 },
      onlyIfOtherNoResponse: { type: Boolean, default: false },
      otherNoResponseDays: { type: Number, required: false, min: 1, max: 90 }
    },
    
    // Scheduling
    enabled: { type: Boolean, default: true },
    scheduleInterval: { type: Number, required: false, min: 5 }, // Minimum 5 minutes
    scheduleTime: {
      type: {
        hour: { type: Number, min: 0, max: 23 },
        minute: { type: Number, min: 0, max: 59 },
        timezone: { type: String, required: false }
      },
      required: false
    },
    lastRunAt: { type: Date, required: false },
    nextRunAt: { type: Date, required: false },
    
    // Metadata
    metadata: {
      totalRuns: { type: Number, default: 0 },
      totalEmailsFetched: { type: Number, default: 0 },
      lastError: { type: String, required: false },
      lastErrorAt: { type: Date, required: false },
      tags: { type: [String], default: [] }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
GmailFetchRuleSchema.index({ userId: 1, status: 1 });
GmailFetchRuleSchema.index({ agentId: 1 });
GmailFetchRuleSchema.index({ enabled: 1, status: 1 });
GmailFetchRuleSchema.index({ nextRunAt: 1 }); // For scheduled fetches

// Method to build Gmail query from rule
GmailFetchRuleSchema.methods.buildQuery = function(): string {
  let query = this.query || '';
  
  // Add date filter
  if (this.dateRange.type === 'custom' && this.dateRange.customStartDate) {
    const startDate = new Date(this.dateRange.customStartDate);
    const dateStr = startDate.toISOString().split('T')[0].replace(/-/g, '/');
    query = query ? `${query} after:${dateStr}` : `after:${dateStr}`;
    
    if (this.dateRange.customEndDate) {
      const endDate = new Date(this.dateRange.customEndDate);
      const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '/');
      query += ` before:${endDateStr}`;
    }
  } else if (this.dateRange.type !== 'custom') {
    const daysMap: Record<string, number> = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    };
    const days = daysMap[this.dateRange.type] || 7;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const dateStr = startDate.toISOString().split('T')[0].replace(/-/g, '/');
    query = query ? `${query} after:${dateStr}` : `after:${dateStr}`;
  }
  
  return query.trim();
};

// Method to calculate next run time
GmailFetchRuleSchema.methods.calculateNextRun = function(): Date {
  if (!this.enabled) {
    return new Date(Date.now() + 24 * 60 * 60 * 1000); // Default: tomorrow
  }

  // If scheduleTime is set, use it (specific time of day)
  if (this.scheduleTime && this.scheduleTime.hour !== undefined && this.scheduleTime.minute !== undefined) {
    const now = new Date();
    const targetTime = new Date();
    
    // Set target time to today at the specified hour and minute
    targetTime.setHours(this.scheduleTime.hour, this.scheduleTime.minute, 0, 0);
    
    // If the time has already passed today, schedule for tomorrow
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    return targetTime;
  }

  // Otherwise, use scheduleInterval (interval-based)
  if (!this.scheduleInterval) {
    return new Date(Date.now() + 24 * 60 * 60 * 1000); // Default: tomorrow
  }
  
  const intervalMs = this.scheduleInterval * 60 * 1000;
  const lastRun = this.lastRunAt || new Date();
  return new Date(lastRun.getTime() + intervalMs);
};

export default mongoose.model<IGmailFetchRule>('GmailFetchRule', GmailFetchRuleSchema);

