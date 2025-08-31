import axios, { AxiosResponse } from 'axios';
import InstagramAccount, { IInstagramAccount } from '../models/instagramAccount.model';

// Instagram API response interfaces
interface InstagramMessageResponse {
  message_id: string;
  recipient_id: string;
}

interface InstagramErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

interface InstagramUserInfo {
  id: string;
  name: string;
  profile_picture_url?: string;
}

interface InstagramAccountInfo {
  id: string;
  name: string;
  username: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

export class InstagramApiService {
  private baseUrl = 'https://graph.facebook.com/v18.0';
  private accessToken: string = '';
  private accountId: string;

  constructor(accountId: string) {
    this.accountId = accountId;
  }

  /**
   * Initialize the service with account credentials
   */
  async initialize(): Promise<void> {
    try {
      const account = await InstagramAccount.findOne({ accountId: this.accountId, isActive: true });
      if (!account) {
        throw new Error(`Instagram account not found or inactive: ${this.accountId}`);
      }

      if (account.tokenExpiry <= new Date()) {
        throw new Error(`Instagram access token expired for account: ${this.accountId}`);
      }

      this.accessToken = account.accessToken;
    } catch (error) {
      console.error('Failed to initialize Instagram API service:', error);
      throw error;
    }
  }

  /**
   * Send a message to a user via Instagram DM
   */
  async sendMessage(psid: string, message: string, options?: {
    quickReplies?: Array<{ text: string; payload?: string }>;
    buttons?: Array<{
      type: 'web_url' | 'postback' | 'phone_number';
      title: string;
      url?: string;
      payload?: string;
      phoneNumber?: string;
    }>;
  }): Promise<InstagramMessageResponse> {
    try {
      await this.initialize();

      const messageData: any = {
        recipient: { id: psid },
        message: { text: message }
      };

      // Add quick replies if provided
      if (options?.quickReplies && options.quickReplies.length > 0) {
        messageData.message.quick_replies = options.quickReplies;
      }

      // Add buttons if provided
      if (options?.buttons && options.buttons.length > 0) {
        messageData.message.attachment = {
          type: 'template',
          payload: {
            template_type: 'button',
            text: message,
            buttons: options.buttons
          }
        };
        // Remove text when using buttons template
        delete messageData.message.text;
      }

      const response: AxiosResponse<InstagramMessageResponse> = await axios.post(
        `${this.baseUrl}/me/messages`,
        messageData,
        {
          params: {
            access_token: this.accessToken
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Update account metadata
      await this.updateAccountMetadata('messageSent');

      return response.data;
    } catch (error: any) {
      await this.handleApiError(error, 'sendMessage');
      throw error;
    }
  }

  /**
   * Send a message with attachments (image, video, etc.)
   */
  async sendMessageWithAttachment(psid: string, attachment: {
    type: 'image' | 'video' | 'audio' | 'file';
    url: string;
    caption?: string;
  }): Promise<InstagramMessageResponse> {
    try {
      await this.initialize();

      const messageData = {
        recipient: { id: psid },
        message: {
          attachment: {
            type: attachment.type,
            payload: {
              url: attachment.url
            }
          }
        }
      };

              // Add caption if provided
        if (attachment.caption) {
          (messageData.message.attachment.payload as any).caption = attachment.caption;
        }

      const response: AxiosResponse<InstagramMessageResponse> = await axios.post(
        `${this.baseUrl}/me/messages`,
        messageData,
        {
          params: {
            access_token: this.accessToken
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Update account metadata
      await this.updateAccountMetadata('messageSent');

      return response.data;
    } catch (error: any) {
      await this.handleApiError(error, 'sendMessageWithAttachment');
      throw error;
    }
    }

  /**
   * Get user information by PSID
   */
  async getUserInfo(psid: string): Promise<InstagramUserInfo> {
    try {
      await this.initialize();

      const response: AxiosResponse<InstagramUserInfo> = await axios.get(
        `${this.baseUrl}/${psid}`,
        {
          params: {
            access_token: this.accessToken,
            fields: 'id,name,profile_picture_url'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      await this.handleApiError(error, 'getUserInfo');
      throw error;
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<InstagramAccountInfo> {
    try {
      await this.initialize();

      const response: AxiosResponse<InstagramAccountInfo> = await axios.get(
        `${this.baseUrl}/me`,
        {
          params: {
            access_token: this.accessToken,
            fields: 'id,name,username,profile_picture_url,followers_count,media_count'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      await this.handleApiError(error, 'getAccountInfo');
      throw error;
    }
  }

  /**
   * Validate access token
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.initialize();

      const response = await axios.get(
        `${this.baseUrl}/me`,
        {
          params: {
            access_token: this.accessToken
          }
        }
      );

      return response.status === 200;
    } catch (error: any) {
      console.error('Token validation failed:', error.message);
      return false;
    }
  }

  /**
   * Refresh access token (if refresh token is available)
   */
  async refreshToken(): Promise<void> {
    try {
      const account = await InstagramAccount.findOne({ accountId: this.accountId });
      if (!account?.refreshToken) {
        throw new Error('No refresh token available for this account');
      }

      // Instagram doesn't provide direct token refresh like some other platforms
      // This would typically involve re-authenticating the user
      // For now, we'll mark the token as needing refresh
      account.metadata.lastSync = new Date();
      await account.save();

      throw new Error('Manual re-authentication required for Instagram token refresh');
    } catch (error) {
      console.error('Failed to refresh Instagram token:', error);
      throw error;
    }
  }

  /**
   * Handle Instagram API errors and update account metadata
   */
  private async handleApiError(error: any, operation: string): Promise<void> {
    try {
      const account = await InstagramAccount.findOne({ accountId: this.accountId });
      if (!account) return;

      let errorCode = 'UNKNOWN';
      let errorMessage = error.message;
      let retryAfter: Date | undefined;

      if (error.response?.data?.error) {
        const instagramError = error.response.data.error as InstagramErrorResponse['error'];
        errorCode = instagramError.code.toString();
        errorMessage = instagramError.message;

        // Handle specific Instagram error codes
        switch (instagramError.code) {
          case 100: // Invalid parameter
            errorMessage = `Invalid parameter: ${instagramError.message}`;
            break;
          case 190: // Invalid access token
            errorMessage = 'Access token is invalid or expired';
            retryAfter = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            break;
          case 429: // Rate limit exceeded
            errorMessage = 'Rate limit exceeded';
            retryAfter = new Date(Date.now() + 60 * 1000); // 1 minute
            break;
          case 613: // User limit exceeded
            errorMessage = 'User limit exceeded (24-hour window)';
            retryAfter = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            break;
          default:
            errorMessage = `Instagram API error ${instagramError.code}: ${instagramError.message}`;
        }
      }

      // Update account metadata
      account.metadata.errorCount += 1;

      await account.save();

      console.error(`Instagram API error in ${operation}:`, {
        accountId: this.accountId,
        errorCode,
        errorMessage,
        retryAfter
      });
    } catch (metadataError) {
      console.error('Failed to update account metadata after API error:', metadataError);
    }
  }

  /**
   * Update account metadata after successful operations
   */
  private async updateAccountMetadata(operation: 'messageSent' | 'messageReceived' | 'sync'): Promise<void> {
    try {
      const account = await InstagramAccount.findOne({ accountId: this.accountId });
      if (!account) return;

      switch (operation) {
        case 'messageSent':
          account.metadata.responseCount += 1;
          break;
        case 'messageReceived':
          account.metadata.messageCount += 1;
          break;
        case 'sync':
          account.metadata.lastSync = new Date();
          break;
      }

      await account.save();
    } catch (error) {
      console.error('Failed to update account metadata:', error);
    }
  }

  /**
   * Check if we can send a message to a user (rate limiting and cooldown)
   */
  async canSendMessage(psid: string): Promise<{
    canSend: boolean;
    reason?: string;
    retryAfter?: Date;
  }> {
    try {
      const account = await InstagramAccount.findOne({ accountId: this.accountId });
      if (!account) {
        return { canSend: false, reason: 'Account not found' };
      }

      // Check global rate limit
      const now = new Date();
      const oneSecondAgo = new Date(now.getTime() - 1000);
      
      if (account.rateLimits.messagesPerSecond > 0) {
        // This is a simplified check - in production you'd want more sophisticated rate limiting
        if (account.metadata.responseCount > 0) {
          const lastResponse = account.metadata.lastSync;
          if (lastResponse && lastResponse > oneSecondAgo) {
            return { 
              canSend: false, 
              reason: 'Global rate limit exceeded',
              retryAfter: new Date(now.getTime() + 1000)
            };
          }
        }
      }

      // Check user cooldown
      if (account.rateLimits.userCooldown > 0) {
        // This would need to be implemented with conversation tracking
        // For now, we'll return true
      }

      return { canSend: true };
    } catch (error) {
      console.error('Failed to check if can send message:', error);
      return { canSend: false, reason: 'Error checking rate limits' };
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimitInfo(): Promise<{
    globalLimit: number;
    userCooldown: number;
    messagesSentToday: number;
    remainingMessages: number;
  }> {
    try {
      const account = await InstagramAccount.findOne({ accountId: this.accountId });
      if (!account) {
        throw new Error('Account not found');
      }

      // Instagram has a limit of 250 messages per user per day
      const messagesSentToday = account.metadata.responseCount;
      const remainingMessages = Math.max(0, 250 - messagesSentToday);

      return {
        globalLimit: account.rateLimits.messagesPerSecond,
        userCooldown: account.rateLimits.userCooldown,
        messagesSentToday,
        remainingMessages
      };
    } catch (error) {
      console.error('Failed to get rate limit info:', error);
      throw error;
    }
  }
}

export default InstagramApiService;
