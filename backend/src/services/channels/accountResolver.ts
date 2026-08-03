import InstagramAccount from '../../models/instagramAccount.model';
import WhatsappAccount from '../../models/whatsappAccount.model';
import { Channel, resolveChannel } from '../../types/channel';

/**
 * A channel account as the AI pipeline needs it.
 *
 * The debounce worker asks three things of an account: is it active, what is
 * the agent mode, and what is the prompt/tone. All of that exists identically
 * on both account models, so it is projected onto one shape here instead of
 * every caller branching on channel.
 */
export interface ResolvedAccount {
  channel: Channel;
  accountId: string;
  accountName: string;
  isActive: boolean;
  settings: {
    aiEnabled?: 'off' | 'test' | 'on' | boolean;
    defaultAgentEnabled?: boolean;
    systemPrompt?: string;
    toneOfVoice?: string;
    keyInformation?: string;
    fallbackRules?: string[];
    defaultResponse?: string;
    businessHours?: any;
    defaultMilestone?: any;
  };
  /**
   * Per-account MCP servers. Instagram-only for now — WhatsApp accounts fall
   * back to the global MCP config, which is the same behaviour an Instagram
   * account with no per-account servers already gets.
   */
  mcpTools?: { enabled: boolean; servers: any[] };
  fidelidappSlug?: string;
  raw: any;
}

/**
 * Load the account backing a conversation, whichever channel it belongs to.
 *
 * Callers used to query InstagramAccount directly and bail when it returned
 * null. For a WhatsApp conversation `accountId` is a phone number id that does
 * not exist in that collection — so that path silently refused to ever answer.
 */
export async function resolveAccount(
  accountId: string,
  channel?: string | null,
  options: { activeOnly?: boolean } = {}
): Promise<ResolvedAccount | null> {
  const resolved = resolveChannel(channel);

  if (resolved === 'whatsapp') {
    const query: Record<string, any> = { phoneNumberId: accountId };
    if (options.activeOnly) query.isActive = true;

    const account = await WhatsappAccount.findOne(query);
    if (!account) return null;

    return {
      channel: 'whatsapp',
      accountId: account.phoneNumberId,
      accountName: account.accountName,
      isActive: account.isActive,
      settings: account.settings ?? {},
      mcpTools: undefined,
      fidelidappSlug: account.fidelidappSlug,
      raw: account
    };
  }

  const query: Record<string, any> = { accountId };
  if (options.activeOnly) query.isActive = true;

  const account = await InstagramAccount.findOne(query);
  if (!account) return null;

  return {
    channel: 'instagram',
    accountId: account.accountId,
    accountName: account.accountName,
    isActive: account.isActive,
    settings: account.settings ?? ({} as any),
    mcpTools: account.mcpTools,
    fidelidappSlug: account.fidelidappSlug,
    raw: account
  };
}
