import WhatsappAccount from '../../models/whatsappAccount.model';
import { Channel } from '../../types/channel';
import { ChannelAdapter, ChannelAccount, ChannelSendError, SendResult, SendTextParams } from './types';
import whatsappCloudApi, { maskWaId } from './whatsappCloudApi.service';

/** Meta's customer service window: 24h from the contact's last inbound message. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Decide whether free-form text is allowed right now.
 *
 * Exported so the 24h rule can be unit-tested and reused by the UI without
 * anyone re-deriving the arithmetic. `lastInboundAt` is the authoritative
 * marker; lastUserMessage is accepted as a fallback for conversations created
 * before the field existed.
 */
export function isWithinServiceWindow(conversation: any, now: Date = new Date()): {
  allowed: boolean;
  lastInboundAt?: Date;
  hoursSince?: number;
} {
  const raw = conversation?.timestamps?.lastInboundAt || conversation?.timestamps?.lastUserMessage;
  if (!raw) return { allowed: false };

  const lastInboundAt = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(lastInboundAt.getTime())) return { allowed: false };

  const elapsed = now.getTime() - lastInboundAt.getTime();
  return {
    allowed: elapsed < SERVICE_WINDOW_MS,
    lastInboundAt,
    hoursSince: Math.floor((elapsed / (60 * 60 * 1000)) * 10) / 10
  };
}

class WhatsappAdapter implements ChannelAdapter {
  readonly channel: Channel = 'whatsapp';

  async getAccount(accountId: string): Promise<ChannelAccount | null> {
    const account = await WhatsappAccount.findOne({ phoneNumberId: accountId, isActive: true });
    if (!account) return null;

    return {
      accountId: account.phoneNumberId,
      accountName: account.accountName,
      rateLimits: {
        messagesPerSecond: account.rateLimits?.messagesPerSecond ?? 0,
        userCooldown: account.rateLimits?.userCooldown ?? 0
      },
      raw: account
    };
  }

  describeRecipient(contact: any): string {
    return `wa_id ${maskWaId(contact?.waId ?? '')}`;
  }

  async sendText({ account, contact, conversation, text }: SendTextParams): Promise<SendResult> {
    if (!contact?.waId) {
      throw new ChannelSendError('Contact has no WhatsApp wa_id', { permanent: true, code: 'no_recipient' });
    }

    // The window is checked BEFORE the call, not inferred from the rejection.
    // Meta counts a rejected send against the number's quality rating, so
    // "try it and see" is not free — and the resulting error is terminal
    // anyway, which would waste the retry budget for nothing.
    const window = isWithinServiceWindow(conversation);
    if (!window.allowed) {
      const detail = window.lastInboundAt
        ? `last inbound ${window.hoursSince}h ago (${window.lastInboundAt.toISOString()})`
        : 'no inbound message on record';

      throw new ChannelSendError(
        `WhatsApp 24h service window closed — ${detail}. ` +
        `Free-form text cannot be delivered; an approved template is required (out of scope for this MVP).`,
        { permanent: true, code: 'window_closed' }
      );
    }

    const token = account.raw?.accessToken;
    if (!token) {
      throw new ChannelSendError(`WhatsApp account ${account.accountName} has no access token`, {
        permanent: false,
        code: 'auth'
      });
    }

    const response = await whatsappCloudApi.sendTextMessage({
      phoneNumberId: account.accountId,
      accessToken: token,
      to: contact.waId,
      text
    });

    return { externalId: response?.messages?.[0]?.id, raw: response };
  }

  buildSentUpdate(externalId?: string): Record<string, any> {
    if (!externalId) return {};
    return {
      'metadata.whatsappResponse.messageId': externalId,
      'metadata.whatsappResponse.status': 'sent',
      'metadata.whatsappResponse.timestamp': new Date()
    };
  }
}

export default new WhatsappAdapter();
