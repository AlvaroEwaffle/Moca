// @ts-nocheck
import { GmailMessage, fetchEmails, hasNoUserResponse, hasNoOtherPartyResponse } from './gmail.service';
import Contact from '../models/contact.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import Agent from '../models/agent.model';
import Integration from '../models/integration.model';
import interactionLogService from './interactionLog.service';
import { queueEmailDraft } from './emailDraftQueue.service';
import EmailDraftQueue from '../models/emailDraftQueue.model';
import { gmailProcessorLogger } from '../utils/logger';

export interface ProcessEmailsOptions {
  userId: string;
  agentId?: string; // Optional: specific agent to assign emails to
  maxResults?: number;
  query?: string;
  labelIds?: string[];
  includeSpam?: boolean;
  draftSettings?: {
    enabled?: boolean;
    onlyIfUserNoResponse?: boolean;
    userNoResponseDays?: number;
    onlyIfOtherNoResponse?: boolean;
    otherNoResponseDays?: number;
  };
}

/**
 * Extract email address from "Name <email@domain.com>" format
 */
const extractEmailAddress = (emailString: string): string => {
  const match = emailString.match(/<([^>]+)>/);
  if (match) {
    return match[1];
  }
  return emailString.trim();
};

/**
 * Extract display name from "Name <email@domain.com>" format
 */
const extractDisplayName = (emailString: string): string | undefined => {
  const match = emailString.match(/^([^<]+)</);
  if (match) {
    return match[1].trim();
  }
  return undefined;
};

/**
 * Get or create a contact from an email address
 * Uses findOneAndUpdate with upsert to avoid E11000 duplicate key on psid (Gmail contacts have no psid)
 */
