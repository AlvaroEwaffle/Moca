# Instagram OAuth Setup Guide

## Overview
Moca now supports Instagram OAuth integration, allowing users to connect their Instagram accounts securely without manually copying tokens.

## Environment Variables Required

Add these to your `.env` file:

```env
# Instagram OAuth Configuration
INSTAGRAM_CLIENT_ID=your_instagram_app_client_id
INSTAGRAM_CLIENT_SECRET=your_instagram_app_client_secret
INSTAGRAM_VERIFY_TOKEN=cataleya
```

## Frontend Environment Variables

Add to your frontend `.env` file:

```env
VITE_INSTAGRAM_CLIENT_ID=your_instagram_app_client_id
```

## Instagram App Setup

1. **Create Instagram App**:
   - Go to [Meta for Developers](https://developers.facebook.com/)
   - Create a new app
   - Add Instagram Basic Display product

2. **Configure OAuth Settings**:
   - Add redirect URI: `https://yourdomain.com/instagram-auth`
   - For local development: `http://localhost:5173/instagram-auth`

3. **Get Credentials**:
   - Copy Client ID and Client Secret
   - Add them to your environment variables

## How It Works

### User Flow:
1. User clicks "Connect with Instagram" in Instagram Setup
2. Redirects to Instagram OAuth authorization page
3. User logs in and grants permissions
4. Instagram redirects back to `/instagram-auth` with authorization code
5. Backend exchanges code for access token
6. Account is automatically created/updated in database
7. User is redirected to dashboard

### Backend Flow:
1. `POST /api/instagram/oauth/callback` receives authorization code
2. Exchanges code for access token via Instagram API
3. Fetches user profile information
4. Creates or updates Instagram account in database
5. Returns success response

## Features

✅ **Secure OAuth Flow**: Uses official Instagram OAuth 2.0
✅ **Automatic Token Management**: No manual token copying
✅ **Profile Information**: Automatically fetches username and account details
✅ **Account Updates**: Updates existing accounts with new tokens
✅ **Error Handling**: Comprehensive error handling and user feedback

## Manual Setup Still Available

Users can still use the manual setup method if they prefer to:
- Copy tokens manually
- Use existing tokens
- Set up accounts programmatically

## Security Notes

- Access tokens are stored securely in the database
- Tokens expire after 60 days (Instagram default)
- Client secret is never exposed to frontend
- All OAuth flows use HTTPS in production

## Testing

1. Set up environment variables
2. Start backend server
3. Start frontend development server
4. Navigate to Instagram Setup page
5. Click "Connect with Instagram"
6. Complete OAuth flow
7. Verify account appears in dashboard
