# Instagram Integration Implementation - Moca Project

## Overview
This document details the complete Instagram integration implementation for the Moca project, including OAuth flow, token management, webhook handling, and message processing.

## Architecture

### Frontend (React + Vite)
- **Framework**: React with TypeScript
- **Deployment**: Cloudflare Pages (`https://moca.pages.dev`)
- **Routing**: React Router with `/app/` prefix

### Backend (Node.js + Express)
- **Framework**: Express.js with TypeScript
- **Database**: MongoDB with Mongoose
- **Deployment**: Railway (`https://moca-production.up.railway.app`)

## Instagram OAuth Flow Implementation

### 1. OAuth Authorization URL
```typescript
// Frontend generates OAuth URL
const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?` +
  `client_id=${INSTAGRAM_CLIENT_ID}&` +
  `redirect_uri=https://moca.pages.dev/instagram-callback&` +
  `response_type=code&` +
  `scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights,pages_show_list,pages_messaging`
```

### 2. OAuth Callback Processing
**Endpoint**: `POST /api/instagram-oauth/callback`

**Step 1: Short-lived Token Exchange**
```typescript
const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: process.env.INSTAGRAM_CLIENT_ID,
    client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: 'https://moca.pages.dev/instagram-callback',
    code: authorizationCode
  })
});
```

**Step 2: Long-lived Token Exchange (Attempt)**
```typescript
const longLivedResponse = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?` +
  `grant_type=fb_exchange_token&` +
  `client_id=${process.env.INSTAGRAM_CLIENT_ID}&` +
  `client_secret=${process.env.INSTAGRAM_CLIENT_SECRET}&` +
  `fb_exchange_token=${shortLivedToken}`);
```

**Step 3: Page Access Token (If Step 2 succeeds)**
```typescript
// Get Facebook Pages
const pagesResponse = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${longLivedToken}`);
const pages = await pagesResponse.json();

