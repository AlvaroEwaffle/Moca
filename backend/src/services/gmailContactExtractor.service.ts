// @ts-nocheck
import { google } from 'googleapis';
import { getGmailClient, getGmailProfile } from './gmail.service';
import Contact from '../models/contact.model';

export interface ContactExtractionResult {
  totalEmailsProcessed: number;
  contactsFound: number;
  contactsCreated: number;
  contactsUpdated: number;
  contacts: Array<{
    email: string;
    name?: string;
  }>;
}

/**
 * Parse email address and name from a header string
 * Supports formats: "Name <email@domain.com>", "email@domain.com", etc.
 */
const parseEmailHeader = (headerValue: string): Array<{ email: string; name?: string }> => {
  const results: Array<{ email: string; name?: string }> = [];
  
  if (!headerValue || !headerValue.trim()) {
    return results;
  }

  // Split by comma to handle multiple recipients
  const parts = headerValue.split(',').map(p => p.trim());
  
  for (const part of parts) {
    // Pattern: "Display Name" <email@domain.com>
    const angleBracketMatch = part.match(/^"?(.+?)"?\s*<([^>]+)>$/);
    if (angleBracketMatch) {
      const name = angleBracketMatch[1].trim().replace(/^"|"$/g, '');
      const email = angleBracketMatch[2].trim().toLowerCase();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.push({
          email,
          name: name || undefined
        });
      }
      continue;
    }

    // Pattern: email@domain.com (plain email)
    const emailMatch = part.match(/^([^\s@]+@[^\s@]+\.[^\s@]+)$/);
    if (emailMatch) {
      const email = emailMatch[1].trim().toLowerCase();
      results.push({ email });
      continue;
    }

    // Pattern: Name email@domain.com (less common)
    const nameEmailMatch = part.match(/^(.+?)\s+([^\s@]+@[^\s@]+\.[^\s@]+)$/);
    if (nameEmailMatch) {
      const name = nameEmailMatch[1].trim();
      const email = nameEmailMatch[2].trim().toLowerCase();
      results.push({
        email,
        name: name || undefined
      });
    }
  }

  return results;
};

/**
 * Check if email should be excluded (no-reply, noreply, etc.)
 */
const shouldExcludeEmail = (email: string): boolean => {
  const lowerEmail = email.toLowerCase();
  const excludePatterns = [
    'noreply',
    'no-reply',
    'donotreply',
    'do-not-reply',
    'noresponse',
    'no-response',
    'mailer-daemon',
    'postmaster',
    'automated',
    'automation'
  ];
  
  return excludePatterns.some(pattern => lowerEmail.includes(pattern));
};

/**
 * Extract contacts from Gmail emails for a specific time period
 */
