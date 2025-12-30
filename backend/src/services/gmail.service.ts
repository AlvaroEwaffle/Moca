// @ts-nocheck
import { google } from 'googleapis';
import Integration, { IIntegration } from '../models/integration.model';
import { revealTokens } from '../models/integration.model';
import { refreshGoogleTokens } from './googleOAuth.service';

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject?: string;
  from?: string;
  to?: string[];
  cc?: string[];
  date?: Date;
  body?: string;
  bodyHtml?: string;
  labels?: string[];
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;
}

export interface FetchEmailsOptions {
  maxResults?: number; // Max number of emails to fetch (default: 50)
  query?: string; // Gmail search query (e.g., "is:unread", "after:2024/1/1")
  labelIds?: string[]; // Specific label IDs to search (e.g., ["INBOX"])
  includeSpam?: boolean; // Whether to include spam emails (default: false)
}

/**
 * Get authenticated Gmail API client for a user's integration
 */
export const getGmailClient = async (userId: string): Promise<google.auth.OAuth2Client | null> => {
  try {
    const integration = await Integration.findOne({
      userId,
      type: 'gmail',
      status: 'connected'
    });

    if (!integration) {
      console.warn(`⚠️ [Gmail] No connected Gmail integration found for user ${userId}`);
      return null;
    }

    const { accessToken, refreshToken } = revealTokens(integration);

    if (!accessToken) {
      console.error(`❌ [Gmail] No access token found for user ${userId}`);
      return null;
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    // Try to refresh token if it's expired
    try {
      await oauth2Client.getAccessToken();
    } catch (error) {
      console.log(`🔄 [Gmail] Access token expired or invalid, attempting refresh...`);
      if (refreshToken) {
        try {
          const newTokens = await refreshGoogleTokens(refreshToken);
          oauth2Client.setCredentials({
            access_token: newTokens.accessToken,
            refresh_token: newTokens.refreshToken || refreshToken
          });

          // Update integration with new tokens
          integration.setTokens({
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken || refreshToken,
            expiresAt: newTokens.expiresAt
          });
          await integration.save();

          console.log(`✅ [Gmail] Tokens refreshed successfully`);
        } catch (refreshError: any) {
          console.error(`❌ [Gmail] Failed to refresh token:`, refreshError.message);
          throw new Error(`Token refresh failed: ${refreshError.message}`);
        }
      } else {
        console.error(`❌ [Gmail] No refresh token available for token refresh`);
        throw new Error('Access token expired and no refresh token available');
      }
    }

    return oauth2Client;
  } catch (error) {
    console.error(`❌ [Gmail] Error getting Gmail client for user ${userId}:`, error);
    return null;
  }
};

/**
 * Fetch list of email message IDs matching the query
 */
const listMessages = async (
  gmail: google.gmail_v1.Gmail,
  options: FetchEmailsOptions = {}
): Promise<string[]> => {
  const {
    maxResults = 50,
    query = '',
    labelIds = ['INBOX'],
    includeSpam = false
  } = options;

  try {
    // Build the query string
    let gmailQuery = query.trim();
    
    // Exclude spam and trash from query if not including spam
    if (!includeSpam) {
      const exclusions = '-in:SPAM -in:TRASH';
      if (gmailQuery) {
        gmailQuery = `${gmailQuery} ${exclusions}`;
      } else {
        gmailQuery = exclusions;
      }
    }

    // Prepare labelIds - use provided labels or default to INBOX if none specified
    const finalLabelIds = (labelIds && labelIds.length > 0) ? labelIds : ['INBOX'];

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: gmailQuery || undefined, // Only include query if it's not empty
      labelIds: finalLabelIds
    });

    const messages = response.data.messages || [];
    return messages.map((msg) => msg.id || '').filter(Boolean);
  } catch (error: any) {
    console.error(`❌ [Gmail] Error listing messages:`, error.message);
    throw error;
  }
};

/**
 * Fetch full email details by message ID
 */
