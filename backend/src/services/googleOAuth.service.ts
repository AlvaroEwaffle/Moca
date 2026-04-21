import { google } from 'googleapis';
import { appConfig } from '../config';

// NOTE: googleapis bundles its own copy of google-auth-library, which produces
// type-identity mismatches against the top-level google-auth-library. We therefore
// treat the OAuth2 client as an opaque value and type it as `any` at the boundary,
// mirroring the pattern used in Capu (`@ts-nocheck`) without disabling checks
// on the rest of this file.
type OAuth2Client = any;
import CalendarIntegration, {
  ICalendarIntegration,
  revealCalendarTokens,
  GOOGLE_CALENDAR_SCOPES,
} from '../models/calendarIntegration.model';

/**
 * Google OAuth + client factory for Moca's Calendar connector.
 *
 * Responsibilities:
 *   - Build the consent URL (getAuthUrl)
 *   - Exchange authorization code for tokens (exchangeCodeForTokens)
 *   - Fetch the authenticated Google account's email (fetchGoogleAccountEmail)
 *   - Return an authenticated OAuth2Client for a CalendarIntegration,
 *     refreshing the access token when needed (getAuthorizedClient)
 *
 * Env required at runtime:
 *   - GOOGLE_CLIENT_ID
 *   - GOOGLE_CLIENT_SECRET
 *   - GOOGLE_OAUTH_REDIRECT_URI
 *
 * NOTE: appConfig.google already reads GOOGLE_REDIRECT_URI; we also accept
 * GOOGLE_OAUTH_REDIRECT_URI as an alias so Moca can have its own URI without
 * colliding with an existing Gmail redirect on the same GCP project.
 */

const getGoogleEnv = () => {
  const clientId = appConfig.google.clientId || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = appConfig.google.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    appConfig.google.redirectUri ||
    process.env.GOOGLE_REDIRECT_URI ||
    '';

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Google OAuth env is incomplete. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI.'
    );
  }

  return { clientId, clientSecret, redirectUri };
};

const buildBaseClient = (): OAuth2Client => {
  const { clientId, clientSecret, redirectUri } = getGoogleEnv();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

/**
 * Encode a state payload so /callback can recover { userId, accountId }.
 * The state is also a CSRF barrier; in a hardened version we'd sign it.
 */
export const encodeOAuthState = (payload: { userId: string; accountId: string }): string =>
  Buffer.from(JSON.stringify({ ...payload, ts: Date.now() })).toString('base64url');

export const decodeOAuthState = (
  state: string
): { userId: string; accountId: string; ts: number } | null => {
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    if (decoded?.userId && decoded?.accountId) return decoded;
    return null;
  } catch {
    return null;
  }
};

export const getAuthUrl = (state: string): string => {
  const client = buildBaseClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force refresh_token on every consent
    scope: GOOGLE_CALENDAR_SCOPES,
    state,
  });
};

export interface GoogleTokenPayload {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

export const exchangeCodeForTokens = async (code: string): Promise<GoogleTokenPayload> => {
  const client = buildBaseClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    throw new Error('Google did not return an access token.');
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? undefined,
    tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
  };
};

export const fetchGoogleAccountEmail = async (accessToken: string): Promise<string | undefined> => {
  const client = buildBaseClient();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();
  return data.email ?? undefined;
};

export const revokeTokens = async (refreshToken?: string, accessToken?: string): Promise<void> => {
  const client = buildBaseClient();
  const token = refreshToken || accessToken;
  if (!token) return;
  try {
    await client.revokeToken(token);
  } catch (err) {
    // If revocation fails (e.g. already revoked), we still want to wipe local state.
    console.warn('⚠️ [GoogleOAuth] Token revoke failed (continuing):', (err as Error).message);
  }
};

/**
 * Return an authorized OAuth2Client for a given CalendarIntegration.
 * - Decrypts stored tokens
 * - Calls getAccessToken() which auto-refreshes when expired
 * - Persists rotated access_token / expiry back to MongoDB
 * - Marks the integration `status: 'error'` on invalid_grant (token revoked upstream)
 */
export const getAuthorizedClient = async (
  integration: ICalendarIntegration
): Promise<OAuth2Client> => {
  const { accessToken, refreshToken } = revealCalendarTokens(integration);

  if (!accessToken && !refreshToken) {
    throw new Error('No Google tokens stored for this calendar integration.');
  }

  const { clientId, clientSecret, redirectUri } = getGoogleEnv();
  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  try {
    // Triggers refresh if access_token is expired and refresh_token is present.
    await client.getAccessToken();
  } catch (err: any) {
    const msg = err?.message || '';
    const isRevoked =
      msg.includes('invalid_grant') || err?.response?.data?.error === 'invalid_grant';

    if (isRevoked) {
      integration.status = 'error';
      integration.error = 'Google refresh token revoked. Reconnect required.';
      await integration.save().catch(() => {});
    }
    throw new Error(`Failed to refresh Google access token: ${msg}`);
  }

  // Persist rotated credentials if Google returned a new access_token / expiry.
  const creds = client.credentials;
  const newAccessToken = creds.access_token ?? undefined;
  const newExpiry = creds.expiry_date ? new Date(creds.expiry_date) : undefined;
  const newRefreshToken = (creds.refresh_token as string | undefined) || undefined;

  const currentAccess = accessToken;
  if (
    (newAccessToken && newAccessToken !== currentAccess) ||
    (newExpiry && newExpiry.getTime() !== integration.auth?.tokenExpiresAt?.getTime()) ||
    (newRefreshToken && newRefreshToken !== refreshToken)
  ) {
    integration.setTokens({
      accessToken: newAccessToken || currentAccess,
      refreshToken: newRefreshToken || refreshToken,
      tokenExpiresAt: newExpiry,
    });
    integration.lastSyncedAt = new Date();
    await integration.save().catch((e) =>
      console.error('❌ [GoogleOAuth] Failed to persist rotated tokens:', e)
    );
  }

  return client;
};

/**
 * Convenience: look up the CalendarIntegration for an accountId and return an authorized client.
 * Throws if not connected or disabled.
 */
export const getAuthorizedClientForAccount = async (
  accountId: string
): Promise<{ client: OAuth2Client; integration: ICalendarIntegration }> => {
  const integration = await CalendarIntegration.findOne({ accountId });
  if (!integration) {
    throw new Error(`No Google Calendar integration found for accountId=${accountId}`);
  }
  if (integration.status !== 'connected') {
    throw new Error(
      `Calendar integration for accountId=${accountId} is not connected (status=${integration.status}).`
    );
  }
  if (!integration.enabled) {
    throw new Error(`Calendar integration for accountId=${accountId} is disabled.`);
  }
  const client = await getAuthorizedClient(integration);
  return { client, integration };
};