export const extractContactsFromEmails = async (
  userId: string,
  days: number = 180
): Promise<ContactExtractionResult> => {
  try {
    const months = Math.round(days / 30);
    console.log(`📧 [Contact Extractor] Starting extraction for user ${userId}, last ${days} days (~${months} months)`);

    const oauth2Client = await getGmailClient(userId);
    if (!oauth2Client) {
      throw new Error('Gmail client not available. Please connect your Gmail account.');
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get user's email to exclude it
    const userProfile = await getGmailProfile(userId);
    const userEmail = userProfile?.email?.toLowerCase() || '';
    
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const dateQuery = `${startDate.getFullYear()}/${String(startDate.getMonth() + 1).padStart(2, '0')}/${String(startDate.getDate()).padStart(2, '0')}`;

    // Build query - exclude spam and trash
    const query = `after:${dateQuery} -in:SPAM -in:TRASH`;

    console.log(`📧 [Contact Extractor] Query: ${query}`);

    // Map to store unique contacts: email -> { name?, count }
    const contactsMap = new Map<string, { name?: string; count: number }>();
    let totalEmailsProcessed = 0;
    let pageToken: string | undefined;
    const maxResults = 500; // Gmail API max per request

    // Fetch emails with pagination
    do {
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
        pageToken
      });

      const messages = listResponse.data.messages || [];
      if (messages.length === 0) {
        break;
      }

      console.log(`📧 [Contact Extractor] Processing batch of ${messages.length} messages`);

      // Process messages in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (message) => {
            try {
              // Get message headers only (format: metadata to save quota)
              const messageResponse = await gmail.users.messages.get({
                userId: 'me',
                id: message.id!,
                format: 'metadata',
                metadataHeaders: ['From', 'To', 'Cc', 'Bcc']
              });

              const headers = messageResponse.data.payload?.headers || [];
              const getHeader = (name: string) => {
                const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
                return header?.value || '';
              };

              // Extract contacts from From, To, CC, BCC
              const fromHeader = getHeader('From');
              const toHeader = getHeader('To');
              const ccHeader = getHeader('Cc');
              const bccHeader = getHeader('Bcc');

              const allHeaders = [fromHeader, toHeader, ccHeader, bccHeader].filter(Boolean);

              for (const header of allHeaders) {
                const parsed = parseEmailHeader(header);
                for (const { email, name } of parsed) {
                  // Skip user's own email
                  if (email === userEmail || email.includes(`@${userEmail.split('@')[1]}`)) {
                    continue;
                  }

                  // Skip excluded emails
                  if (shouldExcludeEmail(email)) {
                    continue;
                  }

                  // Update contacts map
                  if (!contactsMap.has(email)) {
                    contactsMap.set(email, { name, count: 1 });
                  } else {
                    const existing = contactsMap.get(email)!;
                    // Prefer non-empty name
                    if (name && !existing.name) {
                      existing.name = name;
                    }
                    existing.count += 1;
                  }
                }
              }

              totalEmailsProcessed += 1;
            } catch (error: any) {
              console.error(`❌ [Contact Extractor] Error processing message ${message.id}:`, error.message);
              // Continue with next message
            }
          })
        );

        // Small delay to avoid rate limiting
        if (i + batchSize < messages.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Get next page token
      pageToken = listResponse.data.nextPageToken;
      
      // Small delay between pages
      if (pageToken) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } while (pageToken);

    console.log(`📧 [Contact Extractor] Found ${contactsMap.size} unique contacts from ${totalEmailsProcessed} emails`);

    // Save/update contacts in database
    let contactsCreated = 0;
    let contactsUpdated = 0;
    const allContacts: Array<{ email: string; name?: string }> = [];

    // First, convert contactsMap to array (these are all unique contacts found)
    const allFoundContacts = Array.from(contactsMap.entries()).map(([email, { name }]) => ({
      email,
      name: name || undefined
    }));

    // Try to save/update each contact in database
    for (const [email, { name }] of contactsMap.entries()) {
      try {
        // Use findOneAndUpdate with upsert to handle existing contacts gracefully
        const existingContact = await Contact.findOne({ email, channel: 'gmail' });
        const wasNew = !existingContact;

        const updateData: any = {
          email,
          channel: 'gmail',
          lastActivity: new Date(),
          'metadata.lastSeen': new Date()
        };

        // Only update name if we have one and contact doesn't have one, or if it's a new contact
        if (name) {
          if (wasNew || !existingContact?.name) {
            updateData.name = name;
          }
        }

        const contact = await Contact.findOneAndUpdate(
          { email, channel: 'gmail' },
          { $set: updateData },
          { 
            upsert: true, 
            new: true,
            setDefaultsOnInsert: true
          }
        );

        if (wasNew) {
          contactsCreated += 1;
        } else if (name && !existingContact?.name) {
          contactsUpdated += 1;
        }
      } catch (error: any) {
        // Log error but continue - we'll still include the contact in the results
        console.error(`❌ [Contact Extractor] Error saving contact ${email}:`, error.message);
        // Continue with next contact
      }
    }

    console.log(`✅ [Contact Extractor] Extraction complete: ${contactsCreated} created, ${contactsUpdated} updated`);

    // Return ALL contacts found, not just the ones saved successfully
    return {
      totalEmailsProcessed,
      contactsFound: contactsMap.size,
      contactsCreated,
      contactsUpdated,
      contacts: allFoundContacts
    };
  } catch (error: any) {
    console.error(`❌ [Contact Extractor] Error extracting contacts:`, error);
    throw error;
  }
};
