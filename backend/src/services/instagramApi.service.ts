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

class InstagramApiService {
  private accessToken: string = '';
  /** Set only when running through the Page fallback; also selects the Graph host. */
  private pageId: string = '';

  constructor() {
    console.log('🔧 InstagramApiService: Initializing service');
  }

  /**
   * Initialize the service with account credentials
   */
  async initialize(accountId: string): Promise<boolean> {
    console.log(`🔧 InstagramApiService: Initializing for account: ${accountId}`);
    
    try {
      const account = await InstagramAccount.findOne({ accountId, isActive: true });
      
      if (!account) {
        console.log(`❌ InstagramApiService: No active account found for ID: ${accountId}`);
        return false;
      }

      console.log(`✅ InstagramApiService: Found account: ${account.accountName}`);

      // Reset per-account routing state — this service instance is reused.
      this.pageId = '';

      // Check if token is expired and try to refresh it
      if (account.tokenExpiry <= new Date()) {
        console.log(`⚠️ InstagramApiService: Token expired for account: ${account.accountName}, attempting refresh...`);
        const refreshSuccess = await this.refreshAccessToken(account);
        if (!refreshSuccess) {
          // An Instagram-Login token that has ALREADY expired cannot be refreshed —
          // ig_refresh_token requires a still-valid token — so this is terminal for
          // that path. Before giving up, try the Page route: Instagram messaging
          // also works through the linked Facebook Page, and the Page token is
          // derivable from the System User token we keep in contentAccessToken.
          // This is what let @ewaffle.cl send again without a manual re-auth.
          const viaPage = await this.initializeViaPage(account);
          if (viaPage) return true;

          console.log(`❌ InstagramApiService: Failed to refresh token for account: ${account.accountName}`);
          return false;
        }
        // Re-fetch the account with updated token
        const updatedAccount = await InstagramAccount.findOne({ accountId, isActive: true });
        if (updatedAccount) {
          this.accessToken = updatedAccount.accessToken;
        }
      } else {
        this.accessToken = account.accessToken;
      }

      console.log(`✅ InstagramApiService: Token valid for account: ${account.accountName}`);
      return true;
    } catch (error) {
      console.error(`❌ InstagramApiService: Error initializing account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Refresh Instagram access token
   */
  async refreshAccessToken(account: IInstagramAccount): Promise<boolean> {
    console.log(`🔄 InstagramApiService: Refreshing access token for account: ${account.accountName}`);
    
    try {
      // Instagram Basic Display API token refresh
      const refreshUrl = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${account.accessToken}`;
      
      console.log(`🔄 InstagramApiService: Refresh URL: ${refreshUrl}`);
      
      const response = await fetch(refreshUrl, {
        method: 'GET'
      });

      console.log(`🔄 InstagramApiService: Refresh response status: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`❌ InstagramApiService: Token refresh failed:`, errorData);
        return false;
      }

      const refreshData = await response.json();
      console.log(`✅ InstagramApiService: Token refresh successful:`, {
        expires_in: refreshData.expires_in,
        access_token: refreshData.access_token ? `${refreshData.access_token.substring(0, 10)}...` : 'none'
      });

      // Update the account with new token and expiry
      const newExpiry = new Date(Date.now() + (refreshData.expires_in * 1000));
      account.accessToken = refreshData.access_token;
      account.tokenExpiry = newExpiry;
      
      await account.save();
      
      console.log(`✅ InstagramApiService: Account updated with new token, expires: ${newExpiry.toISOString()}`);
      return true;
      
    } catch (error) {
      console.error(`❌ InstagramApiService: Error refreshing access token:`, error);
      return false;
    }
  }

  /**
   * Fallback path: send through the linked Facebook Page instead of the Instagram
   * Login token. Requires a Page access token, which a System User token can mint
   * via /me/accounts — note a System User token itself is REJECTED for messaging
   * ("Application does not have the capability"), so minting the Page token is not
   * optional, it is the whole point.
   *
   * Returns true when this instance is ready to send via the Page.
   */
  private async initializeViaPage(account: any): Promise<boolean> {
    const systemToken = account.contentAccessToken;
    if (!systemToken) {
      console.log(`ℹ️ InstagramApiService: No contentAccessToken for ${account.accountName}, cannot use Page fallback`);
      return false;
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(systemToken)}`,
      );
      const data: any = await res.json();
      if (!res.ok || !Array.isArray(data.data)) {
        console.log(`❌ InstagramApiService: Page lookup failed: ${JSON.stringify(data?.error || data).slice(0, 200)}`);
        return false;
      }

      // Match the Page by its linked IG business account. pageScopedId is that id
      // for Facebook-Login accounts; fall back to a stored pageId, then to the
      // single assigned Page if there is exactly one.
      const igBusinessId = account.pageScopedId || account.accountId;
      const page =
        data.data.find((p: any) => p.instagram_business_account?.id === igBusinessId) ||
        data.data.find((p: any) => p.id === account.pageId) ||
        (data.data.length === 1 ? data.data[0] : null);

      if (!page?.access_token) {
        console.log(`❌ InstagramApiService: No Page with a token matches account ${account.accountName}`);
        return false;
      }

      this.accessToken = page.access_token;
      this.pageId = page.id;
      console.log(`✅ InstagramApiService: Using Page route for ${account.accountName} (page ${page.id})`);
      return true;
    } catch (error) {
      console.error(`❌ InstagramApiService: Page fallback error for ${account.accountName}:`, error);
      return false;
    }
  }

  /**
   * Send a message via Instagram Graph API
   */
  async sendMessage(psid: string, message: any): Promise<any> {
    console.log(`📤 InstagramApiService: Sending message to PSID: ${psid}`);
    console.log(`📤 InstagramApiService: Message content: ${message.text || 'media/attachment'}`);

    if (!this.accessToken) {
      console.log(`❌ InstagramApiService: No access token available`);
      throw new Error('No access token available');
    }

    // Page route and Instagram-Login route hit different hosts and nodes. When
    // pageId is set we are on the Page fallback, which also wants messaging_type.
    const url = this.pageId
      ? `https://graph.facebook.com/v21.0/${this.pageId}/messages?access_token=${this.accessToken}`
      : `https://graph.instagram.com/v25.0/me/messages?access_token=${this.accessToken}`;

    const payload: Record<string, unknown> = {
      recipient: { id: psid },
      message: message,
      ...(this.pageId ? { messaging_type: 'RESPONSE' } : {}),
    };

    console.log(`📤 InstagramApiService: Sending message to PSID: ${psid}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log(`📤 InstagramApiService: Response status: ${response.status}`);

      const responseData = await response.json();

      if (!response.ok) {
        console.error(`❌ InstagramApiService: API error - Status: ${response.status}`);
        
        // If we get a 401 error, try to refresh the token
        if (response.status === 401) {
          console.log(`🔄 InstagramApiService: Received 401 error, attempting token refresh...`);
          const account = await InstagramAccount.findOne({ accessToken: this.accessToken, isActive: true });
          if (account) {
            const refreshSuccess = await this.refreshAccessToken(account);
            if (refreshSuccess) {
              console.log(`🔄 InstagramApiService: Token refreshed, retrying message send...`);
              // Update our access token and retry the request
              this.accessToken = account.accessToken;
              return this.sendMessage(psid, message);
            }
          }
        }
        
        throw new Error(`Instagram API error: ${response.status} - ${JSON.stringify(responseData)}`);
      }

      console.log(`✅ InstagramApiService: Message sent successfully to PSID: ${psid}`);
      return responseData;
    } catch (error) {
      console.error(`❌ InstagramApiService: Error sending message to PSID ${psid}:`, error);
      throw error;
    }
  }

  /**
   * Send a text message
   */
  async sendTextMessage(psid: string, text: string): Promise<any> {
    console.log(`📝 InstagramApiService: Sending text message to PSID: ${psid}`);
    console.log(`📝 InstagramApiService: Text content: "${text}"`);
    
    return this.sendMessage(psid, { text });
  }

  /**
   * Send a message with quick replies
   */
  async sendQuickReplies(psid: string, text: string, quickReplies: any[]): Promise<any> {
    console.log(`⚡ InstagramApiService: Sending quick replies to PSID: ${psid}`);
    console.log(`⚡ InstagramApiService: Text: "${text}"`);
    console.log(`⚡ InstagramApiService: Quick replies: [${quickReplies.length} options]`);
    
    return this.sendMessage(psid, {
      text,
      quick_replies: quickReplies
    });
  }

  /**
   * Send a message with buttons
   */
  async sendButtons(psid: string, text: string, buttons: any[]): Promise<any> {
    console.log(`🔘 InstagramApiService: Sending buttons to PSID: ${psid}`);
    console.log(`🔘 InstagramApiService: Text: "${text}"`);
    console.log(`🔘 InstagramApiService: Buttons: [${buttons.length} buttons]`);
    
    return this.sendMessage(psid, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text,
          buttons
        }
      }
    });
  }

  /**
   * Send a generic template
   */
  async sendGenericTemplate(psid: string, elements: any[]): Promise<any> {
    console.log(`📋 InstagramApiService: Sending generic template to PSID: ${psid}`);
    console.log(`📋 InstagramApiService: Elements: [${elements.length} items]`);
    
    return this.sendMessage(psid, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements
        }
      }
    });
  }

  /**
   * Send a media message
   */
  async sendMediaMessage(psid: string, attachment: any): Promise<any> {
    console.log(`📷 InstagramApiService: Sending media message to PSID: ${psid}`);
    console.log(`📷 InstagramApiService: Attachment: ${attachment.type || 'unknown'}`);
    
    return this.sendMessage(psid, { attachment });
  }

  /**
   * Send a typing indicator
   */
  async sendTypingIndicator(psid: string, typing: boolean = true): Promise<any> {
    console.log(`⌨️ InstagramApiService: Sending typing indicator to PSID: ${psid} - Typing: ${typing}`);
    
    const action = typing ? 'typing_on' : 'typing_off';
    const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${this.accessToken}`;
    
    const payload = {
      recipient: { id: psid },
      sender_action: action
    };

    console.log(`⌨️ InstagramApiService: Sending typing indicator to PSID: ${psid}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log(`⌨️ InstagramApiService: Typing response status: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`❌ InstagramApiService: Typing indicator error:`, errorData);
        throw new Error(`Typing indicator error: ${response.status}`);
      }

      console.log(`✅ InstagramApiService: Typing indicator sent successfully`);
      return { success: true };
    } catch (error) {
      console.error(`❌ InstagramApiService: Error sending typing indicator:`, error);
      throw error;
    }
  }

