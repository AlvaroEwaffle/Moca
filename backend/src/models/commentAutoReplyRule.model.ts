import mongoose, { Document, Schema } from 'mongoose';

export interface ICommentAutoReplyRule extends Document {
  accountId: string; // Instagram account ID this rule belongs to
  userId: string; // User who owns this rule
  keyword: string; // Keyword to match in comments (case-insensitive)
  responseMessage: string; // Message to reply with when keyword is found
  enabled: boolean; // Whether this rule is active
  sendDM: boolean; // Whether to send DM after replying to comment
  dmMessage?: string; // DM message to send (required if sendDM is true)
  createdAt: Date;
  updatedAt: Date;
}

const CommentAutoReplyRuleSchema = new Schema<ICommentAutoReplyRule>({
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
  keyword: {
    type: String,
    required: true,
    trim: true,
    lowercase: true // Store lowercase for case-insensitive matching
  },
  responseMessage: {
    type: String,
    required: true,
    trim: true
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true
  },
  sendDM: {
    type: Boolean,
    default: false
  },
  dmMessage: {
    type: String,
    required: false,
    trim: true
  }
}, {
  timestamps: true,
  collection: 'comment_auto_reply_rules'
});

// Compound index for efficient querying
CommentAutoReplyRuleSchema.index({ accountId: 1, enabled: 1 });
CommentAutoReplyRuleSchema.index({ accountId: 1, userId: 1 });

// Ensure unique keywords per account
CommentAutoReplyRuleSchema.index({ accountId: 1, keyword: 1 }, { unique: true });

const CommentAutoReplyRule = mongoose.model<ICommentAutoReplyRule>('CommentAutoReplyRule', CommentAutoReplyRuleSchema);

export default CommentAutoReplyRule;
