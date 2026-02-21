import express from 'express';
import InstagramAccount from '../models/instagramAccount.model';
import User from '../models/user.model';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Instagram OAuth callback
router.post('/callback', authenticateToken, async (req, res) => {
  try {
    const { code, redirectUri, businessInfo, agentBehavior } = req.body;
    
    console.log('🔧 [OAuth Callback] Received callback request:', {
      userId: req.user?.userId,
      userEmail: req.user?.email,
      code: code ? `${code.substring(0, 10)}...` : 'none',
      redirectUri,
      businessInfo: businessInfo ? 'present' : 'missing',
      agentBehavior: agentBehavior ? 'present' : 'missing'
    });
    
    console.log('🔧 [OAuth Callback] Detailed agentBehavior:', JSON.stringify(agentBehavior, null, 2));
    console.log('🔧 [OAuth Callback] Detailed businessInfo:', JSON.stringify(businessInfo, null, 2));
    
    // Get user's agent settings as fallback
    const user = await User.findById(req.user!.userId);
    console.log('🔧 [OAuth Callback] User agent settings:', JSON.stringify(user?.agentSettings, null, 2));

    if (!code) {
      console.error('❌ [OAuth Callback] No authorization code provided');
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }

    // Exchange code for access token using Instagram Business API
    const tokenParams = {
      client_id: process.env.INSTAGRAM_CLIENT_ID || '2160534791106844',
      client_secret: process.env.INSTAGRAM_CLIENT_SECRET || '',
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code: code
    };
    
    console.log('🔧 [OAuth Callback] Token exchange params:', {
      client_id: tokenParams.client_id,
      client_secret: tokenParams.client_secret ? `${tokenParams.client_secret.substring(0, 10)}...` : 'missing',
      grant_type: tokenParams.grant_type,
      redirect_uri: tokenParams.redirect_uri,
      code: tokenParams.code ? `${tokenParams.code.substring(0, 10)}...` : 'missing'
    });
    
    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams)
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('❌ [OAuth Callback] Instagram token exchange failed:', errorData);
      return res.status(400).json({
        success: false,
        error: 'Failed to exchange authorization code for access token'
      });
    }

    const tokenData = await tokenResponse.json();
    const { access_token, user_id } = tokenData;
    
    console.log('✅ [OAuth Callback] Short-lived token exchange successful:', {
      user_id,
      access_token: access_token ? `${access_token.substring(0, 10)}...` : 'none'
    });

    // Exchange short-lived token for long-lived token (60 days)
    const longTokenParams = {
      grant_type: 'ig_exchange_token',
      client_secret: process.env.INSTAGRAM_CLIENT_SECRET || '',
      access_token: access_token
    };
    
    console.log('🔧 [OAuth Callback] Long-lived token exchange params:', {
      grant_type: longTokenParams.grant_type,
      client_secret: longTokenParams.client_secret ? `${longTokenParams.client_secret.substring(0, 10)}...` : 'missing',
      access_token: longTokenParams.access_token ? `${longTokenParams.access_token.substring(0, 10)}...` : 'missing'
    });
    
    const longTokenResponse = await fetch(`https://graph.instagram.com/access_token?${new URLSearchParams(longTokenParams)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });

    let finalAccessToken = access_token;
    let tokenExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000); // Default 2 hours

    if (longTokenResponse.ok) {
      const longTokenData = await longTokenResponse.json();
      finalAccessToken = longTokenData.access_token;
      tokenExpiry = new Date(Date.now() + (longTokenData.expires_in * 1000)); // Convert seconds to milliseconds
      
      console.log('✅ [OAuth Callback] Long-lived token exchange successful:', {
        expires_in: longTokenData.expires_in,
        expires_in_days: Math.round(longTokenData.expires_in / (24 * 60 * 60)),
        token_expiry: tokenExpiry.toISOString()
      });
    } else {
      const errorData = await longTokenResponse.json().catch(() => ({}));
      console.warn('⚠️ [OAuth Callback] Long-lived token exchange failed, using short-lived token:', errorData);
    }

    // Get profile from /me with user_id (IG_ID for webhooks) and app-scoped id per official doc
    const profileUrl = `https://graph.instagram.com/v25.0/me?fields=id,username,user_id,account_type&access_token=${finalAccessToken}`;
    console.log('🔧 [OAuth Callback] Fetching Instagram profile from:', profileUrl);

    const profileResponse = await fetch(profileUrl);

    if (!profileResponse.ok) {
      const errorData = await profileResponse.json().catch(() => ({}));
      console.error('❌ [OAuth Callback] Failed to fetch Instagram profile:', {
        status: profileResponse.status,
        statusText: profileResponse.statusText,
        error: errorData
      });
      return res.status(400).json({
        success: false,
        error: 'Failed to fetch Instagram profile'
      });
    }

    const profileData = await profileResponse.json();
    console.log('✅ [OAuth Callback] Instagram profile fetched successfully:', profileData);

    // user_id from /me = IG_ID = value used as recipient.id in webhooks (doc). id = app-scoped.
    const canonicalId = profileData.user_id ?? profileData.id;
    const appScopedId = profileData.id;
    console.log('✅ [OAuth Callback] Canonical IG_ID (user_id) for webhooks:', canonicalId, 'appScopedId (id):', appScopedId);

    // Optional: get pageScopedId from /{ig_id} for sender matching (e.g. when we send, echo has our sender id)
    let pageScopedId: string | null = null;
    try {
      const nodeId = profileData.user_id ?? profileData.id;
      console.log(`🔧 [OAuth Callback] Fetching extra fields for: ${nodeId}`);
      const pageScopedResponse = await fetch(`https://graph.instagram.com/v25.0/${nodeId}?fields=username,user_id&access_token=${finalAccessToken}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (pageScopedResponse.ok) {
        const pageScopedData = await pageScopedResponse.json();
        pageScopedId = pageScopedData.user_id ?? null;
        console.log('✅ [OAuth Callback] Page-Scoped ID (user_id from node):', pageScopedId);
      }
    } catch (error) {
      console.error('❌ [OAuth Callback] Error fetching Page-Scoped ID:', error);
    }

    // Optional: try to get Facebook Page ID for webhook matching (GET /me/accounts → page with instagram_business_account)
    // Instagram-only tokens often don't work on graph.facebook.com; skip if it fails.
    let pageId: string | null = null;
    try {
      const fbAccountsRes = await fetch(
        `https://graph.facebook.com/v25.0/me/accounts?fields=id,instagram_business_account&access_token=${finalAccessToken}`
      );
      if (fbAccountsRes.ok) {
        const fbData = await fbAccountsRes.json();
        const pages = fbData.data || [];
        for (const page of pages) {
          const igAccount = page.instagram_business_account?.id || page.instagram_business_account;
          if (igAccount === profileData.id) {
            pageId = page.id;
            console.log('✅ [OAuth Callback] Page ID for webhook matching:', pageId);
            break;
          }
        }
        if (!pageId && pages.length) {
          console.log('🔧 [OAuth Callback] No page matched IG account id; pageId not set.');
        }
      }
    } catch (err) {
      console.log('🔧 [OAuth Callback] Facebook Graph /me/accounts not available (Instagram-only token is normal).');
    }

    // Find existing account: by canonicalId (user_id), by appScopedId (id), or by old accountId (id) for migration
    let existingAccount = await InstagramAccount.findOne({
      $or: [
        { accountId: canonicalId },
        { accountId: appScopedId },
        { appScopedId: appScopedId }
      ],
      userId: req.user!.userId
    });
    if (existingAccount) {
      const matchBy = existingAccount.accountId === canonicalId ? 'accountId=canonicalId' : existingAccount.accountId === appScopedId ? 'accountId=appScopedId (legacy)' : 'appScopedId';
      console.log(`🔧 [OAuth Callback] Found existing account (matched by: ${matchBy}), updating.`);
      existingAccount.accessToken = finalAccessToken;
      existingAccount.accountName = profileData.username;
      existingAccount.tokenExpiry = tokenExpiry;
      existingAccount.isActive = true;
      existingAccount.accountId = canonicalId;
      existingAccount.appScopedId = appScopedId;
      existingAccount.pageScopedId = pageScopedId ?? undefined;
      if (pageId) existingAccount.pageId = pageId;

      // Update settings with onboarding data if provided
      if (agentBehavior || user?.agentSettings) {
        console.log(`🔧 [OAuth Callback] Updating existing account with agentBehavior:`, JSON.stringify(agentBehavior, null, 2));
        existingAccount.settings.systemPrompt = agentBehavior?.systemPrompt || user?.agentSettings?.systemPrompt || existingAccount.settings.systemPrompt;
        existingAccount.settings.toneOfVoice = agentBehavior?.toneOfVoice || user?.agentSettings?.toneOfVoice || existingAccount.settings.toneOfVoice;
        existingAccount.settings.keyInformation = agentBehavior?.keyInformation || user?.agentSettings?.keyInformation || existingAccount.settings.keyInformation;
        console.log(`🔧 [OAuth Callback] Updated settings:`, JSON.stringify(existingAccount.settings, null, 2));
      }
      
      await existingAccount.save();

      console.log(`✅ Updated existing Instagram account: ${canonicalId}`);
      console.log(`✅ [OAuth Callback] accountId (IG_ID)=${canonicalId}, appScopedId=${appScopedId}, pageScopedId=${pageScopedId}`);

      return res.json({
        success: true,
        data: {
          message: 'Instagram account updated successfully',
          account: {
            id: existingAccount.id,
            accountId: existingAccount.accountId,
            accountName: existingAccount.accountName,
            isActive: existingAccount.isActive
          }
        }
      });
    }

    console.log('🔧 [OAuth Callback] No existing account found, creating new account.');
    // Create new Instagram account (accountId = IG_ID from /me user_id for webhook matching)
    const newAccount = new InstagramAccount({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      accountId: canonicalId,
      appScopedId: appScopedId,
      pageScopedId: pageScopedId ?? undefined,
      pageId: pageId || undefined,
      accountName: profileData.username,
      accessToken: finalAccessToken,
      tokenExpiry: tokenExpiry,
      isActive: true,
      rateLimits: {
        messagesPerSecond: 3,
        userCooldown: 7,
        debounceWindow: 4000
      },
      settings: {
        autoRespond: true,
        aiEnabled: 'on', // Use string enum: 'off' | 'test' | 'on'
        systemPrompt: agentBehavior?.systemPrompt || user?.agentSettings?.systemPrompt || 'You are a helpful customer service assistant for a business. Respond to customer inquiries professionally and helpfully.',
        toneOfVoice: agentBehavior?.toneOfVoice || user?.agentSettings?.toneOfVoice || 'professional',
        keyInformation: agentBehavior?.keyInformation || user?.agentSettings?.keyInformation || '',
        fallbackRules: [
          'Thank you for your message! We\'ll get back to you soon.',
          'Thanks for reaching out! Our team will respond shortly.'
        ]
      },
      webhook: {
        verifyToken: process.env.INSTAGRAM_VERIFY_TOKEN || 'default_token',
        endpoint: `${req.protocol}://${req.get('host')}/api/instagram/webhook`
      }
    });

    await newAccount.save();

    console.log(`✅ Created new Instagram account for user ${req.user!.email}: ${canonicalId}`);
    console.log(`✅ [OAuth Callback] accountId (IG_ID)=${canonicalId}, appScopedId=${appScopedId}, pageScopedId=${pageScopedId}`);
    console.log(`🔧 [OAuth Callback] Saved account settings:`, JSON.stringify(newAccount.settings, null, 2));

    res.status(201).json({
      success: true,
      data: {
        message: 'Instagram account connected successfully',
        account: {
          id: newAccount.id,
          accountId: newAccount.accountId,
          accountName: newAccount.accountName,
          isActive: newAccount.isActive
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in Instagram OAuth callback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect Instagram account'
    });
  }
});

// Refresh Instagram access token
router.post('/refresh-token', async (req, res) => {
  try {
    const { accountId } = req.body;
    
    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required'
      });
    }

    console.log(`🔄 [Token Refresh] Refreshing token for account: ${accountId}`);

    const account = await InstagramAccount.findOne({ accountId, isActive: true });
    
    if (!account) {
      console.log(`❌ [Token Refresh] No active account found for ID: ${accountId}`);
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Import the Instagram API service
    const instagramService = (await import('../services/instagramApi.service')).default;
    
    const refreshSuccess = await instagramService.refreshAccessToken(account);
    
    if (!refreshSuccess) {
      console.log(`❌ [Token Refresh] Failed to refresh token for account: ${accountId}`);
      return res.status(400).json({
        success: false,
        error: 'Failed to refresh access token'
      });
    }

    console.log(`✅ [Token Refresh] Token refreshed successfully for account: ${accountId}`);

    res.json({
      success: true,
      data: {
        message: 'Access token refreshed successfully',
        account: {
          id: account.id,
          accountId: account.accountId,
          accountName: account.accountName,
          tokenExpiry: account.tokenExpiry
        }
      }
    });

  } catch (error) {
    console.error('❌ Error refreshing Instagram access token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh access token'
    });
  }
});

// Get Instagram OAuth URL
router.get('/auth-url', (req, res) => {
  try {
    const clientId = process.env.INSTAGRAM_CLIENT_ID || '2160534791106844';
    const redirectUri = 'https://moca.pages.dev/instagram-callback';
    
    const authUrl = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages`;

    res.json({
      success: true,
      data: {
        authUrl,
        redirectUri
      }
    });
  } catch (error) {
    console.error('❌ Error generating Instagram auth URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate Instagram auth URL'
    });
  }
});

export default router;
