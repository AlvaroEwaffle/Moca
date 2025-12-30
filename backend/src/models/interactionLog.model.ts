import mongoose, { Document, Schema } from 'mongoose';

export type InteractionChannel = 'instagram' | 'gmail' | 'whatsapp' | 'google_calendar';
export type InteractionDirection = 'inbound' | 'outbound';
export type InteractionMessageType = 'text' | 'attachment' | 'email' | 'event';

export interface IInteractionLog extends Document {
  userId: Schema.Types.ObjectId;
  agentId?: Schema.Types.ObjectId;
  conversationId?: Schema.Types.ObjectId | string;
  contactId?: Schema.Types.ObjectId | string;
  integrationId?: Schema.Types.ObjectId | string;
  channel: InteractionChannel;
  direction: InteractionDirection;
  messageType: InteractionMessageType;
  textPreview?: string;
  payloadSummary?: string;
  counts: {
    attachments?: number;
    tokens?: number;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const InteractionLogSchema = new Schema<IInteractionLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: false, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: false },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: false },
    integrationId: { type: Schema.Types.ObjectId, required: false },
    channel: {
      type: String,
      enum: ['instagram', 'gmail', 'whatsapp', 'google_calendar'],
      required: true
    },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    messageType: {
      type: String,
      enum: ['text', 'attachment', 'email', 'event'],
      default: 'text'
    },
    textPreview: { type: String },
    payloadSummary: { type: String },
    counts: {
      attachments: { type: Number, default: 0 },
      tokens: { type: Number, default: 0 }
    },
    metadata: { type: Schema.Types.Mixed }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

InteractionLogSchema.index({ channel: 1, createdAt: -1 });
InteractionLogSchema.index({ direction: 1, createdAt: -1 });
InteractionLogSchema.index({ createdAt: -1 });

export default mongoose.model<IInteractionLog>('InteractionLog', InteractionLogSchema);

