import crypto from 'crypto';
import Contact, { IContact } from '../models/contact.model';
import Conversation, { IConversation } from '../models/conversation.model';
import Message, { IMessage } from '../models/message.model';
import WhatsappAccount, { IWhatsappAccount } from '../models/whatsappAccount.model';
import debounceWorkerService from './debounceWorker.service';
import whatsappCloudApi, { maskWaId } from './channels/whatsappCloudApi.service';
import { notifyError } from '../utils/slack';

/** Meta status values, ranked so out-of-order callbacks cannot regress state. */
const STATUS_RANK: Record<string, number> = {
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4 // terminal — always wins
};

export interface WhatsappInboundMessage {
  wamid: string;
  from: string; // wa_id — digits only
  phoneNumberId: string;
  timestamp: Date;
  text: string;
  type: string;
  profileName?: string;
}

export interface WhatsappStatusUpdate {
  wamid: string;
  status: string;
  timestamp: Date;
  recipientId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export class WhatsappWebhookService {
  private verifyToken: string;
  private appSecret: string;

  constructor() {
    this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || '';
    // Meta signs with the APP secret, which is app-wide — the same app can own
    // both the Instagram and WhatsApp products, so fall back to a shared
    // META_APP_SECRET before giving up.
    this.appSecret = process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET || '';
  }

  /**
   * Validate X-Hub-Signature-256 over the RAW request body.
   *
   * Re-serialized JSON will not match: key order and whitespace are part of what
   * Meta signed. index.ts captures req.rawBody for exactly this reason.
   */
  async validateSignature(payload: string, signature: string): Promise<boolean> {
    try {
      if (!this.appSecret) {
        console.error('❌ [WhatsApp Webhook] No app secret configured — refusing to process unsigned webhook');
        return false;
      }
      if (!signature) return false;

      const expected = 'sha256=' + crypto
        .createHmac('sha256', this.appSecret)
        .update(payload)
        .digest('hex');

      const received = Buffer.from(signature);
      const expectedBuf = Buffer.from(expected);

      // timingSafeEqual throws on length mismatch — check first so a malformed
      // header returns false instead of blowing up the request.
      if (received.length !== expectedBuf.length) return false;

      return crypto.timingSafeEqual(received, expectedBuf);
    } catch (error) {
      console.error('❌ [WhatsApp Webhook] Error validating signature:', error);
      return false;
    }
  }

  /** Handle Meta's GET verification handshake. */
  handleVerification(mode: string, token: string, challenge: string): string | null {
    const expected = this.verifyToken;
    console.log('🔍 [WhatsApp Webhook] Verification request:', {
      mode,
      tokenPresent: Boolean(token),
      challengePresent: Boolean(challenge),
      match: token === expected
    });

    if (mode === 'subscribe' && expected && token === expected) {
      console.log('✅ [WhatsApp Webhook] Verified successfully');
      return challenge;
    }

    console.error('❌ [WhatsApp Webhook] Verification failed');
    return null;
  }

  /**
   * Entry point for a webhook payload. Fans out to message and status handling.
   * Never throws — the route has already answered 200 to stop Meta retrying.
   */
  async handleWebhook(payload: any): Promise<void> {
    try {
      if (payload?.object !== 'whatsapp_business_account') {
        console.log(`⚠️ [WhatsApp Webhook] Ignoring payload with object=${payload?.object}`);
        return;
      }

      for (const entry of payload.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field !== 'messages') {
            console.log(`⚠️ [WhatsApp Webhook] Ignoring change field: ${change.field}`);
            continue;
          }
          await this.processChange(change.value ?? {});
        }
      }
    } catch (error) {
      console.error('❌ [WhatsApp Webhook] Error handling webhook:', error);
      notifyError({ service: 'WhatsAppWebhook', message: 'Error handling webhook payload', error });
    }
  }

  private async processChange(value: any): Promise<void> {
    const phoneNumberId = value?.metadata?.phone_number_id;
    if (!phoneNumberId) {
      console.error('❌ [WhatsApp Webhook] Change has no metadata.phone_number_id — cannot route');
      return;
    }

    const account = await WhatsappAccount.findOne({ phoneNumberId, isActive: true });
    if (!account) {
      console.error(`❌ [WhatsApp Webhook] No active WhatsApp account for phoneNumberId ${phoneNumberId} — message skipped`);
      notifyError({
        service: 'WhatsAppWebhook',
        message: 'Unregistered phone_number_id — inbound skipped',
        context: { phoneNumberId }
      });
      return;
    }

    // Delivery/read receipts for messages we sent.
    for (const status of value.statuses ?? []) {
      await this.processStatus(this.parseStatus(status));
    }

    // Inbound messages from contacts.
    const profileNames = new Map<string, string>();
    for (const contact of value.contacts ?? []) {
      if (contact?.wa_id && contact?.profile?.name) {
        profileNames.set(contact.wa_id, contact.profile.name);
      }
    }

    for (const rawMessage of value.messages ?? []) {
      const parsed = this.parseInboundMessage(rawMessage, phoneNumberId, profileNames);
      if (!parsed) continue;
      await this.processInboundMessage(parsed, account);
    }
  }

  /**
   * Normalize a raw Meta message.
   *
   * Non-text types are deliberately out of scope for the MVP, but they still get
   * a placeholder body so the conversation shows that *something* arrived rather
   * than silently skipping a turn the contact can see in their own chat.
   */
  private parseInboundMessage(
    raw: any,
    phoneNumberId: string,
    profileNames: Map<string, string>
  ): WhatsappInboundMessage | null {
    if (!raw?.id || !raw?.from) {
      console.warn('⚠️ [WhatsApp Webhook] Message without id/from — skipping');
      return null;
    }

    const type = raw.type ?? 'unknown';
    let text = '';

    if (type === 'text') {
      text = raw.text?.body ?? '';
    } else if (type === 'button') {
      text = raw.button?.text ?? '';
    } else if (type === 'interactive') {
      text = raw.interactive?.button_reply?.title ?? raw.interactive?.list_reply?.title ?? '';
    } else {
      text = `[${type}]`;
    }

    if (!text.trim()) {
      console.warn(`⚠️ [WhatsApp Webhook] Message ${raw.id} of type ${type} has no usable text — skipping`);
      return null;
    }

    return {
      wamid: raw.id,
      from: raw.from,
      phoneNumberId,
      // Meta sends UNIX seconds as a string. Multiplying is not optional: without
      // it every message lands in 1970 and the debounce window math inverts.
      timestamp: this.parseTimestamp(raw.timestamp),
      text,
      type,
      profileName: profileNames.get(raw.from)
    };
  }

  private parseStatus(raw: any): WhatsappStatusUpdate {
    const error = raw?.errors?.[0];
    return {
      wamid: raw?.id,
      status: raw?.status,
      timestamp: this.parseTimestamp(raw?.timestamp),
      recipientId: raw?.recipient_id,
      errorCode: error?.code != null ? String(error.code) : undefined,
      errorMessage: error?.title || error?.message || error?.error_data?.details
    };
  }

  /** UNIX seconds (string or number) → Date, falling back to now when absent. */
  private parseTimestamp(value: any): Date {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return new Date();
    const date = new Date(seconds * 1000);
    const year = date.getFullYear();
    if (year < 2020 || year > 2100) return new Date();
    return date;
  }

  /**
   * Persist an inbound message and hand it to the shared AI pipeline.
   *
   * Deduplication is the `mid` unique index: a replayed webhook (Meta retries
   * whenever it does not see a fast 200) finds the message already stored and
   * returns before anything else runs — no second contact, no second AI reply.
   */
  private async processInboundMessage(
    inbound: WhatsappInboundMessage,
    account: IWhatsappAccount
  ): Promise<void> {
    try {
      console.log(`📨 [WhatsApp Webhook] Inbound ${inbound.type} from ${maskWaId(inbound.from)}, wamid ${inbound.wamid}`);

      const existing = await Message.findOne({ mid: inbound.wamid });
      if (existing) {
        console.log(`⚠️ [WhatsApp Dedup] Message ${inbound.wamid} already stored — skipping duplicate webhook`);
        return;
      }

      const contact = await this.upsertContact(inbound);
      const conversation = await this.getOrCreateConversation(contact.id, account);

      const message = await this.createMessage(inbound, conversation.id, contact.id, account);

      await this.updateConversationOnInbound(conversation.id, inbound);

      // Best-effort read receipt. Failure here must not affect the pipeline.
      void whatsappCloudApi.markAsRead({
        phoneNumberId: account.phoneNumberId,
        accessToken: account.accessToken,
        messageId: inbound.wamid
      });

      // Same entry point Instagram uses — debounce, AI, scoring, milestones and
      // the outbound queue all run unchanged from here on.
      try {
        await debounceWorkerService.triggerMessageCollection(conversation.id, message);
        console.log(`🎯 [WhatsApp Webhook] Triggered message collection for ${message.id}`);
      } catch (error) {
        console.error('❌ [WhatsApp Webhook] Error triggering message collection:', error);
      }

      console.log(`✅ [WhatsApp Webhook] Inbound message processed: ${message.id}`);
    } catch (error) {
      // A duplicate key here means two webhook deliveries raced past the
      // findOne check. The unique index is the real guarantee; this is the
      // expected, harmless outcome of that race.
      if ((error as any)?.code === 11000) {
        console.log(`⚠️ [WhatsApp Dedup] Concurrent insert for ${inbound.wamid} rejected by unique index — safe to ignore`);
        return;
      }
      console.error('❌ [WhatsApp Webhook] Error processing inbound message:', error);
      notifyError({
        service: 'WhatsAppWebhook',
        message: 'Error processing inbound WhatsApp message',
        error,
        context: { wamid: inbound.wamid }
      });
    }
  }

  private async upsertContact(inbound: WhatsappInboundMessage): Promise<IContact> {
    let contact = await Contact.findOne({ waId: inbound.from, channel: 'whatsapp' });

    if (!contact) {
      console.log(`👤 [WhatsApp Webhook] Creating contact for ${maskWaId(inbound.from)}`);
      contact = new Contact({
        waId: inbound.from,
        // `phone` mirrors waId in E.164 for display and for the downstream
        // contact extractor, which already reads this field.
        phone: `+${inbound.from}`,
        channel: 'whatsapp',
        name: inbound.profileName,
        metadata: {
          lastSeen: inbound.timestamp,
          messageCount: 1
        },
        lastActivity: inbound.timestamp
      });
      await contact.save();
      console.log(`✅ [WhatsApp Webhook] Created contact ${contact.id}`);
      return contact;
    }

    contact.metadata.lastSeen = inbound.timestamp;
    contact.metadata.messageCount = (contact.metadata.messageCount ?? 0) + 1;
    contact.lastActivity = inbound.timestamp;
    // Contacts can rename themselves; keep the display name current, but never
    // blank an existing name because a payload omitted the profile block.
    if (inbound.profileName && contact.name !== inbound.profileName) {
      contact.name = inbound.profileName;
    }
    await contact.save();
    return contact;
  }

  private async getOrCreateConversation(
    contactId: string,
    account: IWhatsappAccount
  ): Promise<IConversation> {
    let conversation = await Conversation.findOne({
      contactId,
      accountId: account.phoneNumberId,
      channel: 'whatsapp',
      status: { $in: ['open', 'scheduled'] }
    });

    if (conversation) return conversation;

    const defaultAgentEnabled = account.settings?.defaultAgentEnabled ?? false;
    console.log(`💬 [WhatsApp Webhook] Creating conversation for contact ${contactId} (aiEnabled=${defaultAgentEnabled})`);

    conversation = new Conversation({
      contactId,
      accountId: account.phoneNumberId,
      channel: 'whatsapp',
      status: 'open',
      timestamps: {
        createdAt: new Date(),
        lastUserMessage: new Date(),
        lastActivity: new Date()
      },
      context: { urgency: 'medium' },
      metrics: { totalMessages: 0, userMessages: 0, botMessages: 0 },
      settings: { aiEnabled: defaultAgentEnabled },
      messageCount: 0,
      unreadCount: 0
    });

    await conversation.save();
    console.log(`✅ [WhatsApp Webhook] Created conversation ${conversation.id}`);
    return conversation;
  }

  private async createMessage(
    inbound: WhatsappInboundMessage,
    conversationId: string,
    contactId: string,
    account: IWhatsappAccount
  ): Promise<IMessage> {
    const message = new Message({
      mid: inbound.wamid,
      conversationId,
      contactId,
      accountId: account.phoneNumberId,
      channel: 'whatsapp',
      recipientId: account.phoneNumberId,
      role: 'user',
      content: { text: inbound.text },
      metadata: {
        timestamp: inbound.timestamp,
        processed: false,
        aiGenerated: false,
        isManual: false
      },
      status: 'received',
      deliveryConfirmed: true // arrival of the webhook is the confirmation
    });

    await message.save();
    return message;
  }

  /**
   * Advance conversation counters and, critically, stamp lastInboundAt — the
   * marker the 24h service window is measured from.
   */
  private async updateConversationOnInbound(
    conversationId: string,
    inbound: WhatsappInboundMessage
  ): Promise<void> {
    try {
      await Conversation.updateOne(
        { _id: conversationId },
        {
          $inc: {
            'metrics.totalMessages': 1,
            'metrics.userMessages': 1,
            messageCount: 1,
            unreadCount: 1
          },
          $set: {
            'timestamps.lastUserMessage': inbound.timestamp,
            'timestamps.lastInboundAt': inbound.timestamp,
            'timestamps.lastActivity': inbound.timestamp
          }
        }
      );
    } catch (error) {
      console.error('❌ [WhatsApp Webhook] Error updating conversation on inbound:', error);
    }
  }

  /**
   * Apply a delivery/read/failure receipt to the message we sent.
   *
   * Meta does not guarantee ordering, so a late `sent` can arrive after `read`.
   * Statuses are ranked and only ever move forward; without that, a stale
   * callback would quietly downgrade a message that was already read.
   */
  async processStatus(update: WhatsappStatusUpdate): Promise<void> {
    try {
      if (!update.wamid || !update.status) return;

      const message = await Message.findOne({ 'metadata.whatsappResponse.messageId': update.wamid });
      if (!message) {
        console.log(`⚠️ [WhatsApp Status] No message found for wamid ${update.wamid} — ignoring ${update.status}`);
        return;
      }

      const currentStatus = message.metadata?.whatsappResponse?.status;
      const currentRank = STATUS_RANK[currentStatus ?? ''] ?? 0;
      const incomingRank = STATUS_RANK[update.status] ?? 0;

      if (incomingRank <= currentRank) {
        console.log(`⏭️ [WhatsApp Status] Ignoring out-of-order ${update.status} for ${update.wamid} (current: ${currentStatus})`);
        return;
      }

      const set: Record<string, any> = {
        'metadata.whatsappResponse.status': update.status,
        'metadata.whatsappResponse.timestamp': update.timestamp,
        status: update.status === 'failed' ? 'failed' : update.status
      };

      if (update.status === 'delivered' || update.status === 'read') {
        set.deliveryConfirmed = true;
        set.deliveryConfirmedAt = update.timestamp;
      }

      if (update.status === 'failed') {
        set['metadata.whatsappResponse.errorCode'] = update.errorCode;
        set['metadata.whatsappResponse.errorMessage'] = update.errorMessage;
        console.error(`❌ [WhatsApp Status] Message ${update.wamid} failed: ${update.errorCode} ${update.errorMessage ?? ''}`);
        notifyError({
          service: 'WhatsAppWebhook',
          message: 'Outbound WhatsApp message failed',
          context: { wamid: update.wamid, errorCode: update.errorCode, errorMessage: update.errorMessage }
        });
      }

      await Message.updateOne({ _id: message._id }, { $set: set });
      console.log(`✅ [WhatsApp Status] ${update.wamid} → ${update.status}`);
    } catch (error) {
      console.error('❌ [WhatsApp Status] Error processing status update:', error);
    }
  }
}

export default new WhatsappWebhookService();
