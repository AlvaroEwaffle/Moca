import express from 'express';
import InstagramAccount from '../models/instagramAccount.model';

const router = express.Router();

// Instagram OAuth callback
router.post('/callback', async (req, res) => {
  try {
    const { code, redirectUri, businessInfo, agentBehavior } = req.body;
    
    console.log('🔧 [OAuth Callback] Received callback request:', {
      code: code ? `${code.substring(0, 10)}...` : 'none',
      redirectUri,
      businessInfo: businessInfo ? 'present' : 'missing',
      agentBehavior: agentBehavior ? 'present' : 'missing'
    });

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
    
    console.log('✅ [OAuth Callback] Token exchange successful:', {
      user_id,
      access_token: access_token ? `${access_token.substring(0, 10)}...` : 'none'
    });

    // Get user profile information using Instagram Basic Display API
    const profileUrl = `https://graph.instagram.com/me?fields=id,username&access_token=${access_token}`;
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

    // Check if account already exists
    const existingAccount = await InstagramAccount.findOne({ accountId: user_id });
    if (existingAccount) {
      // Update existing account
      existingAccount.accessToken = access_token;
      existingAccount.accountName = profileData.username;
      existingAccount.tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
      existingAccount.isActive = true;
      
      // Update settings with onboarding data if provided
      if (agentBehavior) {
        existingAccount.settings.systemPrompt = agentBehavior.systemPrompt || existingAccount.settings.systemPrompt;
        existingAccount.settings.toneOfVoice = agentBehavior.toneOfVoice || existingAccount.settings.toneOfVoice;
        existingAccount.settings.keyInformation = agentBehavior.keyInformation || existingAccount.settings.keyInformation;
      }
      
      await existingAccount.save();

      console.log(`✅ Updated existing Instagram account: ${user_id}`);

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

    // Create new Instagram account
    const newAccount = new InstagramAccount({
      accountId: user_id,
      accountName: profileData.username,
      accessToken: access_token,
      tokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      isActive: true,
      rateLimits: {
        messagesPerSecond: 3,
        userCooldown: 7,
        debounceWindow: 4000
      },
      settings: {
        autoRespond: true,
        aiEnabled: true,
        systemPrompt: agentBehavior?.systemPrompt || 'You are a helpful customer service assistant for a business. Respond to customer inquiries professionally and helpfully.',
        toneOfVoice: agentBehavior?.toneOfVoice || 'professional',
        keyInformation: agentBehavior?.keyInformation || '',
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

    console.log(`✅ Created new Instagram account: ${user_id}`);

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

// Get Instagram OAuth URL
router.get('/auth-url', (req, res) => {
  try {
    const clientId = process.env.INSTAGRAM_CLIENT_ID || '2160534791106844';
    const redirectUri = 'https://moca.pages.dev/instagram-callback';
    
    const authUrl = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights`;

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
