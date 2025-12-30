// @ts-nocheck
import { google } from 'googleapis';
import Integration, { revealTokens } from '../models/integration.model';
import { refreshGoogleTokens } from './googleOAuth.service';

/**
 * Get authenticated Gmail API client for a user's integration
 */
const getGmailClient = async (userId: string): Promise<google.auth.OAuth2Client | null> => {
  try {
    const integration = await Integration.findOne({
      userId,
      type: 'gmail',
      status: 'connected'
    });

    if (!integration) {
      console.warn(`⚠️ [Gmail Draft] No connected Gmail integration found for user ${userId}`);
      return null;
    }

    const { accessToken, refreshToken } = revealTokens(integration);

    if (!accessToken) {
      console.error(`❌ [Gmail Draft] No access token found for user ${userId}`);
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

    // Try to refresh token if needed
    try {
      await oauth2Client.getAccessToken();
    } catch (error: any) {
      console.warn(`⚠️ [Gmail Draft] Token may be expired, attempting refresh...`);
      if (refreshToken) {
        const newTokens = await refreshGoogleTokens(refreshToken);
        if (newTokens) {
          oauth2Client.setCredentials({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token || refreshToken
          });
          
          // Update integration with new tokens
          integration.accessToken = newTokens.access_token;
          if (newTokens.refresh_token) {
            integration.refreshToken = newTokens.refresh_token;
          }
          await integration.save();
        }
      }
    }

    return oauth2Client;
  } catch (error: any) {
    console.error(`❌ [Gmail Draft] Error getting Gmail client:`, error.message);
    return null;
  }
};

export interface CreateDraftOptions {
  userId: string;
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  threadId?: string;
  replyToMessageId?: string; // If replying to a specific message
  cc?: string[];
  bcc?: string[];
}

/**
 * Create a draft in Gmail
 */
export async function createGmailDraft(options: CreateDraftOptions): Promise<{
  id: string;
  message: {
    id: string;
    threadId: string;
  };
}> {
  try {
    const oauth2Client = await getGmailClient(options.userId);
    if (!oauth2Client) {
      throw new Error('Gmail client not available');
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get user's email from Gmail profile
    let userEmail: string | undefined;
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      userEmail = profile.data.emailAddress?.toLowerCase();
    } catch (error: any) {
      console.warn(`⚠️ [Gmail Draft] Could not fetch user profile: ${error.message}`);
    }

    // If replying, fetch the original message to get proper headers and recipients
    let originalMessageId: string | undefined;
    let referencesHeader: string | undefined;
    let replyToRecipients: string[] = [];
    let replyToCc: string[] = [];
    
    if (options.replyToMessageId && options.threadId) {
      try {
        // Fetch the original message to get its Message-ID header and recipients
        const originalMessage = await gmail.users.messages.get({
          userId: 'me',
          id: options.replyToMessageId,
          format: 'full'
        });

        if (originalMessage.data.payload?.headers) {
          const headers = originalMessage.data.payload.headers;
          
          // Get the Message-ID from the original email
          const messageIdHeader = headers.find(h => 
            h.name?.toLowerCase() === 'message-id'
          );
          if (messageIdHeader?.value) {
            originalMessageId = messageIdHeader.value;
          }

          // Get existing References header from the original message
          const existingReferences = headers.find(h => 
            h.name?.toLowerCase() === 'references'
          );
          
          // Build References header: existing references + original message ID
          if (originalMessageId) {
            if (existingReferences?.value) {
              referencesHeader = `${existingReferences.value} ${originalMessageId}`;
            } else {
              referencesHeader = originalMessageId;
            }
          }

          // userEmail is already fetched from profile above

          // Extract all recipients for reply-all
          const getHeader = (name: string) => {
            const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
            return header?.value || '';
          };

          // Get the original sender (From header) - this should be in the To field of the reply
          const fromHeader = getHeader('From');
          const originalSender = fromHeader.match(/[\w\.-]+@[\w\.-]+\.\w+/)?.[0]?.toLowerCase();
          
          // Get To recipients (excluding user's email)
          const toHeader = getHeader('To');
          const toEmails: string[] = [];
          if (toHeader) {
            const matches = toHeader.match(/[\w\.-]+@[\w\.-]+\.\w+/g) || [];
            toEmails.push(...matches.map(email => email.toLowerCase()));
          }

          // Get Cc recipients (excluding user's email)
          const ccHeader = getHeader('Cc');
          const ccEmails: string[] = [];
          if (ccHeader) {
            const matches = ccHeader.match(/[\w\.-]+@[\w\.-]+\.\w+/g) || [];
            ccEmails.push(...matches.map(email => email.toLowerCase()));
          }

          // Build reply-all recipients:
          // To: original sender + all original To recipients (excluding user)
          // Cc: all original Cc recipients (excluding user)
          const allToRecipients = new Set<string>();
          if (originalSender) {
            allToRecipients.add(originalSender);
          }
          toEmails.forEach(email => {
            if (email !== userEmail) {
              allToRecipients.add(email);
            }
          });
          replyToRecipients = Array.from(allToRecipients);

          // Cc: all original Cc recipients (excluding user)
          replyToCc = ccEmails.filter(email => email !== userEmail);

          // If no recipients found, fall back to the original "to" option
          if (replyToRecipients.length === 0 && options.to) {
            replyToRecipients = [options.to.toLowerCase()];
          }
        }
      } catch (error: any) {
        console.warn(`⚠️ [Gmail Draft] Could not fetch original message for reply headers: ${error.message}`);
        // Continue without reply headers - threadId should still work
        // Fall back to original "to" option
        if (options.to) {
          replyToRecipients = [options.to.toLowerCase()];
        }
      }
    } else {
      // Not a reply, use the provided "to" option
      if (options.to) {
        replyToRecipients = [options.to.toLowerCase()];
      }
    }

    // Build email message
    const emailParts: string[] = [];
    
    // Headers - use reply-all recipients if available, otherwise use provided options
    const toRecipients = replyToRecipients.length > 0 ? replyToRecipients : (options.to ? [options.to] : []);
    const ccRecipients = replyToCc.length > 0 ? replyToCc : (options.cc || []);
    
    emailParts.push(`To: ${toRecipients.join(', ')}`);
    if (ccRecipients.length > 0) {
      emailParts.push(`Cc: ${ccRecipients.join(', ')}`);
    }
    if (options.bcc && options.bcc.length > 0) {
      emailParts.push(`Bcc: ${options.bcc.join(', ')}`);
    }
    emailParts.push(`Subject: ${options.subject}`);
    
    // If replying, add proper In-Reply-To and References headers
    if (originalMessageId) {
      emailParts.push(`In-Reply-To: ${originalMessageId}`);
    }
    if (referencesHeader) {
      emailParts.push(`References: ${referencesHeader}`);
    }

    emailParts.push(''); // Empty line between headers and body
    emailParts.push(options.bodyHtml || options.body);

    const rawMessage = emailParts.join('\r\n');

    // Encode message as base64url
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // CRITICAL: Check if draft already exists in Gmail for this thread
    // This is the final safety net to prevent duplicate drafts at the Gmail API level
    if (options.threadId) {
      try {
        // List all drafts and filter by thread
        const draftsList = await gmail.users.drafts.list({
          userId: 'me',
          maxResults: 50 // Check up to 50 drafts
        });

        if (draftsList.data.drafts && draftsList.data.drafts.length > 0) {
          // Check each draft to see if it belongs to the same thread
          for (const draftRef of draftsList.data.drafts) {
            if (!draftRef.id) continue;

            try {
              const draftDetail = await gmail.users.drafts.get({
                userId: 'me',
                id: draftRef.id,
                format: 'minimal' // We only need threadId
              });

              const draftThreadId = draftDetail.data.message?.threadId;
              if (draftThreadId === options.threadId) {
                // Draft already exists for this thread
                console.log(`⚠️  [Gmail Draft] Draft already exists for thread ${options.threadId}: ${draftRef.id}`);
                
                // Return existing draft info instead of creating new one
                return {
                  id: draftRef.id,
                  message: {
                    id: draftDetail.data.message?.id || '',
                    threadId: draftThreadId || options.threadId || ''
                  }
                };
              }
            } catch (draftGetError: any) {
              // If we can't fetch draft details, skip it and continue
              console.warn(`⚠️  [Gmail Draft] Could not fetch draft ${draftRef.id} details: ${draftGetError.message}`);
            }
          }
        }
      } catch (checkError: any) {
        console.warn(`⚠️  [Gmail Draft] Could not check for existing drafts: ${checkError.message}`);
        // Continue with creation if check fails - better to create than to fail completely
      }
    }

    // Create draft
    const draftPayload: any = {
      message: {
        raw: encodedMessage,
        threadId: options.threadId
      }
    };

    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: draftPayload
    });

    const draft = response.data;
    if (!draft.id || !draft.message) {
      throw new Error('Failed to create draft - invalid response');
    }

    console.log(`✅ [Gmail Draft] Created draft ${draft.id} for user ${options.userId}`);
    console.log(`   - Thread ID: ${draft.message.threadId || options.threadId || 'N/A'}`);
    console.log(`   - Message ID: ${draft.message.id || 'N/A'}`);
    console.log(`   - Subject: ${options.subject?.substring(0, 50) || 'N/A'}`);
    console.log(`   - To: ${toRecipients.join(', ')}`);
    if (ccRecipients.length > 0) {
      console.log(`   - Cc: ${ccRecipients.join(', ')}`);
    }
    if (originalMessageId) {
      console.log(`   - Replying to Message-ID: ${originalMessageId}`);
    }

    return {
      id: draft.id || '',
      message: {
        id: draft.message.id || '',
        threadId: draft.message.threadId || options.threadId || ''
      }
    };
  } catch (error: any) {
    console.error(`❌ [Gmail Draft] Error creating draft:`, error.message);
    throw new Error(`Failed to create Gmail draft: ${error.message}`);
  }
}

