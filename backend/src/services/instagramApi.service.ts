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

      if (account.tokenExpiry <= new Date()) {
        console.log(`⚠️ InstagramApiService: Token expired for account: ${account.accountName}`);
        return false;
      }

      this.accessToken = account.accessToken;
      console.log(`✅ InstagramApiService: Token valid for account: ${account.accountName}`);
      return true;
    } catch (error) {
      console.error(`❌ InstagramApiService: Error initializing account ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Send a message via Instagram Graph API
   */
  async sendMessage(psid: string, message: any): Promise<any> {
    console.log(`📤 InstagramApiService: Sending message to PSID: ${psid}`);
    console.log(`📤 InstagramApiService: Message content:`, JSON.stringify(message, null, 2));

    if (!this.accessToken) {
      console.log(`❌ InstagramApiService: No access token available`);
      throw new Error('No access token available');
    }

    const url = `https://graph.instagram.com/v23.0/me/messages?access_token=${this.accessToken}`;
    
    const payload = {
      recipient: { id: psid },
      message: message
    };

    console.log(`📤 InstagramApiService: Sending to URL: ${url}`);
    console.log(`📤 InstagramApiService: Payload:`, JSON.stringify(payload, null, 2));

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
      console.log(`📤 InstagramApiService: Response headers:`, Object.fromEntries(response.headers.entries()));

      const responseData = await response.json();
      console.log(`📤 InstagramApiService: Response data:`, JSON.stringify(responseData, null, 2));

      if (!response.ok) {
        console.error(`❌ InstagramApiService: API error - Status: ${response.status}, Data:`, responseData);
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
    console.log(`⚡ InstagramApiService: Quick replies:`, JSON.stringify(quickReplies, null, 2));
    
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
    console.log(`🔘 InstagramApiService: Buttons:`, JSON.stringify(buttons, null, 2));
    
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
    console.log(`📋 InstagramApiService: Elements:`, JSON.stringify(elements, null, 2));
    
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
    console.log(`📷 InstagramApiService: Attachment:`, JSON.stringify(attachment, null, 2));
    
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

    console.log(`⌨️ InstagramApiService: Typing payload:`, JSON.stringify(payload, null, 2));

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

    console.log(`👁️ InstagramApiService: Mark as seen payload:`, JSON.stringify(payload, null, 2));

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
   * Get user profile information
   */
  async getUserProfile(psid: string): Promise<any> {
    console.log(`👤 InstagramApiService: Getting user profile for PSID: ${psid}`);
    
    const url = `https://graph.facebook.com/v18.0/${psid}?fields=id,name,profile_pic&access_token=${this.accessToken}`;
    
    console.log(`👤 InstagramApiService: Profile URL: ${url}`);

    try {
      const response = await fetch(url);
      console.log(`👤 InstagramApiService: Profile response status: ${response.status}`);
      
      const data = await response.json();
      console.log(`👤 InstagramApiService: Profile data:`, JSON.stringify(data, null, 2));
      
      if (!response.ok) {
        console.error(`❌ InstagramApiService: Profile error:`, data);
        throw new Error(`Profile error: ${response.status}`);
      }

      console.log(`✅ InstagramApiService: User profile retrieved successfully`);
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
      const url = `https://graph.facebook.com/v18.0/me?access_token=${this.accessToken}`;
      console.log(`🧪 InstagramApiService: Test URL: ${url}`);
      
      const response = await fetch(url);
      console.log(`🧪 InstagramApiService: Test response status: ${response.status}`);
      
      const data = await response.json();
      console.log(`🧪 InstagramApiService: Test response data:`, JSON.stringify(data, null, 2));
      
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
