import mongoose, { Document, Schema } from 'mongoose';

export interface IFollowUpConfig extends Document {
  userId: string;
  accountId: string;
  enabled: boolean;
  minLeadScore: number;
  maxFollowUps: number;
  timeSinceLastAnswer: number; // hours
  messageMode: 'template' | 'ai';
  messageTemplate: string;
}

const FollowUpConfigSchema = new Schema<IFollowUpConfig>({
  userId: { type: String, required: true },
  accountId: { type: String, required: true },
  enabled: { type: Boolean, default: false },
  minLeadScore: { type: Number, min: 1, max: 7, default: 2 },
  maxFollowUps: { type: Number, min: 1, max: 10, default: 3 },
  timeSinceLastAnswer: { type: Number, min: 1, max: 168, default: 24 },
  messageMode: { type: String, enum: ['template', 'ai'], default: 'template' },
  messageTemplate: { type: String, default: '' }
}, {
  timestamps: true
});

FollowUpConfigSchema.index({ userId: 1, accountId: 1 }, { unique: true });

export default mongoose.model<IFollowUpConfig>('FollowUpConfig', FollowUpConfigSchema);
