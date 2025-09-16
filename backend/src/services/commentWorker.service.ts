import InstagramComment from '../models/instagramComment.model';
import InstagramAccount from '../models/instagramAccount.model';
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

      // Find pending comments
      const pendingComments = await InstagramComment.find({ 
        status: 'pending' 
      }).sort({ timestamp: 1 }); // Process oldest first

      if (pendingComments.length === 0) {
        console.log('✅ [Comment Worker] No pending comments to process');
        return;
      }

      console.log(`📝 [Comment Worker] Found ${pendingComments.length} pending comments`);

      // Process each comment
      for (const comment of pendingComments) {
        try {
          await this.processComment(comment);
        } catch (error) {
          console.error(`❌ [Comment Worker] Error processing comment ${comment.commentId}:`, error);
          
          // Mark comment as failed
          comment.status = 'failed';
          await comment.save();
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

      // Check if comment processing is enabled
      if (!account.commentSettings?.enabled) {
        console.log(`⚠️ [Comment Worker] Comment processing disabled for account: ${account.accountName}`);
        comment.status = 'failed';
        await comment.save();
        return;
      }

      // Create comment service instance
      const commentService = new InstagramCommentService();

      // Apply delay if configured
      if (account.commentSettings.replyDelay > 0) {
        console.log(`⏳ [Comment Worker] Waiting ${account.commentSettings.replyDelay} seconds before processing`);
        await new Promise(resolve => setTimeout(resolve, account.commentSettings.replyDelay * 1000));
      }

      // Reply to comment if enabled
      if (account.commentSettings.autoReplyComment) {
        try {
          await commentService.replyToComment(
            comment.commentId, 
            account.commentSettings.commentMessage, 
            account.accessToken
          );
          comment.status = 'replied';
          comment.replyText = account.commentSettings.commentMessage;
          comment.replyTimestamp = new Date();
          console.log(`✅ [Comment Worker] Comment reply sent: ${comment.commentId}`);
        } catch (error) {
          console.error(`❌ [Comment Worker] Failed to reply to comment:`, error);
          comment.status = 'failed';
        }
      }

      // Send DM if enabled
      if (account.commentSettings.autoReplyDM) {
        try {
          await commentService.sendDMReply(
            comment.userId, 
            account.commentSettings.dmMessage, 
            account.accessToken, 
            account.accountId
          );
          comment.dmSent = true;
          comment.dmTimestamp = new Date();
          console.log(`✅ [Comment Worker] DM sent to user: ${comment.userId}`);
        } catch (error) {
          console.error(`❌ [Comment Worker] Failed to send DM:`, error);
        }
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
    replied: number;
    failed: number;
  }> {
    try {
      const [total, pending, replied, failed] = await Promise.all([
        InstagramComment.countDocuments(),
        InstagramComment.countDocuments({ status: 'pending' }),
        InstagramComment.countDocuments({ status: 'replied' }),
        InstagramComment.countDocuments({ status: 'failed' })
      ]);

      return { total, pending, replied, failed };
    } catch (error) {
      console.error('❌ [Comment Worker] Error getting stats:', error);
      return { total: 0, pending: 0, replied: 0, failed: 0 };
    }
  }
}

// Create singleton instance
const commentWorkerService = new CommentWorkerService();

export default commentWorkerService;
