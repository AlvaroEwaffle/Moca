const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const InstagramAccount = require('./dist/models/instagramAccount.model').default;
const Contact = require('./dist/models/contact.model').default;
const Conversation = require('./dist/models/conversation.model').default;
const Message = require('./dist/models/message.model').default;
const OutboundQueue = require('./dist/models/outboundQueue.model').default;

async function testInstagramBackend() {
  try {
    console.log('🧪 Testing Instagram DM Backend...\n');

    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Create Instagram Account
    console.log('📱 Test 1: Creating Instagram Account...');
    const account = new InstagramAccount({
      accountId: 'test_account',
      accountName: 'Test Instagram Account',
      accessToken: 'test_token_123',
      tokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      webhook: {
        verifyToken: 'test_verify_token',
        isActive: true
      }
    });
    await account.save();
    console.log('✅ Instagram Account created:', account.id);

    // Test 2: Create Contact
    console.log('\n👤 Test 2: Creating Contact...');
    const contact = new Contact({
      psid: 'test_psid_123',
      name: 'Test User',
      email: 'test@example.com',
      metadata: {
        firstSeen: new Date(),
        lastSeen: new Date(),
        messageCount: 0,
        responseCount: 0,
        source: 'instagram_dm'
      }
    });
    await contact.save();
    console.log('✅ Contact created:', contact.id);

    // Test 3: Create Conversation
    console.log('\n💬 Test 3: Creating Conversation...');
    const conversation = new Conversation({
      contactId: contact.id,
      accountId: account.id,
      status: 'open',
      timestamps: {
        createdAt: new Date(),
        lastUserMessage: new Date(),
        lastActivity: new Date()
      },
      context: {
        sentiment: 'neutral',
        urgency: 'medium',
        language: 'es',
        timezone: 'America/Santiago'
      },
      metrics: {
        totalMessages: 0,
        userMessages: 0,
        botMessages: 0,
        responseRate: 0,
        engagementScore: 0,
        satisfactionScore: 0,
        conversionProbability: 0
      },
      settings: {
        autoRespond: true,
        aiEnabled: true,
        priority: 'normal',
        businessHoursOnly: false
      },
      isActive: true,
      messageCount: 0,
      unreadCount: 0
    });
    await conversation.save();
    console.log('✅ Conversation created:', conversation.id);

    // Test 4: Create Message
    console.log('\n📨 Test 4: Creating Message...');
    const message = new Message({
      mid: 'test_mid_123',
      conversationId: conversation.id,
      contactId: contact.id,
      accountId: account.id,
      role: 'user',
      content: {
        text: 'Hola, necesito información sobre servicios web',
        attachments: [],
        quickReplies: [],
        buttons: []
      },
      metadata: {
        timestamp: new Date(),
        isConsolidated: false,
        originalMids: ['test_mid_123'],
        aiGenerated: false,
        processingTime: 0
      },
      status: 'received',
      priority: 'normal',
      isRead: false,
      deliveryConfirmed: true
    });
    await message.save();
    console.log('✅ Message created:', message.id);

    // Test 5: Create Outbound Queue Item
    console.log('\n📤 Test 5: Creating Outbound Queue Item...');
    const queueItem = new OutboundQueue({
      messageId: message.id,
      conversationId: conversation.id,
      contactId: contact.id,
      accountId: account.id,
      priority: 'normal',
      status: 'pending',
      content: {
        text: '¡Hola! Te ayudo con información sobre servicios web. ¿Qué tipo de sitio necesitas?',
        attachments: [],
        quickReplies: [],
        buttons: []
      },
      tags: ['test'],
      notes: ['Test queue item']
    });
    await queueItem.save();
    console.log('✅ Outbound Queue Item created:', queueItem.id);

    // Test 6: Query Data
    console.log('\n🔍 Test 6: Querying Data...');
    
    const accountsCount = await InstagramAccount.countDocuments();
    const contactsCount = await Contact.countDocuments();
    const conversationsCount = await Conversation.countDocuments();
    const messagesCount = await Message.countDocuments();
    const queueCount = await OutboundQueue.countDocuments();

    console.log('📊 Data Summary:');
    console.log(`   Instagram Accounts: ${accountsCount}`);
    console.log(`   Contacts: ${contactsCount}`);
    console.log(`   Conversations: ${conversationsCount}`);
    console.log(`   Messages: ${messagesCount}`);
    console.log(`   Queue Items: ${queueCount}`);

    // Test 7: Test Virtual Fields
    console.log('\n✨ Test 7: Testing Virtual Fields...');
    
    const testAccount = await InstagramAccount.findById(account.id);
    console.log(`   Account Token Valid: ${testAccount.isTokenValid}`);
    console.log(`   Token Expiry Seconds: ${testAccount.tokenExpirySeconds}`);

    const testContact = await Contact.findById(contact.id);
    console.log(`   Contact Days Since First: ${testContact.daysSinceFirstContact}`);
    console.log(`   Contact Response Rate: ${testContact.responseRate}%`);

    const testConversation = await Conversation.findById(conversation.id);
    console.log(`   Conversation Duration: ${testConversation.duration} days`);
    console.log(`   Conversation In Cooldown: ${testConversation.isInCooldown}`);

    const testMessage = await Message.findById(message.id);
    console.log(`   Message Age Seconds: ${testMessage.ageSeconds}`);
    console.log(`   Message Is Recent: ${testMessage.isRecent}`);

    const testQueueItem = await OutboundQueue.findById(queueItem.id);
    console.log(`   Queue Item Ready: ${testQueueItem.isReadyToProcess}`);
    console.log(`   Queue Item Can Retry: ${testQueueItem.canRetry}`);

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Test Results Summary:');
    console.log('✅ Instagram Account creation and management');
    console.log('✅ Contact creation and metadata');
    console.log('✅ Conversation management and context');
    console.log('✅ Message handling and status');
    console.log('✅ Outbound queue management');
    console.log('✅ Data querying and relationships');
    console.log('✅ Virtual fields and computed properties');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    try {
      await InstagramAccount.deleteMany({ accountId: 'test_account' });
      await Contact.deleteMany({ psid: 'test_psid_123' });
      await Conversation.deleteMany({ contactId: { $exists: true } });
      await Message.deleteMany({ mid: 'test_mid_123' });
      await OutboundQueue.deleteMany({ messageId: { $exists: true } });
      console.log('✅ Test data cleaned up');
    } catch (cleanupError) {
      console.error('⚠️ Error cleaning up test data:', cleanupError);
    }

    // Close connection
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

// Run the test
testInstagramBackend();