/**
 * Update an existing draft in Gmail
 */
export async function updateGmailDraft(
  userId: string,
  draftId: string,
  options: {
    to?: string;
    subject?: string;
    body?: string;
    bodyHtml?: string;
  }
): Promise<void> {
  try {
    const oauth2Client = await getGmailClient(userId);
    if (!oauth2Client) {
      throw new Error('Gmail client not available');
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get existing draft to preserve headers and thread info
    const existingDraft = await gmail.users.drafts.get({
      userId: 'me',
      id: draftId,
      format: 'full'
    });

    if (!existingDraft.data.message) {
      throw new Error('Draft not found');
    }

    // Build updated message
    const emailParts: string[] = [];
    
    // Use existing or new headers
    const headers = existingDraft.data.message.payload?.headers || [];
    headers.forEach((header) => {
      const name = header.name?.toLowerCase();
      if (name === 'to' && options.to) {
        emailParts.push(`To: ${options.to}`);
      } else if (name === 'subject' && options.subject) {
        emailParts.push(`Subject: ${options.subject}`);
      } else if (header.name && header.value && name !== 'to' && name !== 'subject') {
        emailParts.push(`${header.name}: ${header.value}`);
      }
    });

    // Add new headers if not present
    if (options.to && !headers.find((h) => h.name?.toLowerCase() === 'to')) {
      emailParts.push(`To: ${options.to}`);
    }
    if (options.subject && !headers.find((h) => h.name?.toLowerCase() === 'subject')) {
      emailParts.push(`Subject: ${options.subject}`);
    }

    emailParts.push(''); // Empty line
    emailParts.push(options.bodyHtml || options.body || '');

    const rawMessage = emailParts.join('\r\n');
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Update draft
    await gmail.users.drafts.update({
      userId: 'me',
      id: draftId,
      requestBody: {
        message: {
          raw: encodedMessage,
          threadId: existingDraft.data.message.threadId
        }
      }
    });

    console.log(`✅ [Gmail Draft] Updated draft ${draftId} for user ${userId}`);
  } catch (error: any) {
    console.error(`❌ [Gmail Draft] Error updating draft:`, error.message);
    throw new Error(`Failed to update Gmail draft: ${error.message}`);
  }
}

/**
 * Send a draft in Gmail
 */
export async function sendGmailDraft(userId: string, draftId: string): Promise<{
  id: string;
  threadId: string;
}> {
  try {
    const oauth2Client = await getGmailClient(userId);
    if (!oauth2Client) {
      throw new Error('Gmail client not available');
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // First, verify the draft exists
    try {
      await gmail.users.drafts.get({
        userId: 'me',
        id: draftId
      });
    } catch (checkError: any) {
      if (checkError.code === 404 || checkError.message?.includes('not found')) {
        throw new Error(`Draft not found in Gmail. It may have been deleted. Draft ID: ${draftId}`);
      }
      throw checkError;
    }

    // Send the draft
    const response = await gmail.users.drafts.send({
      userId: 'me',
      requestBody: {
        id: draftId
      }
    });

    const message = response.data;
    if (!message.id) {
      throw new Error('Failed to send draft - invalid response');
    }

    console.log(`✅ [Gmail Draft] Sent draft ${draftId} as message ${message.id} for user ${userId}`);
    console.log(`   - Thread ID: ${message.threadId}`);

    return {
      id: message.id,
      threadId: message.threadId || ''
    };
  } catch (error: any) {
    console.error(`❌ [Gmail Draft] Error sending draft:`, error.message);
    
    // Provide more specific error messages
    if (error.message?.includes('not found') || error.code === 404) {
      throw new Error(`El borrador no se encuentra en Gmail. Puede que haya sido eliminado. Por favor, genera un nuevo borrador.`);
    }
    
    throw new Error(`Failed to send Gmail draft: ${error.message}`);
  }
}

/**
 * Delete a draft in Gmail
 */
export async function deleteGmailDraft(userId: string, draftId: string): Promise<void> {
  try {
    const oauth2Client = await getGmailClient(userId);
    if (!oauth2Client) {
      throw new Error('Gmail client not available');
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    await gmail.users.drafts.delete({
      userId: 'me',
      id: draftId
    });

    console.log(`✅ [Gmail Draft] Deleted draft ${draftId} for user ${userId}`);
  } catch (error: any) {
    console.error(`❌ [Gmail Draft] Error deleting draft:`, error.message);
    throw new Error(`Failed to delete Gmail draft: ${error.message}`);
  }
}

