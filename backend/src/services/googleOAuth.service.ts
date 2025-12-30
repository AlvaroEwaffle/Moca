// @ts-nocheck
import { google } from 'googleapis';
import appConfig from '../config';

type GoogleScopeKind = 'gmail' | 'calendar';

const gmailScopes = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.labels'
];

const calendarScopes = ['https://www.googleapis.com/auth/calendar.events'];

const ensureGoogleEnv = () => {
  const { clientId, clientSecret, redirectUri } = appConfig.google;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Google OAuth environment variables are missing. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI.'
    );
  }

  return { clientId, clientSecret, redirectUri };
};

const getOAuthClient = () => {
  const { clientId, clientSecret, redirectUri } = ensureGoogleEnv();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

export const getGoogleScopes = (kind: GoogleScopeKind) => (kind === 'gmail' ? gmailScopes : calendarScopes);

export const generateGoogleAuthUrl = (kind: GoogleScopeKind, state: string) => {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: getGoogleScopes(kind),
    state
  });
};

export interface GoogleTokenPayload {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

const mapCredentials = (credentials: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}): GoogleTokenPayload => {
  if (!credentials.access_token) {
    throw new Error('Google OAuth did not return an access token.');
  }

  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token ?? undefined,
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined
  };
};

export const exchangeCodeForTokens = async (code: string): Promise<GoogleTokenPayload> => {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return mapCredentials(tokens);
};

export const refreshGoogleTokens = async (refreshToken: string): Promise<GoogleTokenPayload> => {
  const client = getOAuthClient();
  const { credentials } = await client.refreshToken(refreshToken);

  // Google may not return a new refresh token; preserve the existing one.
  const mapped = mapCredentials({
    ...credentials,
    refresh_token: credentials.refresh_token || refreshToken
  });

  if (!mapped.refreshToken) {
    mapped.refreshToken = refreshToken;
  }

  return mapped;
};

