import { Channel, resolveChannel } from '../../types/channel';
import { ChannelAdapter } from './types';
import instagramAdapter from './instagram.adapter';
import whatsappAdapter from './whatsapp.adapter';

const ADAPTERS: Record<Channel, ChannelAdapter> = {
  instagram: instagramAdapter,
  whatsapp: whatsappAdapter
};

/**
 * Pick the adapter for a stored channel value.
 *
 * Undefined resolves to Instagram — every record written before this change
 * has no channel field, and they must keep sending exactly as before.
 */
export function getChannelAdapter(channel?: string | null): ChannelAdapter {
  return ADAPTERS[resolveChannel(channel)];
}

export { instagramAdapter, whatsappAdapter };
export * from './types';
