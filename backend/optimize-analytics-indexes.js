const mongoose = require('mongoose');
require('dotenv').config();

async function optimizeAnalyticsIndexes() {
  console.log('🔧 Optimizing Analytics Database Indexes...\n');

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Analytics-specific indexes for better performance
    const indexes = [
      // Conversation indexes for analytics
      {
        collection: 'conversations',
        index: { 'timestamps.createdAt': -1, 'leadScoring.currentScore': -1 },
        options: { name: 'analytics_date_leadscore' }
      },
      {
        collection: 'conversations',
        index: { 'accountId': 1, 'timestamps.createdAt': -1 },
        options: { name: 'analytics_account_date' }
      },
      {
        collection: 'conversations',
        index: { 'status': 1, 'timestamps.createdAt': -1 },
        options: { name: 'analytics_status_date' }
      },
      {
        collection: 'conversations',
        index: { 'leadScoring.progression': 1, 'timestamps.createdAt': -1 },
        options: { name: 'analytics_progression_date' }
      },
      {
        collection: 'conversations',
        index: { 'settings.aiEnabled': 1, 'timestamps.createdAt': -1 },
        options: { name: 'analytics_ai_enabled_date' }
      },
      {
        collection: 'conversations',
        index: { 'milestone.status': 1, 'timestamps.createdAt': -1 },
        options: { name: 'analytics_milestone_date' }
      },

      // Message indexes for analytics
      {
        collection: 'messages',
        index: { 'timestamp': -1, 'sender': 1 },
        options: { name: 'analytics_message_timestamp_sender' }
      },
      {
        collection: 'messages',
        index: { 'conversationId': 1, 'timestamp': -1 },
        options: { name: 'analytics_message_conversation_timestamp' }
      },

      // Instagram account indexes
      {
        collection: 'instagramaccounts',
        index: { 'isActive': 1, 'createdAt': -1 },
        options: { name: 'analytics_account_active_date' }
      },

      // Contact indexes
      {
        collection: 'contacts',
        index: { 'createdAt': -1, 'metadata.instagramData.username': 1 },
        options: { name: 'analytics_contact_date_username' }
      },

      // Global agent config indexes
      {
        collection: 'globalagentconfigs',
        index: { 'createdAt': -1 },
        options: { name: 'analytics_global_config_date' }
      }
    ];

    console.log('📊 Creating analytics indexes...\n');

    for (const indexSpec of indexes) {
      try {
        const collection = db.collection(indexSpec.collection);
        
        // Check if index already exists
        const existingIndexes = await collection.indexes();
        const indexExists = existingIndexes.some(idx => 
          idx.name === indexSpec.options.name
        );

        if (indexExists) {
          console.log(`  ⏭️  Index ${indexSpec.options.name} already exists`);
          continue;
        }

        // Create the index
        await collection.createIndex(indexSpec.index, indexSpec.options);
        console.log(`  ✅ Created index: ${indexSpec.options.name}`);
        
      } catch (error) {
        console.log(`  ❌ Failed to create index ${indexSpec.options.name}: ${error.message}`);
      }
    }

    // Create compound indexes for common analytics queries
    console.log('\n🔗 Creating compound indexes for common queries...');

    const compoundIndexes = [
      // Overview metrics query optimization
      {
        collection: 'conversations',
        index: { 
          'timestamps.createdAt': -1, 
          'status': 1, 
          'leadScoring.currentScore': 1 
        },
        options: { name: 'analytics_overview_compound' }
      },
      
      // Agent performance query optimization
      {
        collection: 'conversations',
        index: { 
          'accountId': 1, 
          'timestamps.createdAt': -1,
          'metrics.botMessages': 1,
          'metrics.errorCount': 1
        },
        options: { name: 'analytics_agent_performance_compound' }
      },

      // Lead scoring analytics optimization
      {
        collection: 'conversations',
        index: { 
          'timestamps.createdAt': -1,
          'leadScoring.currentScore': 1,
          'leadScoring.progression': 1
        },
        options: { name: 'analytics_lead_scoring_compound' }
      },

      // Conversation analytics optimization
      {
        collection: 'conversations',
        index: { 
          'timestamps.createdAt': -1,
          'status': 1,
          'messageCount': 1
        },
        options: { name: 'analytics_conversation_compound' }
      }
    ];

    for (const indexSpec of compoundIndexes) {
      try {
        const collection = db.collection(indexSpec.collection);
        
        // Check if index already exists
        const existingIndexes = await collection.indexes();
        const indexExists = existingIndexes.some(idx => 
          idx.name === indexSpec.options.name
        );

        if (indexExists) {
          console.log(`  ⏭️  Compound index ${indexSpec.options.name} already exists`);
          continue;
        }

        // Create the index
        await collection.createIndex(indexSpec.index, indexSpec.options);
        console.log(`  ✅ Created compound index: ${indexSpec.options.name}`);
        
      } catch (error) {
        console.log(`  ❌ Failed to create compound index ${indexSpec.options.name}: ${error.message}`);
      }
    }

    // Analyze collection statistics
    console.log('\n📈 Collection Statistics:');
    const collections = ['conversations', 'messages', 'contacts', 'instagramaccounts'];
    
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const stats = await collection.stats();
        
        console.log(`  ${collectionName}:`);
        console.log(`    Documents: ${stats.count.toLocaleString()}`);
        console.log(`    Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`    Indexes: ${stats.nindexes}`);
        console.log(`    Index Size: ${(stats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
      } catch (error) {
        console.log(`  ${collectionName}: Error getting stats - ${error.message}`);
      }
    }

    console.log('\n✅ Analytics index optimization completed!');
    console.log('\n💡 Next steps:');
    console.log('  1. Monitor query performance in production');
    console.log('  2. Run ANALYZE on collections if using MongoDB Atlas');
    console.log('  3. Consider implementing query result caching');
    console.log('  4. Monitor index usage with db.collection.getIndexes()');

  } catch (error) {
    console.error('❌ Error optimizing indexes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run optimization if this file is executed directly
if (require.main === module) {
  optimizeAnalyticsIndexes().catch(console.error);
}

module.exports = { optimizeAnalyticsIndexes };
