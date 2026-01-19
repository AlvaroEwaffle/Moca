import InstagramComment from '../models/instagramComment.model';
import InstagramAccount from '../models/instagramAccount.model';
import CommentAutoReplyRule from '../models/commentAutoReplyRule.model';
import { InstagramCommentService } from './instagramComment.service';

export class CommentWorkerService {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly PROCESSING_INTERVAL = 30000; // 30 seconds

  constructor() {
    console.log('🔧 [Comment Worker] Service initialized');
  }

  /**
   * Start the comment worker
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ [Comment Worker] Already running');
      return;
    }

    console.log('🚀 [Comment Worker] Starting comment processing worker');
    this.isRunning = true;

    // Process immediately on start
    this.processPendingComments();

    // Set up interval for periodic processing
    this.intervalId = setInterval(() => {
      this.processPendingComments();
    }, this.PROCESSING_INTERVAL);

    console.log(`✅ [Comment Worker] Started with ${this.PROCESSING_INTERVAL}ms interval`);
  }

  /**
   * Stop the comment worker
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ [Comment Worker] Not running');
      return;
    }

    console.log('🛑 [Comment Worker] Stopping comment processing worker');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('✅ [Comment Worker] Stopped');
  }

  /**
   * Process pending comments
   */
  async processPendingComments(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log('🔄 [Comment Worker] Processing pending comments...');

      // Find pending comments that haven't been processed recently
      const pendingComments = await InstagramComment.find({ 
        status: 'pending',
        // Add a time filter to avoid processing comments that were just created
        timestamp: { $lt: new Date(Date.now() - 5000) } // Process comments older than 5 seconds
      }).sort({ timestamp: 1 }); // Process oldest first

      if (pendingComments.length === 0) {
        console.log('✅ [Comment Worker] No pending comments to process');
        return;
      }

      console.log(`📝 [Comment Worker] Found ${pendingComments.length} pending comments`);

      // Process each comment
      for (const comment of pendingComments) {
        try {
          // Double-check that comment is still pending (race condition protection)
          const currentComment = await InstagramComment.findById(comment._id);
          if (!currentComment || currentComment.status !== 'pending') {
            console.log(`⚠️ [Comment Worker] Comment ${comment.commentId} already processed, skipping`);
            continue;
          }

          // Mark comment as processing to prevent duplicate processing
          currentComment.status = 'processing';
          await currentComment.save();
          
          console.log(`💬 [Comment Worker] Processing comment: ${currentComment.commentId}`);
          await this.processComment(currentComment);
        } catch (error) {
          console.error(`❌ [Comment Worker] Error processing comment ${comment.commentId}:`, error);
          
          // Mark comment as failed
          try {
            const failedComment = await InstagramComment.findById(comment._id);
            if (failedComment) {
              failedComment.status = 'failed';
              await failedComment.save();
            }
          } catch (saveError) {
            console.error(`❌ [Comment Worker] Error saving failed status:`, saveError);
          }
        }
      }

      console.log(`✅ [Comment Worker] Processed ${pendingComments.length} comments`);

    } catch (error) {
      console.error('❌ [Comment Worker] Error in processPendingComments:', error);
    }
  }

  /**
   * Process individual comment
   */
  private async processComment(comment: any): Promise<void> {
    try {
      console.log(`💬 [Comment Worker] Processing comment: ${comment.commentId}`);

      // Get the account
      const account = await InstagramAccount.findOne({ 
        accountId: comment.accountId, 
        isActive: true 
      });

      if (!account) {
        console.error(`❌ [Comment Worker] Account not found: ${comment.accountId}`);
        comment.status = 'failed';
        await comment.save();
        return;
      }

      // Check if there are any enabled rules for this account (this is the source of truth)
      const rules = await CommentAutoReplyRule.find({ 
        accountId: comment.accountId,
        enabled: true 
      });

      if (rules.length === 0) {
        console.log(`⚠️ [Comment Worker] No enabled auto-reply rules configured for account: ${account.accountName}`);
        comment.status = 'omitted';
        await comment.save();
        return;
      }

      // Also check if comment processing is globally enabled (for backward compatibility)
      // But rules being present is the primary check
      if (account.commentSettings?.enabled === false) {
        console.log(`⚠️ [Comment Worker] Comment auto-reply globally disabled for account: ${account.accountName}`);
        comment.status = 'omitted';
        await comment.save();
        return;
      }

      // Search for matching keyword in comment text (case-insensitive)
      const commentTextLower = comment.text.toLowerCase();
      let matchedRule = null;

      for (const rule of rules) {
        if (commentTextLower.includes(rule.keyword)) {
          matchedRule = rule;
          break; // Use first matching rule
        }
      }

      // Create comment service instance
      const commentService = new InstagramCommentService();

      if (!matchedRule) {
        // No keyword match - mark as omitted
        console.log(`ℹ️ [Comment Worker] No keyword match found for comment: ${comment.commentId}`);
        comment.status = 'omitted';
        await comment.save();
        return;
      }

      // Keyword matched - mark as detected
      console.log(`🔍 [Comment Worker] Keyword "${matchedRule.keyword}" matched for comment: ${comment.commentId}`);
      comment.status = 'detected';
      comment.matchedKeyword = matchedRule.keyword;
      comment.matchedRuleId = matchedRule._id;
      await comment.save();

      // Reply to comment using matched rule's response message
        try {
          await commentService.replyToComment(
            comment.commentId, 
          matchedRule.responseMessage, 
            account.accessToken
          );
          comment.status = 'replied';
        comment.replyText = matchedRule.responseMessage;
          comment.replyTimestamp = new Date();
        console.log(`✅ [Comment Worker] Comment reply sent using rule "${matchedRule.keyword}": ${comment.commentId}`);
        
        // Send DM if rule is configured to do so
        if (matchedRule.sendDM && matchedRule.dmMessage && !comment.dmFailed) {
          try {
            console.log(`💬 [Comment Worker] Sending DM after comment reply using rule "${matchedRule.keyword}"`);
            console.log(`💬 [Comment Worker] Comment ID: ${comment.commentId}, User ID: ${comment.userId}`);
          await commentService.sendDMReply(
              comment.commentId, // Use commentId for comment-based DM
              comment.userId, // Also pass userId as fallback
              matchedRule.dmMessage, 
            account.accessToken, 
            account.accountId
          );
          comment.dmSent = true;
          comment.dmTimestamp = new Date();
            comment.dmFailed = false;
          comment.dmFailureReason = undefined;
          comment.dmFailureTimestamp = undefined;
            console.log(`✅ [Comment Worker] DM sent successfully after comment reply using rule "${matchedRule.keyword}"`);
        } catch (error) {
          console.error(`❌ [Comment Worker] Failed to send DM:`, error);
          
          // Check if it's a daily limit error
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isDailyLimitError = errorMessage.includes('لا يمكن العثور على المستخدم المطلوب') || 
                                  errorMessage.includes('The requested user cannot be found') ||
                                  errorMessage.includes('error_subcode":2534014');
          
          if (isDailyLimitError) {
            comment.dmFailed = true;
            comment.dmFailureReason = 'Daily DM limit reached';
            comment.dmFailureTimestamp = new Date();
            console.log(`⚠️ [Comment Worker] DM daily limit reached for account ${account.accountName}, marking as failed`);
            } else {
              // Mark as failed for other errors too
              comment.dmFailed = true;
              comment.dmFailureReason = errorMessage;
              comment.dmFailureTimestamp = new Date();
          }
        }
        } else {
          const reasons = [];
          if (!matchedRule.sendDM) reasons.push('sendDM is false');
          if (!matchedRule.dmMessage) reasons.push('dmMessage is empty/missing');
          if (comment.dmFailed) reasons.push('previous DM attempt failed');
          
          console.log(`⚠️ [Comment Worker] DM not sent for rule "${matchedRule.keyword}". Reasons: ${reasons.join(', ')}`);
        }
      } catch (error) {
        console.error(`❌ [Comment Worker] Failed to reply to comment:`, error);
        comment.status = 'failed';
      }

      // Save updated comment
      await comment.save();
      console.log(`✅ [Comment Worker] Comment processing completed: ${comment.commentId}`);

    } catch (error) {
      console.error(`❌ [Comment Worker] Error processing comment:`, error);
      throw error;
    }
  }

  /**
   * Get worker status
   */
  getStatus(): { isRunning: boolean; interval: number } {
    return {
      isRunning: this.isRunning,
      interval: this.PROCESSING_INTERVAL
    };
  }

  /**
   * Get pending comments count
   */
  async getPendingCount(): Promise<number> {
    try {
      return await InstagramComment.countDocuments({ status: 'pending' });
    } catch (error) {
      console.error('❌ [Comment Worker] Error getting pending count:', error);
      return 0;
    }
  }

  /**
   * Get comment statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    detected: number;
    replied: number;
    omitted: number;
    failed: number;
  }> {
    try {
      const [total, pending, detected, replied, omitted, failed] = await Promise.all([
        InstagramComment.countDocuments(),
        InstagramComment.countDocuments({ status: 'pending' }),
        InstagramComment.countDocuments({ status: 'detected' }),
        InstagramComment.countDocuments({ status: 'replied' }),
        InstagramComment.countDocuments({ status: 'omitted' }),
        InstagramComment.countDocuments({ status: 'failed' })
      ]);

      return { total, pending, detected, replied, omitted, failed };
    } catch (error) {
      console.error('❌ [Comment Worker] Error getting stats:', error);
      return { total: 0, pending: 0, detected: 0, replied: 0, omitted: 0, failed: 0 };
    }
  }
}

// Create singleton instance
const commentWorkerService = new CommentWorkerService();

export default commentWorkerService;
