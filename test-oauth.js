#!/usr/bin/env node

/**
 * Test script for Instagram OAuth flow
 * This script tests the OAuth callback endpoint
 */

const fetch = require('node-fetch');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';

async function testOAuthCallback() {
  console.log('🧪 Testing Instagram OAuth Callback...');
  
  try {
    // Test with a mock authorization code
    const mockCode = 'test_auth_code_123';
    const mockRedirectUri = 'https://moca.pages.dev/dashboard';
    const mockBusinessInfo = {
      businessName: 'Test Business',
      businessType: 'restaurant',
      primaryLanguage: 'es'
    };
    const mockAgentBehavior = {
      systemPrompt: 'You are a helpful customer service assistant for a restaurant.',
      toneOfVoice: 'friendly',
      keyInformation: 'We are open 9 AM to 10 PM daily.'
    };

    const response = await fetch(`${BACKEND_URL}/api/instagram/oauth/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_token' // You'll need a real token for actual testing
      },
      body: JSON.stringify({
        code: mockCode,
        redirectUri: mockRedirectUri,
        businessInfo: mockBusinessInfo,
        agentBehavior: mockAgentBehavior
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ OAuth callback endpoint is working');
      console.log('📊 Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ OAuth callback failed');
      console.log('📊 Error:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testAuthUrl() {
  console.log('🧪 Testing Instagram Auth URL generation...');
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/instagram/oauth/auth-url`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Auth URL generation is working');
      console.log('🔗 Auth URL:', data.data.authUrl);
      console.log('📍 Redirect URI:', data.data.redirectUri);
    } else {
      console.log('❌ Auth URL generation failed');
      console.log('📊 Error:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Instagram OAuth Tests...\n');
  
  await testAuthUrl();
  console.log('\n' + '='.repeat(50) + '\n');
  await testOAuthCallback();
  
  console.log('\n🎉 Tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testOAuthCallback, testAuthUrl };
