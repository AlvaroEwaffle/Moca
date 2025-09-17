const BACKEND_URL = 'https://moca-backend-production.up.railway.app';

async function testCommentSettings() {
  console.log('🧪 Testing Instagram Comment Settings API...\n');

  // Test data
  const testSettings = {
    enabled: true,
    autoReplyComment: true,
    autoReplyDM: true,
    commentMessage: "Thanks for your comment! DM us for more info 📩",
    dmMessage: "Hi! Thanks for commenting on our post. How can we help you today?",
    replyDelay: 30
  };

  try {
    // Get accounts first
    console.log('1️⃣ Fetching Instagram accounts...');
    const accountsResponse = await fetch(`${BACKEND_URL}/api/instagram/accounts`, {
      headers: {
        'Authorization': `Bearer ${process.env.ACCESS_TOKEN || 'test-token'}`
      }
    });

    if (!accountsResponse.ok) {
      console.log('❌ Failed to fetch accounts. Make sure you have a valid access token.');
      console.log('   Set ACCESS_TOKEN environment variable or update the script.');
      return;
    }

    const accountsData = await accountsResponse.json();
    console.log(`✅ Found ${accountsData.data.accounts.length} accounts`);

    if (accountsData.data.accounts.length === 0) {
      console.log('❌ No Instagram accounts found. Please set up an account first.');
      return;
    }

    const account = accountsData.data.accounts[0];
    console.log(`📱 Testing with account: ${account.accountName} (${account.accountId})\n`);

    // Test getting current settings
    console.log('2️⃣ Getting current comment settings...');
    const getSettingsResponse = await fetch(`${BACKEND_URL}/api/instagram/comments/settings/${account.accountId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.ACCESS_TOKEN || 'test-token'}`
      }
    });

    if (getSettingsResponse.ok) {
      const settingsData = await getSettingsResponse.json();
      console.log('✅ Current settings:', JSON.stringify(settingsData.data.commentSettings, null, 2));
    } else {
      console.log('⚠️ Could not fetch current settings (this is normal for new accounts)');
    }

    // Test updating settings
    console.log('\n3️⃣ Updating comment settings...');
    const updateResponse = await fetch(`${BACKEND_URL}/api/instagram/comments/settings/${account.accountId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ACCESS_TOKEN || 'test-token'}`
      },
      body: JSON.stringify({
        commentSettings: testSettings
      })
    });

    if (updateResponse.ok) {
      const updateData = await updateResponse.json();
      console.log('✅ Settings updated successfully!');
      console.log('📝 Updated settings:', JSON.stringify(updateData.data.commentSettings, null, 2));
    } else {
      const errorData = await updateResponse.json();
      console.log('❌ Failed to update settings:', errorData.error);
    }

    // Test getting updated settings
    console.log('\n4️⃣ Verifying updated settings...');
    const verifyResponse = await fetch(`${BACKEND_URL}/api/instagram/comments/settings/${account.accountId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.ACCESS_TOKEN || 'test-token'}`
      }
    });

    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      console.log('✅ Verified settings:', JSON.stringify(verifyData.data.commentSettings, null, 2));
    }

    console.log('\n🎉 Comment settings test completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Go to https://7528802e.moca.pages.dev/app/accounts');
    console.log('   2. Click on "Comment Processing" section for your account');
    console.log('   3. Configure your comment settings');
    console.log('   4. Test by commenting on your Instagram posts');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testCommentSettings();
