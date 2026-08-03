/**
 * Messaging channels the pipeline can carry.
 *
 * Instagram is the default everywhere: every Conversation/Message/OutboundQueue
 * written before WhatsApp existed has no `channel` field at all, so the schemas
 * default to 'instagram' and every read path treats undefined as Instagram. That
 * is what makes this migration additive — no backfill required.
 */
export type Channel = 'instagram' | 'whatsapp';

export const DEFAULT_CHANNEL: Channel = 'instagram';

export const CHANNELS: Channel[] = ['instagram', 'whatsapp'];

/** Normalize a possibly-undefined stored value to a concrete channel. */
export function resolveChannel(value?: string | null): Channel {
  return value === 'whatsapp' ? 'whatsapp' : DEFAULT_CHANNEL;
}