// Find page with Instagram Business Account
const pageWithInstagram = pages.data.find(page => page.instagram_business_account);
const pageAccessToken = pageWithInstagram.access_token; // This is the Page Access Token (no expiration)
```

### 3. Fallback Mechanism
If long-lived token exchange fails (common with unapproved apps):
```typescript
// Use short-lived token directly with 2-hour expiry
access_token = shortLivedToken;
tokenExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
```

## Database Models

### InstagramAccount Model
```typescript
interface IInstagramAccount {
  _id: ObjectId;
  accountId: string; // Instagram Business Account ID
  accessToken: string;
  accountName: string;
  tokenExpiry: Date | null; // null for Page Access Tokens
  settings: {
    systemPrompt?: string;
    toneOfVoice?: string;
    keyInformation?: string;
  };
  businessInfo: {
    company?: string;
    sector?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Message Model
```typescript
interface IMessage {
  _id: ObjectId;
  conversationId: ObjectId;
  mid: string; // Instagram message ID
  content: string;
  role: 'user' | 'assistant' | 'system';
  metadata: {
    processed: boolean; // Prevents reprocessing
    timestamp: Date;
  };
  createdAt: Date;
}
```

### OutboundQueue Model
```typescript
interface IOutboundQueue {
  _id: ObjectId;
  conversationId: ObjectId;
  contactId: ObjectId;
  messageId: string; // Unique constraint
  content: string;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  retryCount: number;
  createdAt: Date;
}
```

## Webhook Processing

### Webhook Endpoint
**Endpoint**: `POST /api/instagram/webhook`

### Message Processing Flow
1. **Signature Validation**: Verify webhook signature
2. **Role Detection**: Determine if message is from user or bot
3. **Bot Message Filtering**: Skip processing if message is from bot
4. **Message Storage**: Store message with `processed: false`
5. **Debounce Trigger**: Trigger message collection for batching

### Bot Message Detection
```typescript
// Compare sender PSID with bot's account ID
const isBotMessage = messageData.psid === accountId;
if (isBotMessage) {
  console.log('🤖 Bot message detected, skipping processing');
  return; // Skip processing to prevent loops
}
```

## Message Batching System

### DebounceWorkerService
- **Collection Window**: 5 seconds
- **Processing Logic**: Groups multiple user messages within window
- **Single Response**: Generates one AI response for the entire batch
- **Message Marking**: Marks all messages as `processed: true` before AI generation

### Batching Flow
1. **Message Collection**: Collect unprocessed messages for 5 seconds
2. **Batch Processing**: Process all messages in conversation together
3. **AI Generation**: Generate single response for entire batch
4. **Queue Creation**: Create single OutboundQueue item
5. **Message Marking**: Mark all messages as processed

## AI Integration

### OpenAI Service
- **Model**: GPT-3.5 Turbo (cost-optimized)
- **Context**: Full conversation history + agent settings
- **Agent Behavior**: Uses stored system prompt, tone, and key information

### Context Passing
```typescript
const context = {
  conversationHistory: messages,
  userContext: {
    contact: contactData,
    businessInfo: businessData,
    agentBehavior: {
      systemPrompt: instagramAccount.settings.systemPrompt,
      toneOfVoice: instagramAccount.settings.toneOfVoice,
      keyInformation: instagramAccount.settings.keyInformation
    }
  }
};
```

## Token Management

### Token Types
1. **Short-lived Token**: 1 hour (Basic Display API)
2. **Long-lived Token**: 60 days (Facebook Graph API)
3. **Page Access Token**: No expiration (Instagram Business API)

### Token Refresh
```typescript
// For short-lived tokens
const refreshResponse = await fetch(`https://graph.instagram.com/refresh_access_token?` +
  `grant_type=ig_refresh_token&` +
  `access_token=${currentToken}`);
```

### Token Validation
```typescript
// Check if token is expired
const isExpired = account.tokenExpiry && new Date() > account.tokenExpiry;
if (isExpired) {
  await refreshAccessToken(account);
}
```

## Error Handling

### Common Issues
1. **"Token not valid"**: Automatic refresh attempt
2. **"The requested user cannot be found"**: Mark as failed, no retry
3. **"Error validating application"**: Use fallback mechanism
4. **Bot answering itself**: PSID comparison to detect bot messages

### Retry Logic
- **Message Sending**: 3 retries with exponential backoff
- **Token Refresh**: Automatic on 401 errors
- **Webhook Processing**: No retries (idempotent)

## Security

### Webhook Security
- **Signature Validation**: HMAC-SHA256 verification
- **Verify Token**: Custom token for webhook verification
- **Rate Limiting**: Built-in Express rate limiting

### Token Security
- **Environment Variables**: All tokens stored in environment
- **Database Encryption**: Tokens stored encrypted in MongoDB
- **HTTPS Only**: All API calls use HTTPS

## Current Issues & Solutions

### Issue 1: ID Mismatch
**Problem**: Token `user_id` differs from profile `id`
**Solution**: Use profile `id` as `accountId`, not token `user_id`

### Issue 2: Long-lived Token Exchange Failure
**Problem**: "Error validating application" (Code 101)
**Solution**: Fallback to short-lived token with 2-hour expiry

### Issue 3: Bot Message Loops
**Problem**: Bot processes its own messages
**Solution**: PSID comparison to detect and skip bot messages

### Issue 4: Multiple Responses
**Problem**: Multiple responses to single user message
**Solution**: Mark messages as processed before AI generation

## Environment Variables

### Backend (.env)
```bash
INSTAGRAM_CLIENT_ID=2160534791106844
INSTAGRAM_CLIENT_SECRET=1d03d5811b69d424511f48b6a29b6010
INSTAGRAM_VERIFY_TOKEN=cataleya
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo
MONGODB_URI=mongodb+srv://...
```

### Frontend (.env.production)
```bash
VITE_BACKEND_URL=https://moca-production.up.railway.app
```

## API Endpoints

### Instagram OAuth
- `GET /api/instagram-oauth/auth-url` - Get OAuth URL
- `POST /api/instagram-oauth/callback` - Handle OAuth callback
- `POST /api/instagram-oauth/refresh-token` - Refresh access token

### Instagram Webhook
- `GET /api/instagram/webhook` - Webhook verification
- `POST /api/instagram/webhook` - Receive webhook events

### Instagram API
- `GET /api/instagram/accounts` - Get connected accounts
- `POST /api/instagram/send-message` - Send message manually

## Deployment

### Backend (Railway)
- **URL**: `https://moca-production.up.railway.app`
- **Build**: `npm run build && npm start`
- **Environment**: Production with all required env vars

### Frontend (Cloudflare Pages)
- **URL**: `https://moca.pages.dev`
- **Build**: `npm run build`
- **Environment**: Production with `VITE_BACKEND_URL`

## Testing

### Manual Testing
1. **OAuth Flow**: Complete Instagram authorization
2. **Message Sending**: Send message from Instagram
3. **Bot Response**: Verify AI response is generated
4. **Token Refresh**: Test token expiration handling

### Logging
- **Comprehensive Logging**: All major operations logged
- **Error Tracking**: Detailed error logs with context
- **Performance Monitoring**: Response time tracking

## Future Improvements

### Planned Features
1. **Conversation Closing**: AI-powered conversation analysis
2. **Lead Qualification**: Automatic lead scoring
3. **Analytics Dashboard**: Conversation metrics
4. **Multi-account Support**: Multiple Instagram accounts per user

### Technical Improvements
1. **Rate Limiting**: Instagram API rate limit handling
2. **Message Templates**: Predefined response templates
3. **A/B Testing**: Response optimization
4. **Offline Support**: Queue messages when offline

## Troubleshooting

### Common Debug Steps
1. **Check Logs**: Review backend logs for errors
2. **Verify Tokens**: Ensure tokens are valid and not expired
3. **Test Webhooks**: Verify webhook signature validation
4. **Database Check**: Verify data is stored correctly

### Log Analysis
- **OAuth Flow**: Check token exchange steps
- **Webhook Processing**: Verify message role detection
- **AI Generation**: Check context passing
- **Message Sending**: Verify API calls and responses

---

**Last Updated**: January 2025
**Version**: 1.0
**Status**: Production Ready (with fallback mechanisms)
