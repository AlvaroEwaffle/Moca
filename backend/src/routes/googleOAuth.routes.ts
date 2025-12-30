import express from 'express';
import { authenticateToken } from '../middleware/auth';
import Integration, { IntegrationType } from '../models/integration.model';
import { scheduleTokenRefresh } from '../services/integrationToken.service';
import {
  generateGoogleAuthUrl,
  exchangeCodeForTokens,
  getGoogleScopes
} from '../services/googleOAuth.service';

const router = express.Router();

router.get('/auth-url', authenticateToken, async (req, res) => {
  try {
    const { scope = 'calendar' } = req.query;
    const resolvedScope = scope === 'gmail' ? 'gmail' : 'calendar';
    const state = Buffer.from(
      JSON.stringify({ userId: req.user!.userId, scope: resolvedScope, ts: Date.now() })
    ).toString('base64');

    const authUrl = generateGoogleAuthUrl(resolvedScope, state);

    return res.json({
      success: true,
      data: {
        authUrl
      }
    });
  } catch (error) {
    console.error('❌ Error generating Google auth URL:', error);
    return res.status(500).json({
      success: false,
      error: 'Google OAuth is not configured correctly. Please contact support.'
    });
  }
});

router.post('/callback', authenticateToken, async (req, res) => {
  try {
    const { code, scope = 'calendar' } = req.body as { code: string; scope?: 'calendar' | 'gmail' };

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }

    const type: IntegrationType = scope === 'gmail' ? 'gmail' : 'google_calendar';

    const tokenPayload = await exchangeCodeForTokens(code);

    const integration = await Integration.findOneAndUpdate(
      { userId: req.user!.userId, type },
      {
        userId: req.user!.userId,
        type,
        status: 'connected',
        metadata: {
          provider: 'google',
          scope,
          scopes: getGoogleScopes(scope),
          connectedAt: new Date()
        },
        lastSyncedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const refreshToken = tokenPayload.refreshToken || integration.auth?.refreshToken;

    if (!refreshToken) {
      throw new Error(
        'Google did not return a refresh token. Please remove the integration and try connecting again.'
      );
    }

    integration.setTokens({
      accessToken: tokenPayload.accessToken,
      refreshToken,
      expiresAt: tokenPayload.expiresAt
    });

    await integration.save();
    scheduleTokenRefresh(integration);

    res.json({
      success: true,
      data: integration.toSafeObject()
    });
  } catch (error: any) {
    console.error('❌ Error handling Google OAuth callback:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to connect Google account'
    });
  }
});

export default router;

