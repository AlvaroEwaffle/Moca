import mongoose, { Document, Schema } from 'mongoose';

export type DraftStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'sent';
export type DraftPriority = 'low' | 'medium' | 'high' | 'urgent';
export type DraftApprovalState = 'new' | 'approved' | 'sent';

export interface IEmailDraftQueue extends Document {
  id: string;
  userId: Schema.Types.ObjectId;
  agentId?: Schema.Types.ObjectId;
  conversationId?: Schema.Types.ObjectId;
  messageId?: Schema.Types.ObjectId; // Reference to the original email message
  contactId?: Schema.Types.ObjectId;
  
  // Email context
  emailId: string; // Gmail message ID
  threadId: string; // Gmail thread ID
  subject: string;
  fromEmail: string;
  fromName?: string;
  originalBody: string;
  
  // Draft generation settings
  agentSettings?: {
    systemPrompt?: string;
    toneOfVoice?: string;
    keyInformation?: string;
  };
  
  // Draft content
  draftContent?: string; // Generated draft content
  draftId?: string; // Gmail draft ID after creation
  status: DraftStatus;
  priority: DraftPriority;
  approvalState?: DraftApprovalState; // User-managed approval state: 'new', 'approved', 'sent'
  
  // Error tracking
  error?: string;
  retryCount: number;
  maxRetries: number;
  
  // Metadata
  metadata: {
    generationTime?: number; // Time taken to generate (ms)
    createdAt?: Date;
    updatedAt?: Date;
    tags?: string[];
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const EmailDraftQueueSchema = new Schema<IEmailDraftQueue>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: false, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: false, index: true },
    messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: false, index: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: false },
    
    // Email context
    emailId: { type: String, required: true },
    threadId: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    fromEmail: { type: String, required: true },
    fromName: { type: String, required: false },
    originalBody: { type: String, required: true },
    
    // Draft generation settings
    agentSettings: {
      systemPrompt: { type: String, required: false },
      toneOfVoice: { type: String, required: false },
      keyInformation: { type: String, required: false }
    },
    
    // Draft content
    draftContent: { type: String, required: false },
    draftId: { type: String, required: false },
    status: {
      type: String,
      enum: ['pending', 'generating', 'completed', 'failed', 'sent'],
      default: 'pending',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true
    },
    approvalState: {
      type: String,
      enum: ['new', 'approved', 'sent'],
      default: 'new',
      index: true
    },
    
    // Error tracking
    error: { type: String, required: false },
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
EmailDraftQueueSchema.index({ userId: 1, status: 1 });
EmailDraftQueueSchema.index({ userId: 1, approvalState: 1 }); // For filtering by approval state
EmailDraftQueueSchema.index({ status: 1, priority: -1, createdAt: 1 }); // For worker queries
EmailDraftQueueSchema.index({ conversationId: 1 });
EmailDraftQueueSchema.index({ threadId: 1 });
// Non-unique index on emailId for fast lookups
// We handle duplicates in code (only one pending/generating per email)
EmailDraftQueueSchema.index({ emailId: 1 });

export default mongoose.model<IEmailDraftQueue>('EmailDraftQueue', EmailDraftQueueSchema);

