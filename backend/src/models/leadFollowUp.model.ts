import mongoose, { Document, Schema } from 'mongoose';

export interface ILeadFollowUp extends Document {
  conversationId: string;
  contactId: string;
  accountId: string;
  userId: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'converted';
  messageId?: string;
  scheduledAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  convertedAt?: Date;
  followUpCount: number;
  lastFollowUpAt?: Date;
  nextFollowUpAt?: Date;
  messageTemplate: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeadFollowUpSchema = new Schema<ILeadFollowUp>({
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  contactId: {
    type: String,
    required: true,
    index: true
  },
  accountId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'converted'],
    default: 'pending'
  },
  messageId: {
    type: String,
    index: true
  },
  scheduledAt: {
    type: Date,
    required: true,
    index: true
  },
  sentAt: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  convertedAt: {
    type: Date
  },
  followUpCount: {
    type: Number,
    default: 0
  },
  lastFollowUpAt: {
    type: Date
  },
  nextFollowUpAt: {
    type: Date,
    index: true
  },
  messageTemplate: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
LeadFollowUpSchema.index({ conversationId: 1, followUpCount: 1 });
LeadFollowUpSchema.index({ accountId: 1, status: 1, scheduledAt: 1 });
LeadFollowUpSchema.index({ nextFollowUpAt: 1, status: 1 });

export default mongoose.model<ILeadFollowUp>('LeadFollowUp', LeadFollowUpSchema);
