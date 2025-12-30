// @ts-nocheck
import { google, gmail_v1 } from 'googleapis';
import { tokenStore, TokenSet } from './tokenStore';

export type GmailAgentMode = 'dry_run' | 'process';

export interface GmailAgentRunOptions {
  maxEmails?: number;
  mode?: GmailAgentMode;
}

export interface GmailAgentRunResult {
  success: boolean;
  mode: GmailAgentMode;
  inspected: number;
  draftsCreated: number;
  labelsApplied: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
}

const processedLabelName = process.env.GMAIL_AGENT_PROCESSED_LABEL || 'GMAIL_AGENT_PROCESSED';

let lastRunAt: Date | null = null;

const base64UrlEncode = (input: string): string => {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const buildOAuthClient = (tokens: TokenSet) => {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiryDate
  });

  return client;
};

const ensureProcessedLabel = async (gmail: gmail_v1.Gmail): Promise<string> => {
  const list = await gmail.users.labels.list({ userId: 'me' });
  const existing = list.data.labels?.find((l) => l.name === processedLabelName);
  if (existing?.id) return existing.id;

  const created = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: processedLabelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show'
    }
  });
  return created.data.id || '';
};

const fetchMessages = async (
  gmail: gmail_v1.Gmail,
  maxEmails: number
): Promise<gmail_v1.Schema$Message[]> => {
  const list = await gmail.users.messages.list({
    userId: 'me',
    maxResults: maxEmails,
    q: '-in:TRASH -in:SPAM'
  });
  const messages = list.data.messages || [];

  const detailed: google.gmail_v1.Schema$Message[] = [];
  for (const msg of messages) {
    if (!msg.id) continue;
    const full = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'To', 'Date']
    });
    detailed.push(full.data);
  }
  return detailed;
};

const createDraft = async (
  gmail: gmail_v1.Gmail,
  message: gmail_v1.Schema$Message
): Promise<void> => {
  const subject =
    message.payload?.headers?.find((h) => h.name?.toLowerCase() === 'subject')?.value || '(sin asunto)';
  const from =
    message.payload?.headers?.find((h) => h.name?.toLowerCase() === 'from')?.value || '(desconocido)';

  const body = [
    `Subject: Re: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    `Hola,`,
    '',
    `Este es un borrador automático generado por Gmail Agent para el hilo recibido de ${from}.`,
    `Por favor revisa y envía cuando estés listo.`,
    '',
    '--',
    'Gmail Agent (draft-only mode)'
  ].join('\r\n');

  const raw = base64UrlEncode(body);

  await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw }
    }
  });
};

const applyLabel = async (
  gmail: gmail_v1.Gmail,
  messageId: string,
  labelId: string
): Promise<void> => {
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: [labelId]
    }
  });
};

export class GmailAgentRunner {
  async run(options: GmailAgentRunOptions): Promise<GmailAgentRunResult> {
    const startedAt = new Date();
    lastRunAt = startedAt;
    const maxEmails = options.maxEmails || 10;
    const mode: GmailAgentMode = options.mode || 'dry_run';
    const errors: string[] = [];
    let draftsCreated = 0;
    let labelsApplied = 0;

    const tokenSet = tokenStore.get();
    if (!tokenSet) {
      const err = 'Gmail tokens not configured (GMAIL_ACCESS_TOKEN missing)';
      console.error(`❌ [GmailAgent] ${err}`);
      throw new Error(err);
    }

    try {
      console.log(`📧 [GmailAgent] Run started mode=${mode} maxEmails=${maxEmails}`);
      const auth = buildOAuthClient(tokenSet);
      const gmail = google.gmail({ version: 'v1', auth });

      // Ensure label exists once
      const labelId = await ensureProcessedLabel(gmail);

      const messages = await fetchMessages(gmail, maxEmails);
      console.log(`📧 [GmailAgent] Retrieved ${messages.length} message(s)`);

      for (const message of messages) {
        const messageId = message.id;
        if (!messageId) continue;

        try {
          if (mode === 'process') {
            await createDraft(gmail, message);
            draftsCreated += 1;
            if (labelId) {
              await applyLabel(gmail, messageId, labelId);
              labelsApplied += 1;
            }
          }
        } catch (inner) {
          const msg = (inner as Error)?.message || 'Unknown message error';
          console.error(`❌ [GmailAgent] Error handling message ${messageId}:`, msg);
          errors.push(`message ${messageId}: ${msg}`);
        }
      }

      const finishedAt = new Date();
      console.log(
        `✅ [GmailAgent] Completed mode=${mode} inspected=${messages.length} drafts=${draftsCreated} labels=${labelsApplied}`
      );

      return {
        success: errors.length === 0,
        mode,
        inspected: messages.length,
        draftsCreated,
        labelsApplied,
        errors,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString()
      };
    } catch (error: any) {
      console.error('❌ [GmailAgent] Run failed:', error?.message || error);
      errors.push(error?.message || 'Unknown error');
      const finishedAt = new Date();
      return {
        success: false,
        mode,
        inspected: 0,
        draftsCreated,
        labelsApplied,
        errors,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString()
      };
    }
  }

  health() {
    return {
      enabled: process.env.ENABLE_GMAIL_AGENT === 'true',
      lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
      processedLabel: processedLabelName
    };
  }
}

export const gmailAgentRunner = new GmailAgentRunner();

