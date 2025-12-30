// @ts-nocheck
import EmailDraftQueue, { IEmailDraftQueue, DraftStatus, DraftPriority } from '../models/emailDraftQueue.model';
import { generateEmailDraftWithContext } from './emailDraftGeneration.service';
import { createGmailDraft } from './gmailDraft.service';
import User from '../models/user.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import { emailDraftQueueLogger } from '../utils/logger';

export interface QueueDraftOptions {
  userId: string;
  emailId: string;
  threadId: string;
  subject: string;
  fromEmail: string;
  fromName?: string;
  originalBody: string;
  agentId?: string;
  conversationId?: string;
  messageId?: string;
  contactId?: string;
  priority?: DraftPriority;
  agentSettings?: {
    systemPrompt?: string;
    toneOfVoice?: string;
    keyInformation?: string;
  };
}

/**
 * Queue an email for draft generation
 */
export async function queueEmailDraft(options: QueueDraftOptions): Promise<IEmailDraftQueue> {
  try {
    // CRITICAL: Check for existing draft by threadId first (ONE draft per thread)
    // This prevents multiple drafts from being created for the same thread
    if (options.threadId) {
      const existingByThread = await EmailDraftQueue.findOne({
        userId: options.userId,
        threadId: options.threadId,
        status: { $in: ['pending', 'generating', 'completed'] }
      });

      if (existingByThread) {
        emailDraftQueueLogger.warn('Draft already exists for thread - skipping duplicate', {
          threadId: options.threadId,
          status: existingByThread.status,
          emailId: existingByThread.emailId,
          draftId: existingByThread.draftId
        });
        return existingByThread;
      }
    }

    // Also check by emailId as a secondary check (for backwards compatibility)
    const activeExisting = await EmailDraftQueue.findOne({
      userId: options.userId,
      emailId: options.emailId,
      status: { $in: ['pending', 'generating'] }
    });

    if (activeExisting) {
      console.log(`⚠️ [Email Draft Queue] Draft already queued for email ${options.emailId} - skipping duplicate`);
      return activeExisting;
    }

    // Check for any existing draft (completed/failed) by emailId
    // Only allow regeneration if explicitly needed (for now, we skip to prevent duplicates)
    const anyExisting = await EmailDraftQueue.findOne({
      userId: options.userId,
      emailId: options.emailId
    });

    if (anyExisting) {
      // If draft is completed or failed, check if it's for the same thread
      // If same thread, don't create a new one
      if (anyExisting.status === 'completed' || anyExisting.status === 'failed') {
        if (options.threadId && anyExisting.threadId === options.threadId) {
          console.log(`⚠️ [Email Draft Queue] Existing ${anyExisting.status} draft found for thread ${options.threadId} - skipping to prevent duplicates`);
          return anyExisting;
        }
        
        // Different thread or no threadId - allow regeneration (rare case)
        console.log(`🔄 [Email Draft Queue] Found existing ${anyExisting.status} draft, resetting to pending for email ${options.emailId}`);
        
        // Reset the draft to pending status so it can be regenerated
        anyExisting.status = 'pending';
        anyExisting.draftContent = undefined;
        anyExisting.draftId = undefined;
        anyExisting.error = undefined;
        anyExisting.retryCount = 0;
        anyExisting.subject = options.subject;
        anyExisting.fromEmail = options.fromEmail;
        anyExisting.fromName = options.fromName;
        anyExisting.originalBody = options.originalBody;
        if (options.threadId) anyExisting.threadId = options.threadId; // Update threadId if provided
        if (options.agentId) anyExisting.agentId = options.agentId;
        if (options.priority) anyExisting.priority = options.priority;
        
        await anyExisting.save();
        return anyExisting;
      }
    }

    // Create queue entry
    const queueItem = new EmailDraftQueue({
      userId: options.userId,
      agentId: options.agentId,
      conversationId: options.conversationId,
      messageId: options.messageId,
      contactId: options.contactId,
      emailId: options.emailId,
      threadId: options.threadId,
      subject: options.subject,
      fromEmail: options.fromEmail,
      fromName: options.fromName,
      originalBody: options.originalBody,
      agentSettings: options.agentSettings,
      status: 'pending',
      priority: options.priority || 'medium',
      retryCount: 0,
      maxRetries: 3
    });

    await queueItem.save();
    emailDraftQueueLogger.info('Draft queued for generation', {
      emailId: options.emailId,
      threadId: options.threadId,
      subject: options.subject?.substring(0, 50),
      queueItemId: queueItem.id
    });
    
    return queueItem;
  } catch (error: any) {
    // Handle duplicate key error (in case unique index still exists in DB)
    if (error.code === 11000 || error.message?.includes('duplicate key')) {
      console.log(`⚠️ [Email Draft Queue] Duplicate key error, fetching existing draft for email ${options.emailId}`);
      
      // Try to find the existing draft
      const existing = await EmailDraftQueue.findOne({
        userId: options.userId,
        emailId: options.emailId
      });
      
      if (existing) {
        console.log(`✅ [Email Draft Queue] Found existing draft: ${existing.id} with status: ${existing.status}`);
        return existing;
      }
    }
    
    console.error(`❌ [Email Draft Queue] Error queueing draft:`, error.message);
    throw error;
  }
}

