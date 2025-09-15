const axios = require('axios');

const BASE_URL = 'http://localhost:3002';
const TEST_TOKEN = 'your-test-token-here'; // Replace with actual token

async function performanceTest() {
  console.log('⚡ Analytics Performance Testing...\n');

  const headers = {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  };

  const dateRange = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString()
  };

  const endpoints = [
    {
      name: 'Overview Metrics',
      url: `${BASE_URL}/api/analytics/overview?start=${dateRange.start}&end=${dateRange.end}`
    },
    {
      name: 'Agent Performance',
      url: `${BASE_URL}/api/analytics/agents`
    },
    {
      name: 'Lead Scoring Analytics',
      url: `${BASE_URL}/api/analytics/leads?start=${dateRange.start}&end=${dateRange.end}`
    },
    {
      name: 'Conversation Analytics',
      url: `${BASE_URL}/api/analytics/conversations?start=${dateRange.start}&end=${dateRange.end}`
    },
    {
      name: 'System Health',
      url: `${BASE_URL}/api/analytics/system`
    }
  ];

  const results = [];

  for (const endpoint of endpoints) {
    console.log(`🔍 Testing ${endpoint.name} performance...`);
    
    const times = [];
    const errors = [];

    // Run 5 requests to get average performance
    for (let i = 0; i < 5; i++) {
      try {
        const startTime = Date.now();
        const response = await axios({
          method: 'GET',
          url: endpoint.url,
          headers
        });
        const endTime = Date.now();
        
        if (response.data.success) {
          times.push(endTime - startTime);
        } else {
          errors.push(response.data.error);
        }
      } catch (error) {
        errors.push(error.message);
      }
    }

    if (times.length > 0) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      results.push({
        name: endpoint.name,
        avgTime: Math.round(avgTime),
        minTime,
        maxTime,
        successRate: (times.length / 5) * 100,
        errors: errors.length > 0 ? errors : null
      });

      console.log(`   ✅ Average: ${Math.round(avgTime)}ms (${minTime}-${maxTime}ms)`);
      console.log(`   ✅ Success Rate: ${(times.length / 5) * 100}%`);
    } else {
      results.push({
        name: endpoint.name,
        avgTime: null,
        minTime: null,
        maxTime: null,
        successRate: 0,
        errors: errors
      });

      console.log(`   ❌ All requests failed`);
    }
  }

  // Summary
  console.log('\n📊 Performance Summary:');
  console.log('='.repeat(60));
  
  const successfulResults = results.filter(r => r.avgTime !== null);
  const totalAvgTime = successfulResults.reduce((sum, r) => sum + r.avgTime, 0) / successfulResults.length;
  const overallSuccessRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;

  console.log(`Overall Average Response Time: ${Math.round(totalAvgTime)}ms`);
  console.log(`Overall Success Rate: ${Math.round(overallSuccessRate)}%`);
  console.log('\nDetailed Results:');

  results.forEach(result => {
    if (result.avgTime !== null) {
      console.log(`  ${result.name}: ${result.avgTime}ms avg (${result.successRate}% success)`);
    } else {
      console.log(`  ${result.name}: FAILED (${result.successRate}% success)`);
    }
  });

  // Performance recommendations
  console.log('\n💡 Performance Recommendations:');
  if (totalAvgTime > 2000) {
    console.log('  ⚠️  Response times are slow (>2s). Consider:');
    console.log('     - Adding database indexes');
    console.log('     - Implementing caching');
    console.log('     - Optimizing aggregation pipelines');
  } else if (totalAvgTime > 1000) {
    console.log('  ⚠️  Response times are moderate (>1s). Consider:');
    console.log('     - Adding database indexes');
    console.log('     - Implementing basic caching');
  } else {
    console.log('  ✅ Response times are good (<1s)');
  }

  if (overallSuccessRate < 100) {
    console.log('  ⚠️  Some endpoints are failing. Check:');
    console.log('     - Database connections');
    console.log('     - Authentication tokens');
    console.log('     - Data availability');
  } else {
    console.log('  ✅ All endpoints are working correctly');
  }

  console.log('\n🏁 Performance testing completed!');
}

// Run performance test if this file is executed directly
if (require.main === module) {
  performanceTest().catch(console.error);
}

module.exports = { performanceTest };