const getOrCreateContact = async (
  email: string,
  displayName?: string,
  _userId: string
): Promise<any> => {
  try {
    const filter = { email, channel: 'gmail' };
    const update: Record<string, any> = {
      lastActivity: new Date(),
      'metadata.lastSeen': new Date(),
      psid: `gmail_${email}` // Unique psid for Gmail contacts to avoid E11000 on legacy psid_1 index
    };
    if (displayName) update.name = displayName;
    const contact = await Contact.findOneAndUpdate(
      filter,
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (contact && displayName && !contact.name) {
      await Contact.updateOne({ _id: contact._id }, { $set: { name: displayName } });
      contact.name = displayName;
    }
    return contact;
  } catch (error: any) {
    if (error.code === 11000) {
      // Race: another process created it; fetch and return
      const contact = await Contact.findOne({ email, channel: 'gmail' });
      if (contact) return contact;
    }
    console.error(`❌ [Gmail Processor] Error getting/creating contact for ${email}:`, error.message);
    throw error;
  }
};

/**
 * Get the agent for a user (primary agent or specified agent)
 */
const getAgent = async (userId: string, agentId?: string): Promise<any | null> => {
  try {
    if (agentId) {
      const agent = await Agent.findOne({ _id: agentId, userId });
      if (agent) return agent;
    }

    // Try to find primary agent
    const primaryAgent = await Agent.findOne({ userId, isPrimary: true, isActive: true });
    if (primaryAgent) return primaryAgent;

    // Try any active agent
    const anyAgent = await Agent.findOne({ userId, isActive: true });
    return anyAgent || null;
  } catch (error: any) {
    console.error(`❌ [Gmail Processor] Error getting agent:`, error.message);
    return null;
  }
};

/**
 * Get integration accountId for Gmail (using integration ID)
 */
const getGmailAccountId = async (userId: string): Promise<string> => {
  const integration = await Integration.findOne({
    userId,
    type: 'gmail',
    status: 'connected'
  });

  if (!integration) {
    throw new Error('Gmail integration not found');
  }

  return integration.id;
};

/**
 * Get or create conversation from email thread
 * Returns [conversation, wasNew]
 */
const getOrCreateConversation = async (
  email: GmailMessage,
  contactId: string,
  accountId: string,
  agentId?: string
): Promise<[any, boolean]> => {
  try {
    // For Gmail, we'll use threadId as a way to group emails
    // But for now, we'll create one conversation per email thread
    // You might want to group by threadId in the future

    // Check if conversation already exists for this thread
    // We'll search by thread ID in the context.topic
    const existingConversation = await Conversation.findOne({
      contactId,
      accountId,
      'context.topic': { $regex: `\\[Gmail Thread: ${email.threadId}\\]` }
    });

    if (existingConversation) {
      return [existingConversation, false];
    }

    // Create new conversation
    // Store Gmail thread ID in context.topic prefix for identification
    const conversation = new Conversation({
      contactId,
      accountId,
      agentId,
      status: 'open',
      timestamps: {
        createdAt: email.date || new Date(),
        lastUserMessage: email.date || new Date(),
        lastActivity: email.date || new Date()
      },
      context: {
        topic: `[Gmail Thread: ${email.threadId}] ${email.subject || 'Email conversation'}`,
        urgency: 'medium'
      }
    });

    await conversation.save();
    console.log(`✅ [Gmail Processor] Created new conversation for thread ${email.threadId}`);

    return [conversation, true];
  } catch (error: any) {
    console.error(`❌ [Gmail Processor] Error getting/creating conversation:`, error.message);
    throw error;
  }
};

/**
 * Create message from email
 * Uses findOneAndUpdate with upsert to avoid E11000 duplicate key on mid (race conditions)
 */
const createMessage = async (
  email: GmailMessage,
  conversationId: string,
  contactId: string,
  accountId: string,
  agentId?: string
): Promise<any> => {
  const mid = `gmail_${email.id}`;
  try {
    const existingMessage = await Message.findOne({ mid });
    if (existingMessage) return existingMessage;

    const message = await Message.findOneAndUpdate(
      { mid },
      {
        $setOnInsert: {
          conversationId,
          contactId,
          accountId,
          agentId,
          role: 'user',
          content: { text: email.body || email.snippet || email.subject || '' },
          metadata: {
            timestamp: email.date || new Date(),
            processed: false,
            aiGenerated: false
          },
          status: 'received',
          deliveryConfirmed: true
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return message;
  } catch (error: any) {
    if (error.code === 11000) {
      const existing = await Message.findOne({ mid });
      if (existing) return existing;
    }
    console.error(`❌ [Gmail Processor] Error creating message:`, error.message);
    throw error;
  }
};

/**
 * Process fetched emails into contacts, conversations, and messages
 */
export const processEmails = async (options: ProcessEmailsOptions): Promise<{
  processed: number;
  contacts: number;
  conversations: number;
  messages: number;
  errors: string[];
}> => {
  const { userId, agentId, maxResults, query, labelIds, includeSpam } = options;

  const errors: string[] = [];
  let contactsCreated = 0;
  let conversationsCreated = 0;
  let messagesCreated = 0;

  try {
    console.log(`📧 [Gmail Processor] Starting email processing for user ${userId}`);

    // Fetch emails
    const emails = await fetchEmails(userId, {
      maxResults,
      query,
      labelIds,
      includeSpam
    });

    console.log(`📧 [Gmail Processor] Fetched ${emails.length} emails`);

    // Get agent
    const agent = await getAgent(userId, agentId);
    const resolvedAgentId = agent ? agent.id : undefined;

    // Get Gmail account ID
    const accountId = await getGmailAccountId(userId);

    // Group emails by threadId to process threads properly
    const emailsByThread = new Map<string, typeof emails>();
    for (const email of emails) {
      const threadId = email.threadId || `single_${email.id}`;
      if (!emailsByThread.has(threadId)) {
        emailsByThread.set(threadId, []);
      }
      emailsByThread.get(threadId)!.push(email);
    }

    gmailProcessorLogger.info('Emails grouped into threads', {
      totalEmails: emails.length,
      totalThreads: emailsByThread.size,
      userId
    });

    // Process each thread
    for (const [threadId, threadEmails] of emailsByThread) {
      // Edge case: Skip empty threads
      if (!threadEmails || threadEmails.length === 0) {
        gmailProcessorLogger.warn('Skipping empty thread', { threadId });
        continue;
      }

      // Sort emails in thread by date (oldest first) for processing order
      // But we'll find the newest one explicitly for draft creation
      threadEmails.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateA - dateB;
      });

      // CRITICAL: Find the newest email in the thread BEFORE processing
      // This ensures we always use the most recent email for draft creation
      let newestEmail: GmailMessage | null = null;
      let newestEmailDate = 0;
      for (const email of threadEmails) {
        const emailDate = email.date ? new Date(email.date).getTime() : 0;
        if (emailDate > newestEmailDate) {
          newestEmailDate = emailDate;
          newestEmail = email;
        }
      }

      // PHASE 1: Process all emails in the thread (create contacts, messages, conversations)
      let threadConversation: any = null;
      let threadContact: any = null;
      let lastProcessedEmail: GmailMessage | null = null;

      for (const email of threadEmails) {
        try {
          // Extract sender email
          const senderEmail = email.from ? extractEmailAddress(email.from) : null;
          if (!senderEmail) {
            gmailProcessorLogger.warn('Skipping email - no sender email', {
              emailId: email.id,
              threadId: email.threadId
            });
            continue;
          }

          // Extract sender name
          const senderName = email.from ? extractDisplayName(email.from) : undefined;

          // Get or create contact
          const contactWasNew = !(await Contact.findOne({ email: senderEmail, channel: 'gmail' }));
          const contact = await getOrCreateContact(senderEmail, senderName, userId);
          if (contactWasNew) {
            contactsCreated++;
            gmailProcessorLogger.info('New contact created', {
              contactId: contact.id,
              email: senderEmail,
              name: senderName,
              threadId: email.threadId
            });
          }

          // Store contact for draft creation later (use the first contact we find)
          if (!threadContact) {
            threadContact = contact;
          }

          // Get or create conversation
          const [conversation, isNewConversation] = await getOrCreateConversation(
            email,
            contact.id,
            accountId,
            resolvedAgentId
          );
          
          if (isNewConversation) {
            conversationsCreated++;
            gmailProcessorLogger.info('New conversation created', {
              conversationId: conversation.id,
              threadId: email.threadId,
              subject: email.subject,
              contactId: contact.id
            });
          }

          // Store conversation for draft creation (should be the same for all emails in thread)
          threadConversation = conversation;

          // Check if message already exists before creating
          const existingMessage = await Message.findOne({
            mid: `gmail_${email.id}`,
            conversationId: conversation.id
          });
          
          let message = existingMessage;
          if (!existingMessage) {
            // Create message
            message = await createMessage(
              email,
              conversation.id,
              contact.id,
              accountId,
              resolvedAgentId
            );
            messagesCreated++;
            gmailProcessorLogger.info('New message created', {
              messageId: message.id,
              emailId: email.id,
              threadId: email.threadId,
              conversationId: conversation.id
            });
          } else {
            gmailProcessorLogger.debug('Message already exists, skipping', {
              messageId: existingMessage.id,
              emailId: email.id,
              threadId: email.threadId
            });
          }

          // Log interaction
          try {
            await interactionLogService.recordInteraction({
              userId,
              agentId: resolvedAgentId,
              conversationId: conversation.id,
              contactId: contact.id,
              channel: 'gmail',
              direction: 'inbound',
              messageType: 'email',
              textPreview: email.snippet,
              payloadSummary: JSON.stringify({
                subject: email.subject,
                from: senderEmail,
                snippet: email.snippet
              })
            });
          } catch (logError) {
            console.warn(`⚠️ [Gmail Processor] Failed to log interaction:`, logError);
          }

          // Update conversation metrics
          conversation.messageCount = (conversation.messageCount || 0) + 1;
          conversation.metrics.totalMessages = conversation.messageCount;
          conversation.metrics.userMessages = (conversation.metrics.userMessages || 0) + 1;
          conversation.timestamps.lastActivity = email.date || new Date();
          conversation.timestamps.lastUserMessage = email.date || new Date();
          await conversation.save();

          // Track the last processed email (most recent)
          lastProcessedEmail = email;

        } catch (error: any) {
          const errorMsg = `Error processing email ${email.id}: ${error.message}`;
          console.error(`❌ [Gmail Processor] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // PHASE 2: Evaluate draft creation logic ONCE per thread (after all emails processed)
      // CRITICAL: Find the newest email FROM THE OTHER PARTY (not from the user)
      // This ensures we check if the user needs to reply to the other party's message
      let lastEmailFromOtherParty: GmailMessage | null = null;
      let lastEmailFromOtherPartyDate = 0;
      
      // Get user's email to filter out user's own messages
      let userEmail: string | undefined;
      try {
        const { getGmailProfile } = await import('./gmail.service');
        const userProfile = await getGmailProfile(userId);
        userEmail = userProfile?.email?.toLowerCase();
      } catch (error) {
        console.warn(`⚠️ [Gmail Processor] Could not get user email: ${error}`);
      }
      
      // Find the newest email that is NOT from the user
      for (const email of threadEmails) {
        const senderEmail = email.from ? extractEmailAddress(email.from)?.toLowerCase() : null;
        // Skip if this email is from the user
        if (userEmail && senderEmail === userEmail) {
          continue;
        }
        
        const emailDate = email.date ? new Date(email.date).getTime() : 0;
        if (emailDate > lastEmailFromOtherPartyDate) {
          lastEmailFromOtherPartyDate = emailDate;
          lastEmailFromOtherParty = email;
        }
      }
      
      // Fallback to newestEmail if we couldn't find an email from other party
      // (This handles edge cases where user email detection fails)
      const lastEmail = lastEmailFromOtherParty || newestEmail || lastProcessedEmail;
      
      if (options.draftSettings?.enabled && threadConversation && lastEmail) {
        const lastSenderEmail = lastEmail.from ? extractEmailAddress(lastEmail.from) : null;
        const lastSenderName = lastEmail.from ? extractDisplayName(lastEmail.from) : undefined;

        if (!lastSenderEmail) {
          gmailProcessorLogger.warn('Skipping draft - last email has no sender', {
            threadId,
            lastEmailId: lastEmail.id
          });
          continue;
        }

        // CRITICAL: Skip draft creation if the last email is from the user
        // We only create drafts to reply to emails FROM OTHER PARTIES
        if (userEmail && lastSenderEmail.toLowerCase() === userEmail) {
          gmailProcessorLogger.info('Skipping draft - last email in thread is from user', {
            threadId,
            lastEmailId: lastEmail.id,
            userEmail,
            lastSenderEmail,
            decision: 'skip_user_own_email'
          });
          continue;
        }

        // Also skip if we couldn't find any email from other party (all emails are from user)
        if (!lastEmailFromOtherParty && userEmail) {
          gmailProcessorLogger.info('Skipping draft - all emails in thread are from user', {
            threadId,
            totalEmails: threadEmails.length,
            userEmail,
            decision: 'skip_all_user_emails'
          });
          continue;
        }

        // Get or find the contact for the last email's sender
        // This ensures we use the correct contact even if thread has multiple senders
        let lastEmailContact = threadContact;
        try {
          const contactForLastEmail = await Contact.findOne({ email: lastSenderEmail, channel: 'gmail' });
          if (contactForLastEmail) {
            lastEmailContact = contactForLastEmail;
          } else if (!threadContact) {
            // If no thread contact found and no contact for last email, create one
            lastEmailContact = await getOrCreateContact(lastSenderEmail, lastSenderName, userId);
          }
        } catch (contactError: any) {
          console.warn(`⚠️ [Gmail Processor] Error getting contact for last email: ${contactError.message}`);
          // Fallback to threadContact if available
          if (!lastEmailContact) {
            console.log(`⏸️  [Gmail Processor] Skipping draft for thread ${threadId} - no contact available`);
            continue;
          }
        }

        if (!lastEmailContact) {
          console.log(`⏸️  [Gmail Processor] Skipping draft for thread ${threadId} - no contact available`);
          continue;
        }

        // Edge case: Check if draft already exists for this thread
        // We check by threadId to avoid duplicate drafts (early optimization)
        // NOTE: queueEmailDraft also checks, but this early check prevents unnecessary work
        const finalThreadId = lastEmail.threadId || threadId;
        try {
          const existingDraft = await EmailDraftQueue.findOne({
            userId,
            threadId: finalThreadId,
            status: { $in: ['pending', 'generating', 'completed'] }
          }).sort({ createdAt: -1 }); // Get most recent if multiple somehow exist

          if (existingDraft) {
            gmailProcessorLogger.info('Draft already exists for thread - skipping', {
              threadId: finalThreadId,
              existingDraftStatus: existingDraft.status,
              existingDraftId: existingDraft.id,
              existingEmailId: existingDraft.emailId,
              decision: 'skip_duplicate'
            });
            continue;
          }
        } catch (checkError: any) {
          gmailProcessorLogger.warn('Error checking for existing draft - continuing anyway', {
            threadId: finalThreadId,
            error: checkError.message
          });
          // Continue with draft creation even if check fails - queueEmailDraft will also check
        }

        let shouldCreateDraft = false;
        let reason = '';

        // Case 1: Check if user hasn't responded (reminder to respond)
        // CRITICAL: Only check if there's an email from the other party to reply to
        if (options.draftSettings.onlyIfUserNoResponse && options.draftSettings.userNoResponseDays && lastEmailFromOtherParty?.threadId) {
          try {
            const emailDate = lastEmailFromOtherParty.date || new Date();
            const emailSenderEmail = lastEmailFromOtherParty.from ? extractEmailAddress(lastEmailFromOtherParty.from) : lastSenderEmail;
            const userHasNotReplied = await hasNoUserResponse(
              userId,
              lastEmailFromOtherParty.threadId!,
              emailDate,
              emailSenderEmail || '',
              options.draftSettings.userNoResponseDays
            );
            
            if (userHasNotReplied) {
              shouldCreateDraft = true;
              reason = 'User has not replied';
              gmailProcessorLogger.info('Draft condition met: User has not replied', {
                threadId,
                lastEmailId: lastEmailFromOtherParty.id,
                daysWithoutResponse: options.draftSettings.userNoResponseDays,
                decision: 'create_draft',
                reason
              });
            } else {
              gmailProcessorLogger.info('Draft condition not met: User has already replied', {
                threadId,
                lastEmailId: lastEmailFromOtherParty.id,
                daysWithoutResponse: options.draftSettings.userNoResponseDays,
                decision: 'skip_draft',
                reason: 'user_already_replied'
              });
            }
          } catch (error: any) {
            console.warn(`⚠️ [Gmail Processor] Error checking for user replies in thread ${threadId}: ${error.message}`);
            // On error, don't create draft
          }
        }

        // Case 2: Check if other party hasn't responded after user replied (follow-up)
        // This check runs independently or in addition to Case 1
        if (options.draftSettings.onlyIfOtherNoResponse && options.draftSettings.otherNoResponseDays && lastEmail.threadId) {
          try {
            const emailDate = lastEmail.date || new Date();
            const otherHasNotReplied = await hasNoOtherPartyResponse(
              userId,
              lastEmail.threadId,
              emailDate,
              lastSenderEmail,
              options.draftSettings.otherNoResponseDays
            );
            
            if (otherHasNotReplied) {
              shouldCreateDraft = true;
              if (reason) reason += ' and ';
              reason += 'Other party has not replied after user response';
              gmailProcessorLogger.info('Draft condition met: Other party has not replied', {
                threadId,
                lastEmailId: lastEmail.id,
                daysWithoutResponse: options.draftSettings.otherNoResponseDays,
                decision: 'create_draft',
                reason
              });
            } else {
              // Only skip if Case 1 is not enabled (to avoid skipping when both are enabled)
              if (!options.draftSettings.onlyIfUserNoResponse) {
                gmailProcessorLogger.info('Draft condition not met: Other party has already replied', {
                  threadId,
                  lastEmailId: lastEmail.id,
                  daysWithoutResponse: options.draftSettings.otherNoResponseDays,
                  decision: 'skip_draft',
                  reason: 'other_party_already_replied'
                });
              }
            }
          } catch (error: any) {
            console.warn(`⚠️ [Gmail Processor] Error checking for other party replies in thread ${threadId}: ${error.message}`);
            // On error, don't create draft for this case
          }
        }

        // If no conditions are set, create draft by default (but only if there's an email from other party)
        if (!options.draftSettings.onlyIfUserNoResponse && !options.draftSettings.onlyIfOtherNoResponse) {
          if (lastEmailFromOtherParty) {
            shouldCreateDraft = true;
            reason = 'Draft generation enabled (no conditions)';
            gmailProcessorLogger.info('Draft will be created - no conditions set', {
              threadId,
              lastEmailId: lastEmailFromOtherParty.id,
              decision: 'create_draft',
              reason
            });
          } else {
            gmailProcessorLogger.info('Skipping draft - no email from other party to reply to', {
              threadId,
              decision: 'skip_no_other_party_email',
              reason: 'all_emails_from_user'
            });
          }
        }

        // Create ONE draft for the entire thread (only if we have an email from other party)
        if (shouldCreateDraft && lastEmailFromOtherParty) {
          try {
            // Use the email from other party's ID and thread context for the draft
            const emailForDraft = lastEmailFromOtherParty;
            const draftSenderEmail = emailForDraft.from ? extractEmailAddress(emailForDraft.from) : null;
            const draftSenderName = emailForDraft.from ? extractDisplayName(emailForDraft.from) : undefined;
            
            if (!draftSenderEmail) {
              gmailProcessorLogger.warn('Skipping draft - email from other party has no sender', {
                threadId,
                emailId: emailForDraft.id
              });
              continue;
            }
            
            const draftQueueResult = await queueEmailDraft({
              userId,
              emailId: emailForDraft.id,
              threadId: emailForDraft.threadId || threadId,
              subject: emailForDraft.subject || '(Sin asunto)',
              fromEmail: draftSenderEmail,
              fromName: draftSenderName,
              originalBody: emailForDraft.body || emailForDraft.snippet || '',
              agentId: resolvedAgentId,
              conversationId: threadConversation.id.toString(),
              contactId: lastEmailContact.id.toString(),
              priority: 'medium'
            });
            
            gmailProcessorLogger.info('Draft queued successfully', {
              threadId,
              lastEmailId: emailForDraft.id,
              lastEmailDate: emailForDraft.date?.toISOString(),
              draftQueueId: draftQueueResult.id,
              subject: lastEmail.subject,
              fromEmail: lastSenderEmail,
              fromName: lastSenderName,
              reason: reason || 'Draft generation enabled',
              decision: 'draft_queued'
            });
          } catch (draftError: any) {
            gmailProcessorLogger.error('Failed to queue draft', {
              threadId,
              lastEmailId: lastEmail.id,
              error: draftError.message,
              decision: 'draft_queue_failed'
            });
            // Don't fail the whole process if draft queueing fails
          }
        }
      }
    }

    gmailProcessorLogger.info('Processing complete', {
      totalEmails: emails.length,
      totalThreads: emailsByThread.size,
      contactsCreated,
      conversationsCreated,
      messagesCreated,
      errorsCount: errors.length,
      userId
    });

    return {
      processed: emails.length,
      contacts: contactsCreated,
      conversations: conversationsCreated,
      messages: messagesCreated,
      errors
    };
  } catch (error: any) {
    gmailProcessorLogger.error('Fatal error processing emails', {
      error: error.message,
      stack: error.stack,
      userId
    });
    throw error;
  }
};

