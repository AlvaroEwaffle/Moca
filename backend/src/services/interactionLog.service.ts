import mongoose from 'mongoose';
import InteractionLog, {
  IInteractionLog,
  InteractionChannel,
  InteractionDirection,
  InteractionMessageType
} from '../models/interactionLog.model';

export interface InteractionLogPayload {
  userId: string;
  agentId?: string;
  conversationId?: string;
  contactId?: string;
  integrationId?: string;
  channel: InteractionChannel;
  direction: InteractionDirection;
  messageType?: InteractionMessageType;
  textPreview?: string;
  payloadSummary?: string;
  counts?: {
    attachments?: number;
    tokens?: number;
  };
  metadata?: Record<string, any>;
}

class InteractionLogService {
  async recordInteraction(payload: InteractionLogPayload): Promise<IInteractionLog> {
    const {
      userId,
      agentId,
      conversationId,
      contactId,
      integrationId,
      channel,
      direction,
      messageType = 'text',
      textPreview,
      payloadSummary,
      counts,
      metadata
    } = payload;

    const record = new InteractionLog({
      userId: new mongoose.Types.ObjectId(userId),
      agentId: agentId ? new mongoose.Types.ObjectId(agentId) : undefined,
      conversationId: conversationId ? new mongoose.Types.ObjectId(conversationId) : undefined,
      contactId: contactId ? new mongoose.Types.ObjectId(contactId) : undefined,
      integrationId: integrationId ? new mongoose.Types.ObjectId(integrationId) : undefined,
      channel,
      direction,
      messageType,
      textPreview: textPreview?.slice(0, 240),
      payloadSummary: payloadSummary?.slice(0, 500),
      counts,
      metadata
    });

    return record.save();
  }
}

export default new InteractionLogService();

