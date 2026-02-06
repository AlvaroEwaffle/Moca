import mongoose, { Document, Schema } from 'mongoose';

export interface IFollowUpConfig extends Document {
  userId: string;
  accountId: string;
  enabled: boolean;
  minLeadScore: number; // Minimum lead score to follow up (e.g., 2 = follow up scores 2 and above)
  maxFollowUps: number; // Maximum number of follow-ups to send
  timeSinceLastAnswer: number; // Hours to wait since last answer before following up
  messageMode: 'template' | 'ai'; // 'template' = use messageTemplate, 'ai' = AI suggests based on conversation + system prompt
  messageTemplate: string; // Template for follow-up messages (used when messageMode is 'template')
  createdAt: Date;
  updatedAt: Date;
}

const FollowUpConfigSchema = new Schema<IFollowUpConfig>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  accountId: {
    type: String,
    required: true,
    index: true
  },
  enabled: {
    type: Boolean,
    default: false
  },
  minLeadScore: {
    type: Number,
    required: true,
    min: 1,
    max: 7,
    default: 2
  },
  maxFollowUps: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    default: 3
  },
  timeSinceLastAnswer: {
    type: Number,
    required: true,
    min: 1,
    max: 168, // Max 1 week
    default: 24 // 24 hours
  },
  messageMode: {
    type: String,
    enum: ['template', 'ai'],
    default: 'template'
  },
  messageTemplate: {
    type: String,
    required: true,
    default: "Hola! 👋 Vi que te interesó nuestro servicio. ¿Te gustaría que te cuente más detalles? Estoy aquí para ayudarte! 😊"
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
FollowUpConfigSchema.index({ userId: 1, accountId: 1 }, { unique: true });

export default mongoose.model<IFollowUpConfig>('FollowUpConfig', FollowUpConfigSchema);
