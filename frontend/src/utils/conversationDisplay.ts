const MIN_DISPLAY_YEAR = 2020;
const MAX_DISPLAY_YEAR = 2030;

export const toSafeDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  if (year < MIN_DISPLAY_YEAR || year > MAX_DISPLAY_YEAR) return null;

  return date;
};

export const formatSafeDate = (value: unknown, fallback = "Sin fecha") => {
  const date = toSafeDate(value);
  if (!date) return fallback;

  return date.toLocaleDateString('es-CL', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatSafeDateTime = (value: unknown, fallback = "Sin fecha") => {
  const date = toSafeDate(value);
  return date ? date.toLocaleString('es-CL') : fallback;
};

export const formatSafeTimeAgo = (value: unknown, fallback = "Sin fecha") => {
  const date = toSafeDate(value);
  if (!date) return fallback;

  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < -5) return formatSafeDate(value, fallback);
  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
};

const cleanString = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export const safeMessageText = (message: any, fallback = "Mensaje sin contenido disponible") => {
  const text = cleanString(message?.text || message?.content?.text);
  if (text && text.toLowerCase() !== 'message') return text;

  if (message?.hasVisibleContent === false || message?.contentIssue) return fallback;
  if (Array.isArray(message?.content?.attachments) && message.content.attachments.length > 0) return "[Adjunto]";

  return fallback;
};

export const getContactDisplay = (source: any) => {
  const contact = source?.contact || source?.contactId || {};
  const metadata = contact.metadata || {};
  const instagramData = metadata.instagramData || {};
  const username = cleanString(source?.username || contact.username || instagramData.username).replace(/^@/, '');
  const name = cleanString(source?.displayName || contact.displayName || contact.name);
  const psid = cleanString(source?.psid || contact.psid);
  const fallback = psid ? `Instagram ${psid.slice(-6)}` : "Contacto sin nombre";

  return {
    name: name || (username ? `@${username}` : fallback),
    username,
    psid,
    profilePicture: contact.profilePicture
  };
};

export const normalizeConversationSummary = (conv: any) => {
  const contact = getContactDisplay(conv);
  const lastMessage = conv?.lastMessage || null;
  const fallbackTimestamp = conv?.lastActivity || conv?.timestamps?.lastActivity || conv?.updatedAt || conv?.createdAt;
  const timestamps = {
    createdAt: toSafeDate(conv?.timestamps?.createdAt || conv?.createdAt),
    lastUserMessage: toSafeDate(conv?.timestamps?.lastUserMessage),
    lastBotMessage: toSafeDate(conv?.timestamps?.lastBotMessage),
    lastActivity: toSafeDate(fallbackTimestamp)
  };

  return {
    id: conv?._id || conv?.id,
    contactId: conv?.contactId,
    accountId: conv?.accountId,
    status: conv?.status || 'open',
    lastMessage: lastMessage ? {
      ...lastMessage,
      text: safeMessageText(lastMessage),
      timestamp: toSafeDate(lastMessage.timestamp || fallbackTimestamp),
      sender: lastMessage.sender || (lastMessage.role === 'assistant' ? 'bot' : 'user')
    } : {
      text: "Sin mensajes visibles",
      timestamp: toSafeDate(fallbackTimestamp),
      sender: 'user'
    },
    contact,
    messageCount: conv?.messageCount || conv?.metrics?.totalMessages || 0,
    unreadCount: conv?.unreadCount || 0,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.lastActivity,
    timestamps,
    agentEnabled: conv?.settings?.aiEnabled !== false,
    leadScoring: conv?.leadScoring,
    aiResponseMetadata: conv?.aiResponseMetadata,
    analytics: conv?.analytics,
    milestone: conv?.milestone,
    settings: conv?.settings
  };
};

export const normalizeMessage = (message: any) => ({
  id: message?._id || message?.id,
  text: safeMessageText(message),
  sender: message?.sender || (message?.role === 'assistant' ? 'bot' : 'user'),
  timestamp: toSafeDate(message?.timestamp || message?.metadata?.timestamp || message?.createdAt),
  createdAt: toSafeDate(message?.createdAt || message?.metadata?.timestamp),
  status: message?.status || 'sent',
  metadata: message?.metadata || {},
  hasVisibleContent: message?.hasVisibleContent !== false && !message?.contentIssue
});
