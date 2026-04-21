import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import CalendarIntegration, {
  GOOGLE_CALENDAR_SCOPES,
} from '../models/calendarIntegration.model';
import {
  encodeOAuthState,
  decodeOAuthState,
  getAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleAccountEmail,
  revokeTokens,
} from '../services/googleOAuth.service';
import { revealCalendarTokens } from '../models/calendarIntegration.model';

const router = express.Router();

/**
 * Google Calendar OAuth + config routes for Moca.
 *
 * Mount point: /api/calendar
 *
 *   GET    /google/connect?accountId=...   → returns { authUrl } (frontend does the redirect)
 *   GET    /google/callback                → Google redirects here; exchanges code, stores tokens
 *   GET    /config?accountId=...           → current config + connection status
 *   PUT    /config?accountId=...           → update workingHours / timezone / duration / enabled
 *   DELETE /google?accountId=...           → revoke + delete integration
 *
 * The callback route does NOT require authenticateToken (Google can't send auth headers),
 * but it requires a valid signed `state` created by /google/connect.
 */

// ── Helpers ─────────────────────────────────────────────────────────────────────

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const validateWorkingHours = (wh: any): string | null => {
  if (wh == null) return null;
  if (typeof wh !== 'object') return 'workingHours must be an object';
  const allowed = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  for (const day of Object.keys(wh)) {
    if (!allowed.includes(day)) return `Invalid weekday: ${day}`;
    const w = wh[day];
    if (w == null) continue;
    if (!w.start || !w.end || !HHMM_RE.test(w.start) || !HHMM_RE.test(w.end)) {
      return `Invalid HH:mm window for ${day}`;
    }
    if (w.start >= w.end) return `Start >= end for ${day}`;
  }
  return null;
};

// ── GET /google/connect ─────────────────────────────────────────────────────────

router.get('/google/connect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const accountId = String(req.query.accountId || '');
    if (!accountId) {
      return res.status(400).json({ success: false, error: 'accountId is required' });
    }

    const state = encodeOAuthState({ userId: req.user!.userId, accountId });
    const authUrl = getAuthUrl(state);

    return res.json({ success: true, data: { authUrl, scopes: GOOGLE_CALENDAR_SCOPES } });
  } catch (err: any) {
    console.error('❌ [Calendar OAuth] connect error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to build auth URL' });
  }
});

// ── GET /google/callback ────────────────────────────────────────────────────────

router.get('/google/callback', async (req: Request, res: Response) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const error = req.query.error ? String(req.query.error) : undefined;

  if (error) {
    return res.status(400).json({ success: false, error: `Google returned error: ${error}` });
  }
  if (!code || !state) {
    return res.status(400).json({ success: false, error: 'Missing code or state' });
  }

  const payload = decodeOAuthState(state);
  if (!payload) {
    return res.status(400).json({ success: false, error: 'Invalid state' });
  }
  // Reject states older than 15 minutes — crude but prevents replay.
  if (Date.now() - payload.ts > 15 * 60 * 1000) {
    return res.status(400).json({ success: false, error: 'State expired, please reconnect' });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const googleEmail = await fetchGoogleAccountEmail(tokens.accessToken).catch(() => undefined);

    const existing = await CalendarIntegration.findOne({
      userId: payload.userId,
      accountId: payload.accountId,
    });

    const integration =
      existing ||
      new CalendarIntegration({
        userId: payload.userId,
        accountId: payload.accountId,
      });

    // Google only returns a refresh_token on first consent OR when prompt=consent;
    // we force prompt=consent, so this should always be present.
    const refreshToken =
      tokens.refreshToken || revealCalendarTokens(integration).refreshToken;

    if (!refreshToken) {
      return res.status(500).json({
        success: false,
        error:
          'Google did not return a refresh token. Disconnect the app in https://myaccount.google.com/permissions and retry.',
      });
    }

    integration.status = 'connected';
    integration.provider = 'google';
    integration.scopes = GOOGLE_CALENDAR_SCOPES;
    integration.googleEmail = googleEmail;
    integration.error = undefined;
    integration.setTokens({
      accessToken: tokens.accessToken,
      refreshToken,
      tokenExpiresAt: tokens.tokenExpiresAt,
    });
    integration.lastSyncedAt = new Date();

    await integration.save();

    // Prefer redirecting back to the frontend if configured; otherwise return JSON
    const frontendBase = (process.env.FRONTEND_URL || '').split(',')[0]?.trim();
    if (frontendBase) {
      const redirect = `${frontendBase.replace(/\/$/, '')}/app/integrations?calendar=connected&accountId=${encodeURIComponent(
        payload.accountId
      )}`;
      return res.redirect(redirect);
    }

    return res.json({
      success: true,
      data: integration.toSafeObject(),
    });
  } catch (err: any) {
    console.error('❌ [Calendar OAuth] callback error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to complete Google OAuth',
    });
  }
});

