import mongoose, { Document, Schema } from 'mongoose';

export interface IKeywordActivationRule extends Document {
  accountId: string; // Instagram account ID
  userId: string; // Moca user ID
  keyword: string; // Keyword to trigger activation (case-insensitive)
  enabled: boolean; // Whether this keyword rule is enabled
  createdAt: Date;
  updatedAt: Date;
}

const KeywordActivationRuleSchema = new Schema<IKeywordActivationRule>(
  {
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
      lowercase: true // Store in lowercase for consistent matching
    },
    enabled: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index to ensure unique keywords per account
KeywordActivationRuleSchema.index({ accountId: 1, keyword: 1 }, { unique: true });

// Index for enabled rules lookup
KeywordActivationRuleSchema.index({ accountId: 1, enabled: 1 });

export default mongoose.model<IKeywordActivationRule>('KeywordActivationRule', KeywordActivationRuleSchema);
