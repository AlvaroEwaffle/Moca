import InstagramAccount from '../models/instagramAccount.model';
import InstagramComment from '../models/instagramComment.model';

export class InstagramCommentService {
  /**
   * Process Instagram comment with fixed responses
   */
  async processComment(comment: any, accountId: string): Promise<void> {
    try {
      console.log(`💬 [Comment Service] Processing comment ${comment.id} for account ${accountId}`);

      // Get the Instagram account
      const account = await InstagramAccount.findOne({ accountId, isActive: true });
      if (!account) {
        console.error(`❌ [Comment Service] Account not found: ${accountId}`);
        return;
      }

      // Check if comment processing is enabled
      if (!account.commentSettings?.enabled) {
        console.log(`⚠️ [Comment Service] Comment processing disabled for account: ${account.accountName}`);
        return;
      }

      // Find the comment record
      const commentDoc = await InstagramComment.findOne({ commentId: comment.id });
      if (!commentDoc) {
        console.error(`❌ [Comment Service] Comment record not found: ${comment.id}`);
        return;
      }

      // Apply delay if configured
      if (account.commentSettings.replyDelay > 0) {
        console.log(`⏳ [Comment Service] Waiting ${account.commentSettings.replyDelay} seconds before processing`);
        await new Promise(resolve => setTimeout(resolve, account.commentSettings.replyDelay * 1000));
      }

      // Reply to comment if enabled
      if (account.commentSettings.autoReplyComment) {
        try {
          await this.replyToComment(comment.id, account.commentSettings.commentMessage, account.accessToken);
          commentDoc.status = 'replied';
          commentDoc.replyText = account.commentSettings.commentMessage;
          commentDoc.replyTimestamp = new Date();
          console.log(`✅ [Comment Service] Comment reply sent: ${comment.id}`);
        } catch (error) {
          console.error(`❌ [Comment Service] Failed to reply to comment:`, error);
          commentDoc.status = 'failed';
        }
      }

      // Send DM if enabled
      if (account.commentSettings.autoReplyDM) {
        try {
          await this.sendDMReply(comment.from.id, account.commentSettings.dmMessage, account.accessToken, account.accountId);
          commentDoc.dmSent = true;
          commentDoc.dmTimestamp = new Date();
          console.log(`✅ [Comment Service] DM sent to user: ${comment.from.id}`);
        } catch (error) {
          console.error(`❌ [Comment Service] Failed to send DM:`, error);
        }
      }

      // Save updated comment record
      await commentDoc.save();
      console.log(`✅ [Comment Service] Comment processing completed: ${comment.id}`);

    } catch (error) {
      console.error('❌ [Comment Service] Error processing comment:', error);
      throw error;
    }
  }

  /**
   * Reply to Instagram comment using v23.0 API
   */
  async replyToComment(commentId: string, replyText: string, accessToken: string): Promise<any> {
    try {
      console.log(`💬 [Comment Reply] Replying to comment ${commentId} with: "${replyText}"`);

      const response = await fetch(`https://graph.instagram.com/v23.0/${commentId}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          message: replyText
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Instagram API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      console.log(`✅ [Comment Reply] Reply sent successfully:`, result);
      return result;

    } catch (error) {
      console.error(`❌ [Comment Reply] Error replying to comment:`, error);
      throw error;
    }
  }

  /**
   * Send DM to user using v23.0 API
   */
  async sendDMReply(userId: string, message: string, accessToken: string, accountId: string): Promise<any> {
    try {
      console.log(`💬 [DM Reply] Sending DM to user ${userId} with: "${message}"`);

      const response = await fetch(`https://graph.instagram.com/v23.0/${accountId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient: {
            id: userId
          },
          message: {
            text: message
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Instagram API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      console.log(`✅ [DM Reply] DM sent successfully:`, result);
      return result;

    } catch (error) {
      console.error(`❌ [DM Reply] Error sending DM:`, error);
      throw error;
    }
  }

  /**
   * Get media details (for future use with AI)
   */
  async getMediaDetails(mediaId: string, accessToken: string): Promise<any> {
    try {
      console.log(`📸 [Media Details] Fetching media details for: ${mediaId}`);

      const response = await fetch(`https://graph.instagram.com/v23.0/${mediaId}?fields=caption,owner,username&access_token=${accessToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Instagram API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      console.log(`✅ [Media Details] Media details fetched:`, result);
      return result;

    } catch (error) {
      console.error(`❌ [Media Details] Error fetching media details:`, error);
      throw error;
    }
  }

  /**
   * Get comments for a media item
   */
  async getComments(mediaId: string, accessToken: string): Promise<any> {
    try {
      console.log(`💬 [Get Comments] Fetching comments for media: ${mediaId}`);

      const response = await fetch(`https://graph.instagram.com/v23.0/${mediaId}/comments?access_token=${accessToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Instagram API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      console.log(`✅ [Get Comments] Comments fetched:`, result);
      return result;

    } catch (error) {
      console.error(`❌ [Get Comments] Error fetching comments:`, error);
      throw error;
    }
  }
}

export default InstagramCommentService;