const getMessage = async (
  gmail: google.gmail_v1.Gmail,
  messageId: string
): Promise<GmailMessage | null> => {
  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const message = response.data;
    if (!message) return null;

    // Parse headers
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => {
      const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
      return header?.value;
    };

    // Extract subject
    const subject = getHeader('Subject') || '';

    // Extract from/to/cc
    const from = getHeader('From') || '';
    const to = getHeader('To')?.split(',').map((e) => e.trim()) || [];
    const cc = getHeader('Cc')?.split(',').map((e) => e.trim()) || [];

    // Extract date
    const dateHeader = getHeader('Date');
    const date = dateHeader ? new Date(dateHeader) : new Date(Number(message.internalDate));

    // Extract labels
    const labels = message.labelIds || [];

    // Extract body content
    let body = '';
    let bodyHtml = '';

    const extractBody = (part: any): void => {
      if (part.body?.data) {
        const content = Buffer.from(part.body.data, 'base64').toString('utf-8');
        const mimeType = part.mimeType || '';

        if (mimeType === 'text/plain' && !body) {
          body = content;
        } else if (mimeType === 'text/html' && !bodyHtml) {
          bodyHtml = content;
        }
      }

      if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };

    if (message.payload) {
      extractBody(message.payload);
    }

    // Extract attachments info
    const attachments: Array<{
      filename: string;
      mimeType: string;
      size: number;
      attachmentId: string;
    }> = [];

    const extractAttachments = (part: any): void => {
      if (part.body?.attachmentId && part.filename) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId
        });
      }

      if (part.parts) {
        part.parts.forEach(extractAttachments);
      }
    };

    if (message.payload) {
      extractAttachments(message.payload);
    }

    return {
      id: message.id || '',
      threadId: message.threadId || '',
      snippet: message.snippet || '',
      subject,
      from,
      to,
      cc,
      date,
      body,
      bodyHtml,
      labels,
      attachments
    };
  } catch (error: any) {
    console.error(`❌ [Gmail] Error fetching message ${messageId}:`, error.message);
    return null;
  }
};

/**
 * Fetch emails for a user
 */
