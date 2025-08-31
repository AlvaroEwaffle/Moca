const axios = require('axios');

// Test Instagram webhook functionality
async function testInstagramWebhook() {
  try {
    console.log('🧪 Testing Instagram Webhook Functionality...\n');

    const baseUrl = 'http://localhost:3002/api/instagram';

    // Test 1: Webhook verification
    console.log('🔗 Test 1: Testing webhook verification...');
    try {
      const verifyResponse = await axios.get(`${baseUrl}/webhook`, {
        params: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test_verify_token',
          'hub.challenge': 'test_challenge_123'
        }
      });
      console.log('✅ Webhook verification response:', verifyResponse.data);
    } catch (error) {
      console.log('⚠️ Webhook verification test:', error.response?.status || error.message);
    }

    // Test 2: Simulate webhook message
    console.log('\n📥 Test 2: Testing webhook message processing...');
    try {
      const webhookPayload = {
        object: 'instagram',
        entry: [
          {
            id: 'test_entry_123',
            time: Math.floor(Date.now() / 1000),
            messaging: [
              {
                sender: { id: 'test_psid_456' },
                recipient: { id: 'test_recipient' },
                timestamp: Math.floor(Date.now() / 1000),
                message: {
                  mid: 'test_mid_789',
                  text: 'Hola, necesito información sobre servicios web'
                }
              }
            ]
          }
        ]
      };

      const webhookResponse = await axios.post(`${baseUrl}/webhook`, webhookPayload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Webhook message sent, response status:', webhookResponse.status);
    } catch (error) {
      console.log('⚠️ Webhook message test:', error.response?.status || error.message);
    }

    // Test 3: Check if data was created
    console.log('\n🔍 Test 3: Checking if data was created...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processing

    try {
      const contactsResponse = await axios.get(`${baseUrl}/contacts`);
      console.log('📊 Contacts count:', contactsResponse.data.data.contacts.length);

      const conversationsResponse = await axios.get(`${baseUrl}/conversations`);
      console.log('💬 Conversations count:', conversationsResponse.data.data.conversations.length);

      const queueResponse = await axios.get(`${baseUrl}/queue/status`);
      console.log('📤 Queue status:', queueResponse.data.data);
    } catch (error) {
      console.log('⚠️ Data check failed:', error.message);
    }

    // Test 4: Test manual message sending
    console.log('\n📤 Test 4: Testing manual message sending...');
    try {
      // First create a conversation if none exists
      const conversationsResponse = await axios.get(`${baseUrl}/conversations`);
      if (conversationsResponse.data.data.conversations.length === 0) {
        console.log('⚠️ No conversations found, skipping manual message test');
      } else {
        const conversationId = conversationsResponse.data.data.conversations[0].id;
        const messageResponse = await axios.post(`${baseUrl}/conversations/${conversationId}/messages`, {
          content: {
            text: '¡Hola! Este es un mensaje de prueba enviado manualmente.'
          },
          priority: 'normal'
        });
        console.log('✅ Manual message sent:', messageResponse.data.data.message.id);
      }
    } catch (error) {
      console.log('⚠️ Manual message test:', error.response?.status || error.message);
    }

    console.log('\n🎉 Webhook functionality test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testInstagramWebhook();
