import mongoose, { Document, Schema } from 'mongoose';

export interface IInstagramComment extends Document {
  commentId: string;
  accountId: string;
  mediaId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: Date;
  status: 'pending' | 'processing' | 'detected' | 'replied' | 'omitted' | 'failed';
  matchedKeyword?: string; // Keyword that matched this comment
  matchedRuleId?: string; // ID of the rule that matched (ObjectId reference)
  replyText?: string;
  replyTimestamp?: Date;
  dmSent?: boolean;
  dmTimestamp?: Date;
  dmFailed?: boolean;
  dmFailureReason?: string;
  dmFailureTimestamp?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InstagramCommentSchema = new Schema<IInstagramComment>({
  commentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  accountId: {
    type: String,
    required: true,
    index: true
  },
  mediaId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'detected', 'replied', 'omitted', 'failed'],
    default: 'pending',
    index: true
  },
  matchedKeyword: {
    type: String,
    required: false,
    index: true
  },
  matchedRuleId: {
    type: String,
    required: false,
    index: true
  },
  replyText: {
    type: String,
    required: false
  },
  replyTimestamp: {
    type: Date,
    required: false
  },
  dmSent: {
    type: Boolean,
    default: false,
    index: true
  },
  dmTimestamp: {
    type: Date,
    required: false
  },
  dmFailed: {
    type: Boolean,
    default: false,
    index: true
  },
  dmFailureReason: {
    type: String,
    required: false
  },
  dmFailureTimestamp: {
    type: Date,
    required: false
  }
}, {
  timestamps: true,
  collection: 'instagram_comments'
});

// Indexes for better query performance
InstagramCommentSchema.index({ accountId: 1, status: 1 });
InstagramCommentSchema.index({ mediaId: 1, timestamp: -1 });
InstagramCommentSchema.index({ userId: 1, timestamp: -1 });
InstagramCommentSchema.index({ timestamp: -1 });

const InstagramComment = mongoose.model<IInstagramComment>('InstagramComment', InstagramCommentSchema);

export default InstagramComment;