export const fetchEmails = async (
  userId: string,
  options: FetchEmailsOptions = {}
): Promise<GmailMessage[]> => {
  try {
    const oauth2Client = await getGmailClient(userId);
    if (!oauth2Client) {
      throw new Error('Gmail client not available');
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // List messages
    const messageIds = await listMessages(gmail, options);

    console.log(`📧 [Gmail] Found ${messageIds.length} messages for user ${userId}`);

    // Fetch full message details (limit concurrent requests)
    const messages: GmailMessage[] = [];
    const batchSize = 10;

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((messageId) => getMessage(gmail, messageId))
      );

      messages.push(...batchResults.filter((msg): msg is GmailMessage => msg !== null));

      // Small delay to avoid rate limiting
      if (i + batchSize < messageIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ [Gmail] Successfully fetched ${messages.length} emails for user ${userId}`);

    return messages;
  } catch (error: any) {
    console.error(`❌ [Gmail] Error fetching emails for user ${userId}:`, error.message);
    throw error;
  }
};

/**
 * Get Gmail profile information
 */
export const getGmailProfile = async (userId: string): Promise<{ email: string; name?: string } | null> => {
  try {
    const oauth2Client = await getGmailClient(userId);
    if (!oauth2Client) {
      return null;
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const response = await gmail.users.getProfile({
      userId: 'me'
    });

    return {
      email: response.data.emailAddress || '',
      name: undefined // Gmail API doesn't return name in profile
    };
  } catch (error: any) {
    console.error(`❌ [Gmail] Error getting profile for user ${userId}:`, error.message);
    return null;
  }
};

/**
 * Check if the USER has replied in a thread
 * Returns true if user has NOT replied (meaning we should create a draft to remind user to respond)
 */
export const hasNoUserResponse = async (
  userId: string,
  threadId: string,
  originalEmailDate: Date,
  originalFromEmail: string,
  daysWithoutResponse: number
): Promise<boolean> => {
  try {
    const oauth2Client = await getGmailClient(userId);
    if (!oauth2Client) {
      return false; // If we can't check, don't create draft
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const userProfile = await getGmailProfile(userId);
    
    if (!userProfile?.email) {
      return false;
    }

    const userEmail = userProfile.email.toLowerCase();

    // Get all messages in the thread
    const threadResponse = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full'
    });

    const thread = threadResponse.data;
    if (!thread.messages || thread.messages.length === 0) {
      return true; // No messages, so user hasn't replied
    }

    // Calculate the cutoff date (X days after original email)
    const cutoffDate = new Date(originalEmailDate);
    cutoffDate.setDate(cutoffDate.getDate() + daysWithoutResponse);
    const now = new Date();

    // Check if cutoff date has passed (we're past the waiting period)
    if (now < cutoffDate) {
      return false; // Still within waiting period, don't create draft yet
    }

    // Check all messages in the thread that came after the original email
    for (const message of thread.messages) {
      if (!message.payload?.headers) continue;

      const headers = message.payload.headers;
      const getHeader = (name: string) => {
        const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
        return header?.value;
      };

      const fromHeader = getHeader('From') || '';
      const fromEmail = fromHeader.toLowerCase();
      const dateHeader = getHeader('Date');
      const messageDate = dateHeader ? new Date(dateHeader) : new Date(Number(message.internalDate || 0));

      // Skip the original email itself
      if (messageDate <= originalEmailDate) continue;

      // Check if this is a reply from the user
      if (fromEmail.includes(userEmail) && !fromEmail.includes(originalFromEmail.toLowerCase())) {
        // Found a reply from the user after the original email
        console.log(`📧 [Gmail] User HAS replied in thread ${threadId} on ${messageDate.toISOString()}`);
        return false; // User HAS replied, so don't create draft
      }
    }

    // No replies found from the user
    console.log(`📧 [Gmail] User has NOT replied in thread ${threadId} within ${daysWithoutResponse} days - creating draft`);
    return true; // User hasn't replied, so we should create a draft
  } catch (error: any) {
    console.error(`❌ [Gmail] Error checking for user replies in thread ${threadId}:`, error.message);
    // On error, default to not creating draft to be safe
    return false;
  }
};

/**
 * Check if the OTHER PARTY has replied after the user replied
 * Returns true if other party has NOT replied (meaning we should create a follow-up draft)
 */
export const hasNoOtherPartyResponse = async (
  userId: string,
  threadId: string,
  originalEmailDate: Date,
  originalFromEmail: string,
  daysWithoutResponse: number
): Promise<boolean> => {
  try {
    const oauth2Client = await getGmailClient(userId);
    if (!oauth2Client) {
      return false; // If we can't check, don't create draft
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const userProfile = await getGmailProfile(userId);
    
    if (!userProfile?.email) {
      return false;
    }

    const userEmail = userProfile.email.toLowerCase();
    const originalFromEmailLower = originalFromEmail.toLowerCase();

    // Get all messages in the thread
    const threadResponse = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full'
    });

    const thread = threadResponse.data;
    if (!thread.messages || thread.messages.length === 0) {
      return false; // No messages, so can't check for other party response
    }

    // Find the last message from the user (to see when they replied)
    let lastUserReplyDate: Date | null = null;
    let userHasReplied = false;

    // First, find if user has replied and when
    for (const message of thread.messages) {
      if (!message.payload?.headers) continue;

      const headers = message.payload.headers;
      const getHeader = (name: string) => {
        const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
        return header?.value;
      };

      const fromHeader = getHeader('From') || '';
      const fromEmail = fromHeader.toLowerCase();
      const dateHeader = getHeader('Date');
      const messageDate = dateHeader ? new Date(dateHeader) : new Date(Number(message.internalDate || 0));

      // Check if this is a reply from the user
      if (fromEmail.includes(userEmail) && !fromEmail.includes(originalFromEmailLower)) {
        userHasReplied = true;
        if (!lastUserReplyDate || messageDate > lastUserReplyDate) {
          lastUserReplyDate = messageDate;
        }
      }
    }

    // If user hasn't replied, we shouldn't check for other party response
    if (!userHasReplied || !lastUserReplyDate) {
      return false; // User hasn't replied, so don't create follow-up draft
    }

    // Calculate the cutoff date (X days after user's last reply)
    const cutoffDate = new Date(lastUserReplyDate);
    cutoffDate.setDate(cutoffDate.getDate() + daysWithoutResponse);
    const now = new Date();

    // Check if cutoff date has passed (we're past the waiting period)
    if (now < cutoffDate) {
      return false; // Still within waiting period, don't create draft yet
    }

    // Check all messages in the thread that came after the user's last reply
    for (const message of thread.messages) {
      if (!message.payload?.headers) continue;

      const headers = message.payload.headers;
      const getHeader = (name: string) => {
        const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
        return header?.value;
      };

      const fromHeader = getHeader('From') || '';
      const fromEmail = fromHeader.toLowerCase();
      const dateHeader = getHeader('Date');
      const messageDate = dateHeader ? new Date(dateHeader) : new Date(Number(message.internalDate || 0));

      // Skip messages before or at the user's last reply
      if (messageDate <= lastUserReplyDate) continue;

      // Check if this is a reply from the other party (original sender)
      if (fromEmail.includes(originalFromEmailLower) && !fromEmail.includes(userEmail)) {
        // Found a reply from the other party after user replied
        console.log(`📧 [Gmail] Other party HAS replied in thread ${threadId} on ${messageDate.toISOString()}`);
        return false; // Other party HAS replied, so don't create draft
      }
    }

    // No replies found from the other party after user replied
    console.log(`📧 [Gmail] Other party has NOT replied in thread ${threadId} within ${daysWithoutResponse} days after user reply - creating follow-up draft`);
    return true; // Other party hasn't replied, so we should create a follow-up draft
  } catch (error: any) {
    console.error(`❌ [Gmail] Error checking for other party replies in thread ${threadId}:`, error.message);
    // On error, default to not creating draft to be safe
    return false;
  }
};

