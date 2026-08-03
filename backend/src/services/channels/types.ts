import { Channel } from '../../types/channel';

/**
 * The subset of a channel account the sender worker actually needs. Both
 * InstagramAccount and WhatsappAccount are projected onto this shape so rate
 * limiting and logging stop caring which collection the account came from.
 */
export interface ChannelAccount {
  accountId: string;
  accountName: string;
  rateLimits: {
    messagesPerSecond: number;
    userCooldown: number;
  };
  /** The underlying mongoose document, for adapter-internal use only. */
  raw: any;
}

export interface SendTextParams {
  account: ChannelAccount;
  /** Contact document — the adapter picks its own address field off it. */
  contact: any;
  /** Conversation document, or null for synthetic sends with no conversation. */
  conversation: any | null;
  text: string;
}

export interface SendResult {
  /** Meta's id for the sent message (message_id / wamid.*), when returned. */
  externalId?: string;
  raw?: any;
}

/**
 * A send failure with an explicit retry verdict.
 *
 * `permanent` is the important part. The pre-channel sender worker inferred it
 * by string-matching Instagram error text at the call site; each adapter now
 * owns that judgement for its own API, so a WhatsApp 24h-window rejection dies
 * immediately instead of burning three retries against a wall.
 */
export class ChannelSendError extends Error {
  readonly permanent: boolean;
  readonly code: string;

  constructor(message: string, options: { permanent?: boolean; code?: string } = {}) {
    super(message);
    this.name = 'ChannelSendError';
    this.permanent = options.permanent ?? false;
    this.code = options.code ?? 'send';
  }
}

export interface ChannelAdapter {
  readonly channel: Channel;

  /** Resolve and validate the sending account. Returns null when unusable. */
  getAccount(accountId: string): Promise<ChannelAccount | null>;

  /** Human-readable send target, for logs. Never used for routing. */
  describeRecipient(contact: any): string;

  /**
   * Send plain text. Throws ChannelSendError on failure; `permanent: true`
   * means the sender worker must not retry.
   */
  sendText(params: SendTextParams): Promise<SendResult>;

  /**
   * Mongo `$set` fragment recording a successful send on the Message document.
   * Each channel writes its own metadata sub-object so one id namespace never
   * overwrites the other.
   */
  buildSentUpdate(externalId?: string): Record<string, any>;
}