/**
 * Process a single draft queue item
 */
export async function processDraftQueueItem(queueItemId: string): Promise<{
  success: boolean;
  draftId?: string;
  error?: string;
}> {
  try {
    const queueItem = await EmailDraftQueue.findById(queueItemId);
    if (!queueItem) {
      throw new Error('Queue item not found');
    }

    if (queueItem.status === 'completed') {
      return { success: true, draftId: queueItem.draftId };
    }

    // CRITICAL: Double-check that no other draft for this thread is being processed or completed
    // This prevents race conditions where multiple items for the same thread are processed simultaneously
    if (queueItem.threadId) {
      const existingDraft = await EmailDraftQueue.findOne({
        userId: queueItem.userId,
        threadId: queueItem.threadId,
        status: { $in: ['generating', 'completed'] },
        _id: { $ne: queueItem._id } // Exclude current item
      });

      if (existingDraft) {
        console.log(`⏸️  [Email Draft Queue] Another draft for thread ${queueItem.threadId} is already ${existingDraft.status} (draftId: ${existingDraft.draftId || 'N/A'}, emailId: ${existingDraft.emailId}). Skipping current item (emailId: ${queueItem.emailId}).`);
        
        // Mark this item as completed and link to existing draft
        queueItem.status = 'completed';
        queueItem.draftId = existingDraft.draftId; // Link to existing draft
        queueItem.draftContent = existingDraft.draftContent; // Copy content if available
        await queueItem.save();
        
        return {
          success: true,
          draftId: existingDraft.draftId
        };
      }
    }

    // Update status to generating
    queueItem.status = 'generating';
    await queueItem.save();
    console.log(`🔄 [Email Draft Queue] Processing draft for thread ${queueItem.threadId || 'N/A'} (emailId: ${queueItem.emailId})`);

    const startTime = Date.now();

    try {
      // Generate draft content
      emailDraftQueueLogger.info('Generating draft content', {
        emailId: queueItem.emailId,
        threadId: queueItem.threadId,
        subject: queueItem.subject?.substring(0, 50)
      });
      
      const draftContent = await generateEmailDraftWithContext({
        emailId: queueItem.emailId,
        emailSubject: queueItem.subject,
        emailBody: queueItem.originalBody,
        fromEmail: queueItem.fromEmail,
        fromName: queueItem.fromName,
        userId: queueItem.userId.toString(),
        agentId: queueItem.agentId?.toString(),
        conversationId: queueItem.conversationId?.toString(),
        threadId: queueItem.threadId
      });

      queueItem.draftContent = draftContent;

      // Get user email for "to" field
      const user = await User.findById(queueItem.userId);
      if (!user || !user.email) {
        throw new Error('User email not found');
      }

      // Create draft in Gmail
      emailDraftQueueLogger.info('Creating draft in Gmail', {
        emailId: queueItem.emailId,
        threadId: queueItem.threadId
      });
      
      // CRITICAL: Get the last message ID from the thread to reply to the most recent email
      // This ensures the draft is created as a reply to the last email, not the first
      let replyToMessageId = queueItem.emailId; // Default to queueItem.emailId
      
      if (queueItem.threadId) {
        try {
          const { getGmailClient } = await import('./gmail.service');
          const { google } = await import('googleapis');
          
          const oauth2Client = await getGmailClient(queueItem.userId.toString());
          if (oauth2Client) {
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            
            // Fetch the thread to get all messages
            const threadResponse = await gmail.users.threads.get({
              userId: 'me',
              id: queueItem.threadId,
              format: 'minimal' // We only need message IDs and dates
            });
            
            const thread = threadResponse.data;
            if (thread.messages && thread.messages.length > 0) {
              // Sort messages by internalDate (most recent last)
              const sortedMessages = thread.messages
                .filter(msg => msg.id && msg.internalDate)
                .sort((a, b) => {
                  const dateA = Number(a.internalDate || 0);
                  const dateB = Number(b.internalDate || 0);
                  return dateA - dateB; // Oldest first
                });
              
              // Get the last (most recent) message ID
              const lastMessage = sortedMessages[sortedMessages.length - 1];
              if (lastMessage?.id) {
                replyToMessageId = lastMessage.id;
                emailDraftQueueLogger.info('Using last message ID from thread', {
                  lastMessageId: replyToMessageId,
                  originalEmailId: queueItem.emailId,
                  threadId: queueItem.threadId
                });
              }
            }
          }
        } catch (threadError: any) {
          emailDraftQueueLogger.warn('Could not fetch thread to get last message ID - using queueItem.emailId', {
            error: threadError.message,
            emailId: queueItem.emailId,
            threadId: queueItem.threadId
          });
          // Continue with queueItem.emailId as fallback
        }
      }
      
      const draftResult = await createGmailDraft({
        userId: queueItem.userId.toString(),
        to: queueItem.fromEmail,
        subject: `Re: ${queueItem.subject}`,
        body: draftContent,
        threadId: queueItem.threadId,
        replyToMessageId: replyToMessageId
      });

      queueItem.draftId = draftResult.id;
      queueItem.status = 'completed';
      queueItem.metadata = {
        generationTime: Date.now() - startTime,
        updatedAt: new Date(),
        tags: queueItem.metadata?.tags || []
      };
      queueItem.retryCount = 0;
      queueItem.error = undefined;

      await queueItem.save();

      emailDraftQueueLogger.info('Draft created successfully', {
        draftId: draftResult.id,
        threadId: queueItem.threadId,
        emailId: queueItem.emailId,
        replyToMessageId: replyToMessageId,
        generationTime: Date.now() - startTime
      });
      
      return {
        success: true,
        draftId: draftResult.id
      };
    } catch (error: any) {
      emailDraftQueueLogger.error('Error processing draft queue item', {
        queueItemId,
        emailId: queueItem.emailId,
        threadId: queueItem.threadId,
        error: error.message,
        stack: error.stack
      });
      
      queueItem.retryCount += 1;
      queueItem.error = error.message;
      
      if (queueItem.retryCount >= queueItem.maxRetries) {
        queueItem.status = 'failed';
        emailDraftQueueLogger.error('Max retries reached for draft', {
          emailId: queueItem.emailId,
          threadId: queueItem.threadId,
          retryCount: queueItem.retryCount,
          maxRetries: queueItem.maxRetries
        });
      } else {
        queueItem.status = 'pending';
        emailDraftQueueLogger.info('Will retry draft generation', {
          emailId: queueItem.emailId,
          threadId: queueItem.threadId,
          attempt: queueItem.retryCount,
          maxRetries: queueItem.maxRetries
        });
      }
      
      queueItem.metadata = {
        generationTime: Date.now() - startTime,
        updatedAt: new Date(),
        tags: queueItem.metadata?.tags || []
      };
      
      await queueItem.save();

      return {
        success: false,
        error: error.message
      };
    }
  } catch (error: any) {
    console.error(`❌ [Email Draft Queue] Error processing queue item:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Reset stuck drafts (drafts that have been in 'generating' status for too long)
 */
export async function resetStuckDrafts(stuckThresholdMinutes: number = 30): Promise<number> {
  try {
    const thresholdTime = new Date(Date.now() - stuckThresholdMinutes * 60 * 1000);
    
    // Find drafts stuck in 'generating' status for more than threshold
    const stuckDrafts = await EmailDraftQueue.find({
      status: 'generating',
      updatedAt: { $lt: thresholdTime } // Updated more than threshold minutes ago
    });

    if (stuckDrafts.length === 0) {
      return 0;
    }

    console.log(`🔧 [Email Draft Queue] Found ${stuckDrafts.length} stuck draft(s) in 'generating' status (older than ${stuckThresholdMinutes} minutes)`);

    let resetCount = 0;
    for (const draft of stuckDrafts) {
      try {
        // Check if draft actually exists in Gmail (might have been created but status not updated)
        // For now, just reset to pending to allow retry
        const oldStatus = draft.status;
        draft.status = 'pending';
        draft.error = `Stuck in ${oldStatus} status for more than ${stuckThresholdMinutes} minutes - reset for retry`;
        draft.retryCount = (draft.retryCount || 0) + 1;
        
        // Only reset if retry count hasn't exceeded max
        if (draft.retryCount <= (draft.maxRetries || 3)) {
          await draft.save();
          resetCount++;
          console.log(`🔄 [Email Draft Queue] Reset stuck draft ${draft.id} (emailId: ${draft.emailId}, threadId: ${draft.threadId || 'N/A'}) to pending status (retry ${draft.retryCount}/${draft.maxRetries || 3})`);
        } else {
          // Max retries exceeded, mark as failed
          draft.status = 'failed';
          draft.error = `Max retries exceeded after being stuck in ${oldStatus} status`;
          await draft.save();
          console.log(`❌ [Email Draft Queue] Marked stuck draft ${draft.id} as failed (max retries exceeded)`);
        }
      } catch (error: any) {
        console.error(`❌ [Email Draft Queue] Error resetting stuck draft ${draft.id}:`, error.message);
      }
    }

    if (resetCount > 0) {
      console.log(`✅ [Email Draft Queue] Reset ${resetCount} stuck draft(s) to pending status`);
    }

    return resetCount;
  } catch (error: any) {
    console.error(`❌ [Email Draft Queue] Error resetting stuck drafts:`, error.message);
    return 0;
  }
}

/**
 * Get pending draft queue items
 * CRITICAL: Filters to ensure only one item per thread is processed at a time
 */
export async function getPendingDraftQueueItems(limit: number = 10): Promise<IEmailDraftQueue[]> {
  try {
    // Get all pending items, sorted by priority and creation time
    const allPendingItems = await EmailDraftQueue.find({
      status: 'pending'
    })
      .sort({ priority: -1, createdAt: 1 }); // Sort by priority (high first), then by creation time

    // Filter: Only include one item per thread
    // If multiple items exist for same thread, take the oldest one (first in sorted order)
    const threadMap = new Map<string, IEmailDraftQueue>();
    const items: IEmailDraftQueue[] = [];

    for (const item of allPendingItems) {
      if (!item.threadId) {
        // If no threadId, include it (single email, not part of thread)
        items.push(item);
        if (items.length >= limit) break;
        continue;
      }

      // Check if we already have an item for this thread
      if (!threadMap.has(item.threadId)) {
        threadMap.set(item.threadId, item);
        items.push(item);
        if (items.length >= limit) break;
      } else {
        // Another item for this thread already selected
        // Mark this as skipped to prevent duplicate processing
        const existingItem = threadMap.get(item.threadId);
        console.log(`⏸️  [Email Draft Queue] Skipping duplicate queue item for thread ${item.threadId} (emailId: ${item.emailId}, existing emailId: ${existingItem?.emailId})`);
      }
    }

    if (items.length > 0 && threadMap.size > 0) {
      console.log(`📋 [Email Draft Queue] Filtered to ${items.length} pending items (${threadMap.size} unique threads)`);
    }

    return items;
  } catch (error: any) {
    console.error(`❌ [Email Draft Queue] Error fetching pending items:`, error.message);
    throw error;
  }
}

/**
 * Get draft queue items for a user
 */
export async function getUserDraftQueueItems(
  userId: string,
  filters?: { status?: DraftStatus; conversationId?: string; approvalState?: string }
): Promise<IEmailDraftQueue[]> {
  try {
    const query: any = { userId };
    
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.conversationId) {
      query.conversationId = filters.conversationId;
    }
    if (filters?.approvalState) {
      query.approvalState = filters.approvalState;
    }

    const items = await EmailDraftQueue.find(query)
      .sort({ createdAt: -1 })
      .limit(100);

    return items;
  } catch (error: any) {
    console.error(`❌ [Email Draft Queue] Error fetching user draft queue items:`, error.message);
    throw error;
  }
}

/**
 * Get a single draft queue item by ID
 */
export async function getDraftQueueItem(
  queueItemId: string,
  userId: string
): Promise<IEmailDraftQueue | null> {
  try {
    const item = await EmailDraftQueue.findOne({
      _id: queueItemId,
      userId
    });
    return item;
  } catch (error: any) {
    console.error(`❌ [Email Draft Queue] Error fetching draft queue item:`, error.message);
    throw error;
  }
}

/**
 * Reset a stuck draft (force reset from generating/failed to pending)
 */
export async function resetDraftQueueItem(
  queueItemId: string,
  userId: string
): Promise<IEmailDraftQueue | null> {
  try {
    const item = await EmailDraftQueue.findOne({
      _id: queueItemId,
      userId
    });
    
    if (!item) {
      throw new Error('Draft queue item not found');
    }

    // Allow reset for generating, failed, or completed status
    // Completed drafts can be reset if user wants to regenerate them
    if (!['generating', 'failed', 'completed'].includes(item.status)) {
      throw new Error(`Cannot reset draft in ${item.status} status. Only 'generating', 'failed', or 'completed' drafts can be reset.`);
    }

    const oldStatus = item.status;
    item.status = 'pending';
    item.error = undefined;
    item.draftId = undefined; // Clear draftId so a new draft can be created
    item.draftContent = undefined; // Clear draft content so it can be regenerated
    // Don't reset retry count - keep track of how many times we've tried
    
    await item.save();

    console.log(`🔄 [Email Draft Queue] Manually reset draft ${queueItemId} from ${oldStatus} to pending (retry ${item.retryCount}/${item.maxRetries || 3})`);
    
    return item;
  } catch (error: any) {
    console.error(`❌ [Email Draft Queue] Error resetting draft queue item:`, error.message);
    throw error;
  }
}

/**
 * Delete draft queue items by IDs
 */
export async function deleteDraftQueueItems(
  queueItemIds: string[],
  userId: string
): Promise<{ deletedCount: number; errors: string[] }> {
  try {
    const result = await EmailDraftQueue.deleteMany({
      _id: { $in: queueItemIds },
      userId // Ensure user owns the drafts
    });

    console.log(`✅ [Email Draft Queue] Deleted ${result.deletedCount} draft queue item(s)`);
    
    return {
      deletedCount: result.deletedCount,
      errors: []
    };
  } catch (error: any) {
    console.error(`❌ [Email Draft Queue] Error deleting draft queue items:`, error.message);
    throw error;
  }
}

