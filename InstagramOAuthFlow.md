# Instagram OAuth Flow Implementation - Moca Project

## Overview
This document details the complete Instagram OAuth flow implementation, including the 3-step token exchange process and fallback mechanism.

## OAuth Flow - 3 Steps

### Step 1: Short-lived Token Exchange
**Endpoint**: `https://api.instagram.com/oauth/access_token`

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

const tokenData = await tokenResponse.json();
// Returns: { access_token: "IGAA...", user_id: "30927608773521030" }
```

### Step 2: Long-lived Token Exchange (Attempt)
**Endpoint**: `https://graph.facebook.com/v21.0/oauth/access_token`

```typescript
const longLivedResponse = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?` +
  `grant_type=fb_exchange_token&` +
  `client_id=${process.env.INSTAGRAM_CLIENT_ID}&` +
  `client_secret=${process.env.INSTAGRAM_CLIENT_SECRET}&` +
  `fb_exchange_token=${shortLivedToken}`);

const longLivedData = await longLivedResponse.json();
// Returns: { access_token: "IGAA...", expires_in: 5183944 }
```

### Step 3: Page Access Token (If Step 2 succeeds)
**Endpoint**: `https://graph.facebook.com/v21.0/me/accounts`

```typescript
// Get Facebook Pages associated with the long-lived token
const pagesResponse = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${longLivedToken}`);
const pagesData = await pagesResponse.json();

// Find page with Instagram Business Account
const pageWithInstagram = pagesData.data.find(page => page.instagram_business_account);
const pageAccessToken = pageWithInstagram.access_token; // This is the Page Access Token (no expiration)

// Get Instagram Business profile
const instagramProfileUrl = `https://graph.facebook.com/v21.0/${pageWithInstagram.id}?fields=instagram_business_account{id,username,name,profile_picture_url}&access_token=${pageAccessToken}`;
const profileResponse = await fetch(instagramProfileUrl);
const profileData = await profileResponse.json();
```

## Fallback Mechanism

### When Step 2 Fails (Common with unapproved apps)
**Error**: `"Error validating application. Cannot get application info due to a system error." (Code 101)`

**Solution**: Use short-lived token directly with 2-hour expiry

```typescript
if (longLivedResponse.error) {
  console.log('⚠️ Long-lived token exchange failed, using fallback');
  
  // Use short-lived token directly
  access_token = shortLivedToken;
  tokenExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
  
  // Get basic profile with short-lived token
  const basicProfileUrl = `https://graph.instagram.com/me?fields=id,username&access_token=${shortLivedToken}`;
  const basicProfileResponse = await fetch(basicProfileUrl);
  const basicProfileData = await basicProfileResponse.json();
  
  profileData = {
    id: basicProfileData.id,
    username: basicProfileData.username,
    name: basicProfileData.username,
    profile_picture_url: null
  };
}
```

## Database Storage

### InstagramAccount Model
```typescript
interface IInstagramAccount {
  accountId: string; // Use profile.id, NOT token.user_id
  accessToken: string;
  accountName: string;
  tokenExpiry: Date | null; // null for Page Access Tokens, Date for short-lived
  settings: {
    systemPrompt?: string;
    toneOfVoice?: string;
    keyInformation?: string;
  };
}
```

### Important: ID Mismatch Issue
**Problem**: Token `user_id` differs from profile `id`
- **Token user_id**: `30927608773521030`
- **Profile id**: `30927608773521033`

**Solution**: Always use `profileData.id` as `accountId`, never use `tokenData.user_id`

## Token Types & Expiration

### 1. Short-lived Token (Basic Display API)
- **Duration**: 1 hour
- **Usage**: Initial token from OAuth
- **Refresh**: Can be refreshed to long-lived

### 2. Long-lived Token (Facebook Graph API)
- **Duration**: 60 days
- **Usage**: Extended access for business features
- **Refresh**: Can be refreshed before expiration

### 3. Page Access Token (Instagram Business API)
- **Duration**: No expiration
- **Usage**: Best for production (no token management needed)
- **Source**: Derived from long-lived token via Facebook Page

## OAuth Authorization URL

```typescript
const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?` +
  `client_id=${INSTAGRAM_CLIENT_ID}&` +
  `redirect_uri=https://moca.pages.dev/instagram-callback&` +
  `response_type=code&` +
  `scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights,pages_show_list,pages_messaging`;
```

## Environment Variables

```bash
INSTAGRAM_CLIENT_ID=2160534791106844
INSTAGRAM_CLIENT_SECRET=1d03d5811b69d424511f48b6a29b6010
INSTAGRAM_VERIFY_TOKEN=cataleya
```

## Current Implementation Status

### ✅ Working
- Step 1: Short-lived token exchange
- Fallback mechanism for Step 2 failures
- Basic profile fetching with short-lived token
- Account creation and storage

### ⚠️ Issues
- Step 2: Long-lived token exchange fails (Code 101)
- ID mismatch between token user_id and profile id
- Using short-lived tokens (2-hour expiry) instead of Page Access Tokens

### 🔧 Solutions Implemented
- Fallback to short-lived token with 2-hour expiry
- Automatic token refresh for short-lived tokens
- Proper ID handling (use profile.id as accountId)

---

**Last Updated**: January 2025
**Status**: Working with fallback mechanism
