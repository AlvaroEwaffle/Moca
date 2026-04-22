import mongoose, { Document, Schema } from 'mongoose';

export interface IFollowUpConfig extends Document {
  userId: string;
  accountId: string;
  enabled: boolean;
  minLeadScore: number;
  maxFollowUps: number;
  timeSinceLastAnswer: number; // hours (supports decimals, e.g. 0.5 = 30 min)
  messageMode: 'template' | 'ai';
  messageTemplate: string;
  aiInstruction: string; // custom instruction for AI-generated follow-ups
}

const FollowUpConfigSchema = new Schema<IFollowUpConfig>({
  userId: { type: String, required: true },
  accountId: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  minLeadScore: { type: Number, min: 1, max: 7, default: 2 },
  maxFollowUps: { type: Number, min: 1, max: 10, default: 3 },
  timeSinceLastAnswer: { type: Number, min: 0.25, max: 168, default: 24 },
  messageMode: { type: String, enum: ['template', 'ai'], default: 'template' },
  messageTemplate: { type: String, default: '' },
  aiInstruction: { type: String, default: '' }
}, {
  timestamps: true
});

FollowUpConfigSchema.index({ userId: 1, accountId: 1 }, { unique: true });

export default mongoose.model<IFollowUpConfig>('FollowUpConfig', FollowUpConfigSchema);
