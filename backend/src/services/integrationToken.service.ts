import Integration, { IIntegration } from '../models/integration.model';
import { refreshGoogleTokens } from './googleOAuth.service';

const scheduledRefreshes = new Map<string, NodeJS.Timeout>();

const getDelay = (expiresAt?: Date) => {
  if (!expiresAt) {
    return 30 * 60 * 1000; // default 30 minutes
  }

  const buffer = 5 * 60 * 1000; // refresh 5 minutes before expiry
  return Math.max(expiresAt.getTime() - Date.now() - buffer, 1 * 60 * 1000);
};

export const scheduleTokenRefresh = (integration: IIntegration) => {
  if (!integration.auth?.expiresAt || !integration.auth.refreshToken) {
    return;
  }

  if (scheduledRefreshes.has(integration.id)) {
    clearTimeout(scheduledRefreshes.get(integration.id)!);
  }

  const delay = getDelay(integration.auth.expiresAt);

  const timeout = setTimeout(async () => {
    scheduledRefreshes.delete(integration.id);

    try {
      await refreshIntegrationToken(integration.id);
    } catch (error) {
      console.error(`❌ [Integrations] Token refresh failed for ${integration.id}`, error);
    }
  }, delay);

  scheduledRefreshes.set(integration.id, timeout);
};

const refreshIntegrationToken = async (integrationId: string) => {
  const integration = await Integration.findById(integrationId);
  if (!integration || !integration.auth?.refreshToken) {
    return;
  }

  if (integration.type === 'gmail' || integration.type === 'google_calendar') {
    const tokens = await refreshGoogleTokens(integration.auth.refreshToken);
    integration.setTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt
    });
    await integration.save();
    scheduleTokenRefresh(integration);
  }
};

