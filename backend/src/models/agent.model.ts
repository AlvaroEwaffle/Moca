import mongoose, { Document, Schema } from 'mongoose';
import { IntegrationType } from './integration.model';

export interface AgentStatus {
  active: boolean;
  archivedAt?: Date;
}

export interface ChannelAssignments {
  instagram?: boolean;
  whatsapp?: boolean;
  gmail?: boolean;
  google_calendar?: boolean;
}

export type ChannelTone = 'professional' | 'friendly' | 'casual';

export interface ChannelPrompts {
  instagram?: string;
  whatsapp?: string;
  gmail?: string;
  google_calendar?: string;
}

export interface ChannelVoices {
  instagram?: ChannelTone;
  whatsapp?: ChannelTone;
  gmail?: ChannelTone;
  google_calendar?: ChannelTone;
}

export interface IAgent extends Document {
  id: string;
  userId: Schema.Types.ObjectId;
  tenantId?: Schema.Types.ObjectId;
  name: string;
  description?: string;
  systemPrompt: string;
  enabledTools: IntegrationType[];
  isPrimary: boolean;
  status: AgentStatus;
  metadata: {
    channelAssignments?: ChannelAssignments;
    channelPrompts?: ChannelPrompts;
    channelVoices?: ChannelVoices;
    tags?: string[];
    color?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: false, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: false, trim: true },
    systemPrompt: {
      type: String,
      required: true,
      default:
        'You are a helpful assistant for a modern business. Provide concise, friendly answers and capture key data.'
    },
    enabledTools: {
      type: [String],
      enum: ['instagram', 'google_calendar', 'gmail', 'whatsapp'],
      default: []
    },
    isPrimary: { type: Boolean, default: false },
    status: {
      active: { type: Boolean, default: true },
      archivedAt: { type: Date }
    },
    metadata: {
      channelAssignments: {
        instagram: { type: Boolean, default: true },
        whatsapp: { type: Boolean, default: false },
        gmail: { type: Boolean, default: false },
        google_calendar: { type: Boolean, default: false }
      },
      channelPrompts: {
        instagram: { type: String, default: '' },
        whatsapp: { type: String, default: '' },
        gmail: { type: String, default: '' },
        google_calendar: { type: String, default: '' }
      },
      channelVoices: {
        instagram: {
          type: String,
          enum: ['professional', 'friendly', 'casual'],
          default: 'professional'
        },
        whatsapp: {
          type: String,
          enum: ['professional', 'friendly', 'casual'],
          default: 'professional'
        },
        gmail: {
          type: String,
          enum: ['professional', 'friendly', 'casual'],
          default: 'professional'
        },
        google_calendar: {
          type: String,
          enum: ['professional', 'friendly', 'casual'],
          default: 'professional'
        }
      },
      tags: { type: [String], default: [] },
      color: { type: String }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

AgentSchema.index({ userId: 1, isPrimary: 1, 'status.active': 1 });
AgentSchema.index({ tenantId: 1 });
AgentSchema.index({ 'metadata.channelAssignments.instagram': 1 });
AgentSchema.index({ 'metadata.channelAssignments.whatsapp': 1 });
AgentSchema.index({ 'metadata.channelAssignments.gmail': 1 });

export default mongoose.model<IAgent>('Agent', AgentSchema);