// ── GET /config ─────────────────────────────────────────────────────────────────

router.get('/config', authenticateToken, async (req: Request, res: Response) => {
  try {
    const accountId = String(req.query.accountId || '');
    if (!accountId) {
      return res.status(400).json({ success: false, error: 'accountId is required' });
    }

    const integration = await CalendarIntegration.findOne({
      userId: req.user!.userId,
      accountId,
    });

    if (!integration) {
      return res.json({
        success: true,
        data: { connected: false, accountId },
      });
    }

    return res.json({
      success: true,
      data: {
        connected: integration.status === 'connected' && integration.enabled,
        ...integration.toSafeObject(),
      },
    });
  } catch (err: any) {
    console.error('❌ [Calendar OAuth] config GET error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to load config' });
  }
});

// ── PUT /config ─────────────────────────────────────────────────────────────────

router.put('/config', authenticateToken, async (req: Request, res: Response) => {
  try {
    const accountId = String(req.query.accountId || '');
    if (!accountId) {
      return res.status(400).json({ success: false, error: 'accountId is required' });
    }

    const { workingHours, timezone, meetingDurationMinutes, bufferMinutes, enabled, calendarId } =
      req.body || {};

    const whError = validateWorkingHours(workingHours);
    if (whError) {
      return res.status(400).json({ success: false, error: whError });
    }

    const integration = await CalendarIntegration.findOne({
      userId: req.user!.userId,
      accountId,
    });
    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found. Connect first.' });
    }

    if (workingHours) integration.workingHours = workingHours;
    if (typeof timezone === 'string' && timezone.trim()) integration.timezone = timezone.trim();
    if (typeof meetingDurationMinutes === 'number' && meetingDurationMinutes > 0)
      integration.meetingDurationMinutes = Math.min(240, meetingDurationMinutes);
    if (typeof bufferMinutes === 'number' && bufferMinutes >= 0)
      integration.bufferMinutes = Math.min(120, bufferMinutes);
    if (typeof enabled === 'boolean') integration.enabled = enabled;
    if (typeof calendarId === 'string' && calendarId.trim())
      integration.calendarId = calendarId.trim();

    await integration.save();

    return res.json({ success: true, data: integration.toSafeObject() });
  } catch (err: any) {
    console.error('❌ [Calendar OAuth] config PUT error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to update config' });
  }
});

// ── DELETE /google ──────────────────────────────────────────────────────────────

router.delete('/google', authenticateToken, async (req: Request, res: Response) => {
  try {
    const accountId = String(req.query.accountId || '');
    if (!accountId) {
      return res.status(400).json({ success: false, error: 'accountId is required' });
    }

    const integration = await CalendarIntegration.findOne({
      userId: req.user!.userId,
      accountId,
    });
    if (!integration) {
      return res.json({ success: true, data: { disconnected: true, alreadyMissing: true } });
    }

    const { accessToken, refreshToken } = revealCalendarTokens(integration);
    await revokeTokens(refreshToken, accessToken);

    await integration.deleteOne();

    return res.json({ success: true, data: { disconnected: true } });
  } catch (err: any) {
    console.error('❌ [Calendar OAuth] disconnect error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to disconnect' });
  }
});

export default router;
