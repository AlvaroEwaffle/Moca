const axios = require('axios');

const BASE_URL = 'http://localhost:3002';
const TEST_TOKEN = 'your-test-token-here'; // Replace with actual token

async function testAnalyticsEndpoints() {
  console.log('🧪 Testing Analytics API Endpoints...\n');

  const headers = {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  };

  const dateRange = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString()
  };

  const tests = [
    {
      name: 'Overview Metrics',
      url: `${BASE_URL}/api/analytics/overview?start=${dateRange.start}&end=${dateRange.end}`,
      method: 'GET'
    },
    {
      name: 'Agent Performance',
      url: `${BASE_URL}/api/analytics/agents`,
      method: 'GET'
    },
    {
      name: 'Lead Scoring Analytics',
      url: `${BASE_URL}/api/analytics/leads?start=${dateRange.start}&end=${dateRange.end}`,
      method: 'GET'
    },
    {
      name: 'Conversation Analytics',
      url: `${BASE_URL}/api/analytics/conversations?start=${dateRange.start}&end=${dateRange.end}`,
      method: 'GET'
    },
    {
      name: 'System Health',
      url: `${BASE_URL}/api/analytics/system`,
      method: 'GET'
    },
    {
      name: 'Real-time Metrics',
      url: `${BASE_URL}/api/analytics/realtime`,
      method: 'GET'
    }
  ];

  for (const test of tests) {
    try {
      console.log(`🔍 Testing ${test.name}...`);
      const response = await axios({
        method: test.method,
        url: test.url,
        headers
      });

      if (response.data.success) {
        console.log(`✅ ${test.name}: SUCCESS`);
        console.log(`   Data keys: ${Object.keys(response.data.data || {}).join(', ')}`);
        console.log(`   Response time: ${response.headers['x-response-time'] || 'N/A'}ms\n`);
      } else {
        console.log(`❌ ${test.name}: FAILED - ${response.data.error}\n`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Error: ${error.response.data?.error || 'Unknown error'}\n`);
      } else {
        console.log(`   Network error: ${error.message}\n`);
      }
    }
  }

  // Test export functionality
  console.log('🔍 Testing Export Functionality...');
  try {
    const response = await axios({
      method: 'GET',
      url: `${BASE_URL}/api/analytics/export?type=overview&start=${dateRange.start}&end=${dateRange.end}`,
      headers: {
        ...headers,
        'Accept': 'text/csv'
      }
    });

    if (response.status === 200) {
      console.log('✅ Export: SUCCESS');
      console.log(`   Content-Type: ${response.headers['content-type']}`);
      console.log(`   Content-Length: ${response.data.length} bytes\n`);
    } else {
      console.log('❌ Export: FAILED\n');
    }
  } catch (error) {
    console.log(`❌ Export: ERROR - ${error.message}\n`);
  }

  console.log('🏁 Analytics API testing completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAnalyticsEndpoints().catch(console.error);
}

module.exports = { testAnalyticsEndpoints };