  /**
   * Mark message as seen
   */
  async markAsSeen(psid: string): Promise<any> {
    console.log(`👁️ InstagramApiService: Marking message as seen for PSID: ${psid}`);
    
    const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${this.accessToken}`;
    
    const payload = {
      recipient: { id: psid },
      sender_action: 'mark_seen'
    };

    console.log(`👁️ InstagramApiService: Marking message as seen for PSID: ${psid}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log(`👁️ InstagramApiService: Mark as seen response status: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`❌ InstagramApiService: Mark as seen error:`, errorData);
        throw new Error(`Mark as seen error: ${response.status}`);
      }

      console.log(`✅ InstagramApiService: Message marked as seen successfully`);
      return { success: true };
    } catch (error) {
      console.error(`❌ InstagramApiService: Error marking message as seen:`, error);
      throw error;
    }
  }

  /**
   * Get user profile information (Instagram User Profile API - graph.instagram.com)
   */
  async getUserProfile(psid: string): Promise<any> {
    console.log(`👤 InstagramApiService: Getting user profile for PSID: ${psid}`);
    const url = `https://graph.instagram.com/v25.0/${psid}?fields=id,name,username,profile_pic&access_token=${this.accessToken}`;
    console.log(`👤 InstagramApiService: Profile URL: graph.instagram.com/v25.0/${psid}...`);

    try {
      const response = await fetch(url);
      console.log(`👤 InstagramApiService: Profile response status: ${response.status}`);
      
      const data = await response.json();
      console.log(`👤 InstagramApiService: Profile data received for PSID: ${psid}`);
      
      if (!response.ok) {
        console.error(`❌ InstagramApiService: Profile error:`, data);
        throw new Error(`Profile error: ${response.status}`);
      }

      console.log(`✅ InstagramApiService: User profile retrieved: id=${data?.id}, username=${data?.username ?? 'n/a'}, name=${data?.name ?? 'n/a'}`);
      return data;
    } catch (error) {
      console.error(`❌ InstagramApiService: Error getting user profile:`, error);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    console.log(`🧪 InstagramApiService: Testing API connection`);
    
    try {
      const url = `https://graph.instagram.com/v25.0/me?access_token=${this.accessToken}`;
      console.log(`🧪 InstagramApiService: Test URL: ${url}`);
      
      const response = await fetch(url);
      console.log(`🧪 InstagramApiService: Test response status: ${response.status}`);
      
      const data = await response.json();
      console.log(`🧪 InstagramApiService: Test response received`);
      
      if (!response.ok) {
        console.error(`❌ InstagramApiService: Connection test failed:`, data);
        return false;
      }

      console.log(`✅ InstagramApiService: API connection test successful`);
      return true;
    } catch (error) {
      console.error(`❌ InstagramApiService: Connection test error:`, error);
      return false;
    }
  }
}

export default new InstagramApiService();
