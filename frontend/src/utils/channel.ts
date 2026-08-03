export type Channel = 'instagram' | 'whatsapp';

/**
 * Resolve a conversation's channel.
 *
 * Everything created before WhatsApp existed has no `channel` field, so an
 * absent value means Instagram — never "unknown".
 */
export const resolveChannel = (value?: string | null): Channel =>
  value === 'whatsapp' ? 'whatsapp' : 'instagram';

export const CHANNEL_LABEL: Record<Channel, string> = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp'
};

/** API prefix per channel — the two channels have separate route trees. */
export const CHANNEL_API_BASE: Record<Channel, string> = {
  instagram: '/api/instagram',
  whatsapp: '/api/whatsapp'
};

/** Tailwind classes for the channel badge. */
export const CHANNEL_BADGE_CLASS: Record<Channel, string> = {
  instagram: 'bg-pink-100 text-pink-700 border-pink-200',
  whatsapp: 'bg-green-100 text-green-700 border-green-200'
};

/**
 * Contact handle to show for a channel — an Instagram username means nothing
 * on a WhatsApp thread, and a masked phone number means nothing on Instagram.
 */
export const channelHandle = (channel: Channel, contact: any): string => {
  if (channel === 'whatsapp') {
    const waId = contact?.waId || contact?.phone;
    if (!waId) return 'WhatsApp';
    const digits = String(waId).replace(/\D/g, '');
    return digits.length > 4 ? `+…${digits.slice(-4)}` : 'WhatsApp';
  }
  const username = contact?.username?.replace?.(/^@/, '');
  if (username) return `@${username}`;
  const psid = contact?.psid;
  return psid ? `Instagram ${String(psid).slice(-6)}` : 'Contacto sin nombre';
};

export interface ServiceWindow {
  open: boolean;
  lastInboundAt: string | null;
  hoursSinceLastInbound: number | null;
}

/**
 * Whether free-form text can be delivered right now.
 *
 * Only WhatsApp has a hard, Meta-enforced window; Instagram's own 24h rule is
 * handled server-side at send time, so the composer stays open there.
 */
export const canSendFreeform = (channel: Channel, serviceWindow?: ServiceWindow | null): boolean => {
  if (channel !== 'whatsapp') return true;
  return serviceWindow?.open !== false;
};

export const serviceWindowMessage = (serviceWindow?: ServiceWindow | null): string => {
  if (!serviceWindow || serviceWindow.open) return '';
  if (serviceWindow.hoursSinceLastInbound == null) {
    return 'Sin mensajes entrantes registrados: WhatsApp no permite escribir primero sin una plantilla aprobada.';
  }
  return `La ventana de 24h de WhatsApp está cerrada (último mensaje del contacto hace ${serviceWindow.hoursSinceLastInbound}h). ` +
    'No se puede enviar texto libre hasta que el contacto vuelva a escribir.';
};
