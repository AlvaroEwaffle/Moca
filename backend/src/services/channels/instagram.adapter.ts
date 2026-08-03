import InstagramAccount from '../../models/instagramAccount.model';
import instagramService from '../instagramApi.service';
import { Channel } from '../../types/channel';
import { ChannelAdapter, ChannelAccount, ChannelSendError, SendResult, SendTextParams } from './types';

/**
 * Instagram behind the ChannelAdapter interface.
 *
 * This is a wrapper, not a rewrite: it calls the same instagramApi.service the
 * sender worker called directly before, in the same order, so Instagram sends
 * take exactly the same code path they always did. The only behaviour that moved
 * is the permanent-vs-retryable verdict, which used to be string matching inside
 * senderWorker and now lives here — with the same two strings.
 */
class InstagramAdapter implements ChannelAdapter {
  readonly channel: Channel = 'instagram';

  async getAccount(accountId: string): Promise<ChannelAccount | null> {
    const account = await InstagramAccount.findOne({ accountId });
    if (!account) return null;

    return {
      accountId: account.accountId,
      accountName: account.accountName,
      rateLimits: {
        messagesPerSecond: account.rateLimits?.messagesPerSecond ?? 0,
        userCooldown: account.rateLimits?.userCooldown ?? 0
      },
      raw: account
    };
  }

  describeRecipient(contact: any): string {
    return `PSID ${contact?.psid ?? 'unknown'}`;
  }

  async sendText({ account, contact, text }: SendTextParams): Promise<SendResult> {
    if (!contact?.psid) {
      throw new ChannelSendError('Contact has no Instagram PSID', { permanent: true, code: 'no_recipient' });
    }

    // initialize() handles token refresh and the Page fallback internally.
    const initialized = await instagramService.initialize(account.accountId);
    if (!initialized) {
      throw new ChannelSendError('Instagram service initialization failed', { code: 'auth' });
    }

    try {
      const response = await instagramService.sendTextMessage(contact.psid, text);
      return { externalId: response?.message_id, raw: response };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Preserved verbatim from the pre-adapter senderWorker: these two are the
      // only Instagram failures that must never be retried.
      if (message.includes('The requested user cannot be found')) {
        throw new ChannelSendError(message, { permanent: true, code: 'unknown_recipient' });
      }
      if (message.includes('outside of allowed window') || message.includes('error_subcode":2534022')) {
        throw new ChannelSendError(message, { permanent: true, code: 'window_expired' });
      }

      throw new ChannelSendError(message, {
        permanent: false,
        code: /token|OAuth|190|expired/i.test(message) ? 'auth' : 'send'
      });
    }
  }

  buildSentUpdate(externalId?: string): Record<string, any> {
    if (!externalId) return {};
    return {
      'metadata.instagramResponse.messageId': externalId,
      'metadata.instagramResponse.status': 'sent',
      'metadata.instagramResponse.timestamp': new Date(),
      'metadata.deliveryConfirmed': true
    };
  }
}

export default new InstagramAdapter();
