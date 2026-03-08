const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// Rate limiting: track recent notifications to avoid spamming Slack
const recentNotifications = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_PER_WINDOW = 3; // max 3 identical errors per window

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const lastSent = recentNotifications.get(key);

  if (!lastSent) {
    recentNotifications.set(key, now);
    return false;
  }

  // Clean up old entries periodically
  if (recentNotifications.size > 200) {
    for (const [k, ts] of recentNotifications) {
      if (now - ts > RATE_LIMIT_WINDOW_MS) recentNotifications.delete(k);
    }
  }

  if (now - lastSent < RATE_LIMIT_WINDOW_MS / MAX_PER_WINDOW) {
    return true;
  }

  recentNotifications.set(key, now);
  return false;
}

export async function sendSlackNotification(text: string) {
  if (!SLACK_WEBHOOK_URL) {
    return;
  }
  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.warn('[Slack] Failed to send notification:', res.status);
    }
  } catch (err) {
    console.warn('[Slack] Network error sending notification:', (err as Error).message);
  }
}

interface ErrorNotificationOptions {
  service: string;
  message: string;
  error?: unknown;
  context?: Record<string, unknown>;
}

export async function notifyError({ service, message, error, context }: ErrorNotificationOptions) {
  if (!SLACK_WEBHOOK_URL) return;

  const rateLimitKey = `${service}:${message}`;
  if (isRateLimited(rateLimitKey)) return;

  const errorDetails = error instanceof Error
    ? `${error.message}\n${error.stack?.split('\n').slice(0, 3).join('\n') || ''}`
    : error ? String(error) : '';

  const contextStr = context
    ? Object.entries(context).map(([k, v]) => `  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n')
    : '';

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `🚨 Error in ${service}`, emoji: true }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${message}*` }
    },
    ...(errorDetails ? [{
      type: 'section',
      text: { type: 'mrkdwn', text: `\`\`\`${errorDetails.slice(0, 2500)}\`\`\`` }
    }] : []),
    ...(contextStr ? [{
      type: 'section',
      text: { type: 'mrkdwn', text: `*Context:*\n\`\`\`${contextStr.slice(0, 1000)}\`\`\`` }
    }] : []),
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `⏰ ${new Date().toISOString()} | ENV: ${process.env.NODE_ENV || 'development'}` }]
    }
  ];

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks, text: `🚨 [${service}] ${message}` }),
    });
    if (!res.ok) {
      console.warn('[Slack] Failed to send error notification:', res.status);
    }
  } catch (err) {
    console.warn('[Slack] Network error:', (err as Error).message);
  }
}
