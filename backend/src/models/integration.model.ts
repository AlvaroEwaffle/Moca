import mongoose, { Document, Schema } from 'mongoose';
import { encrypt, decrypt } from '../utils/crypto';

export type IntegrationType = 'instagram' | 'google_calendar' | 'gmail' | 'whatsapp';
export type IntegrationStatus = 'disconnected' | 'pending' | 'connected' | 'error';

interface IntegrationAuth {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface IIntegration extends Document {
  id: string;
  userId: string;
  type: IntegrationType;
  status: IntegrationStatus;
  metadata: Record<string, any>;
  auth: IntegrationAuth;
  lastSyncedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  setTokens: (tokens: IntegrationAuth) => void;
  clearTokens: () => void;
  toSafeObject: () => Record<string, any>;
}

const IntegrationSchema = new Schema<IIntegration>(
  {
    // Using any cast to satisfy strict typing while keeping ObjectId storage
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true } as any,
    type: {
      type: String,
      enum: ['instagram', 'google_calendar', 'gmail', 'whatsapp'],
      required: true
    },
    status: {
      type: String,
      enum: ['disconnected', 'pending', 'connected', 'error'],
      default: 'disconnected'
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    auth: {
      accessToken: { type: String },
      refreshToken: { type: String },
      expiresAt: { type: Date }
    },
    lastSyncedAt: { type: Date },
    error: { type: String }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

IntegrationSchema.index({ userId: 1, type: 1 }, { unique: true });

IntegrationSchema.methods.setTokens = function (tokens: IntegrationAuth) {
  if (tokens.accessToken) {
    this.auth.accessToken = encrypt(tokens.accessToken);
  }
  if (tokens.refreshToken) {
    this.auth.refreshToken = encrypt(tokens.refreshToken);
  }
  if (tokens.expiresAt) {
    this.auth.expiresAt = tokens.expiresAt;
  }
};

IntegrationSchema.methods.clearTokens = function () {
  this.auth.accessToken = undefined;
  this.auth.refreshToken = undefined;
  this.auth.expiresAt = undefined;
};

IntegrationSchema.methods.toSafeObject = function () {
  return {
    id: this.id,
    userId: this.userId,
    type: this.type,
    status: this.status,
    metadata: this.metadata,
    lastSyncedAt: this.lastSyncedAt,
    error: this.error,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    expiresAt: this.auth.expiresAt
  };
};

export const revealTokens = (integration: IIntegration): IntegrationAuth => ({
  accessToken: decrypt(integration.auth.accessToken),
  refreshToken: decrypt(integration.auth.refreshToken),
  expiresAt: integration.auth.expiresAt
});

export default mongoose.model<IIntegration>('Integration', IntegrationSchema);

