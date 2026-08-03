import { ChannelSendError } from './types';

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';
const GRAPH_HOST = 'https://graph.facebook.com';

/**
 * Meta error codes that will never succeed on retry for this message.
 *
 * 131047/131051 are the 24h customer-service-window rejections — the whole point
 * of tracking lastInboundAt. 131026 is "recipient cannot receive" (not on
 * WhatsApp, or blocked us). 132000-series are template mismatches, out of scope
 * for the MVP but still terminal if one ever arrives. Retrying any of these
 * burns quota and delays the queue behind a message that is already dead.
 */
const PERMANENT_ERROR_CODES = new Set([
  131026, // Message undeliverable — recipient not on WhatsApp / cannot receive
  131047, // Re-engagement required — outside 24h window
  131051, // Unsupported message type
  131052, // Media download error
  132000, // Template param count mismatch
  132001, // Template does not exist
  132005, // Template hydrated text too long
  132007, // Template format character policy violated
  132012, // Template parameter format mismatch
  133010, // Phone number not registered
]);

/**
 * Errors that mean "the token is bad", surfaced with code 'auth' so the sender
 * worker's error history records the reason rather than a generic send failure.
 */
const AUTH_ERROR_CODES = new Set([0, 190, 102, 10, 200, 3]);

export interface WhatsappSendResponse {
  messaging_product: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string; message_status?: string }>;
}

export class WhatsappCloudApiService {
  /**
   * Send a plain text message through the Cloud API.
   *
   * `previewUrl` is off by default: link previews change how a message renders
   * and the AI writes the copy, so we do not want an unreviewed preview card
   * attached to outbound sales messages.
   */
  async sendTextMessage(params: {
    phoneNumberId: string;
    accessToken: string;
    to: string;
    text: string;
    previewUrl?: boolean;
  }): Promise<WhatsappSendResponse> {
    const { phoneNumberId, accessToken, to, text, previewUrl = false } = params;

    const url = `${GRAPH_HOST}/${GRAPH_VERSION}/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: previewUrl, body: text }
    };

    console.log(`📤 [WhatsApp Cloud API] Sending text to ${maskWaId(to)} via phoneNumberId ${phoneNumberId}`);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      // Network-level failure — always worth a retry.
      const message = error instanceof Error ? error.message : String(error);
      throw new ChannelSendError(`WhatsApp Cloud API request failed: ${message}`, {
        permanent: false,
        code: 'network'
      });
    }

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const metaError = data?.error ?? {};
      const code = Number(metaError.code);
      const subcode = Number(metaError.error_subcode);
      const detail = metaError.error_data?.details || metaError.message || JSON.stringify(data).slice(0, 300);

      const permanent = PERMANENT_ERROR_CODES.has(code) || PERMANENT_ERROR_CODES.has(subcode);
      const isAuth = AUTH_ERROR_CODES.has(code);

      console.error(
        `❌ [WhatsApp Cloud API] ${response.status} code=${code} subcode=${subcode || '-'} permanent=${permanent}: ${detail}`
      );

      throw new ChannelSendError(`WhatsApp API error ${code || response.status}: ${detail}`, {
        permanent,
        code: isAuth ? 'auth' : permanent ? `wa_${code || response.status}` : 'send'
      });
    }

    const messageId = data?.messages?.[0]?.id;
    console.log(`✅ [WhatsApp Cloud API] Sent, wamid: ${messageId ?? 'none returned'}`);
    return data as WhatsappSendResponse;
  }

  /**
   * Mark an inbound message as read (blue ticks). Best-effort: a failure here
   * must never fail the inbound pipeline, so it resolves false instead of
   * throwing.
   */
  async markAsRead(params: {
    phoneNumberId: string;
    accessToken: string;
    messageId: string;
  }): Promise<boolean> {
    const { phoneNumberId, accessToken, messageId } = params;
    const url = `${GRAPH_HOST}/${GRAPH_VERSION}/${phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        })
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.warn(`⚠️ [WhatsApp Cloud API] markAsRead failed (${response.status}): ${body.slice(0, 200)}`);
        return false;
      }
      return true;
    } catch (error) {
      console.warn('⚠️ [WhatsApp Cloud API] markAsRead error:', error);
      return false;
    }
  }

  /** Verify a token/phone number pair is live. Used by the test-connection route. */
  async testConnection(params: { phoneNumberId: string; accessToken: string }): Promise<{
    ok: boolean;
    displayPhoneNumber?: string;
    verifiedName?: string;
    error?: string;
  }> {
    const { phoneNumberId, accessToken } = params;
    const url = `${GRAPH_HOST}/${GRAPH_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`;

    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { ok: false, error: data?.error?.message || `HTTP ${response.status}` };
      }

      return {
        ok: true,
        displayPhoneNumber: data.display_phone_number,
        verifiedName: data.verified_name
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

/** Keep full phone numbers out of logs — last 4 digits are enough to trace. */
export function maskWaId(waId: string): string {
  if (!waId || waId.length <= 4) return '***';
  return `***${waId.slice(-4)}`;
}

export default new WhatsappCloudApiService();
