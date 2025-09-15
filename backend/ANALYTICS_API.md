# Analytics API Documentation

## Overview

The Analytics API provides comprehensive insights into chatbot performance, lead scoring, and system health. All endpoints require authentication via Bearer token.

## Base URL
```
http://localhost:3002/api/analytics
```

## Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Overview Metrics
Get high-level system metrics for a date range.

**GET** `/overview`

**Query Parameters:**
- `start` (required): Start date in ISO format (e.g., `2024-01-01T00:00:00.000Z`)
- `end` (required): End date in ISO format (e.g., `2024-01-31T23:59:59.999Z`)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalConversations": 150,
    "activeConversations": 25,
    "averageLeadScore": 3.2,
    "responseSuccessRate": 95.5,
    "milestoneAchievementRate": 78.3,
    "totalMessages": 1250,
    "averageResponseTime": 1.8,
    "agentDisablementRate": 12.5
  }
}
```

### 2. Agent Performance
Get performance metrics for all agents or a specific account.

**GET** `/agents`

**Query Parameters:**
- `accountId` (optional): Filter by specific Instagram account ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "accountId": "account_123",
      "accountName": "My Business Account",
      "totalConversations": 45,
      "averageLeadScore": 3.8,
      "responseCount": 120,
      "errorCount": 3,
      "averageResponseTime": 1.5,
      "successRate": 97.5,
      "agentDisabledCount": 2,
      "milestoneAchievedCount": 8
    }
  ]
}
```

### 3. Lead Scoring Analytics
Get detailed lead scoring distribution and progression metrics.

**GET** `/leads`

**Query Parameters:**
- `start` (required): Start date in ISO format
- `end` (required): End date in ISO format

**Response:**
```json
{
  "success": true,
  "data": {
    "scoreDistribution": [
      {
        "score": 1,
        "count": 25,
        "percentage": 16.7,
        "stepName": "Contact Received"
      },
      {
        "score": 2,
        "count": 30,
        "percentage": 20.0,
        "stepName": "Answers 1 Question"
      }
    ],
    "averageScore": 3.2,
    "progressionRate": 65.0,
    "topPerformingScores": [
      {
        "score": 4,
        "stepName": "Milestone Met",
        "count": 15
      }
    ]
  }
}
```

### 4. Conversation Analytics
Get conversation trends and patterns.

**GET** `/conversations`

**Query Parameters:**
- `start` (required): Start date in ISO format
- `end` (required): End date in ISO format

**Response:**
```json
{
  "success": true,
  "data": {
    "totalConversations": 150,
    "conversationsByStatus": [
      {
        "status": "open",
        "count": 25,
        "percentage": 16.7
      },
      {
        "status": "closed",
        "count": 125,
        "percentage": 83.3
      }
    ],
    "averageConversationLength": 8.3,
    "averageMessagesPerConversation": 12.5,
    "conversationsByDay": [
      {
        "date": "2024-01-15",
        "count": 5
      }
    ],
    "peakActivityHours": [
      {
        "hour": 14,
        "count": 8
      }
    ]
  }
}
```

### 5. System Health
Get overall system health and configuration status.

**GET** `/system`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAccounts": 5,
    "activeAccounts": 4,
    "totalContacts": 250,
    "totalMessages": 1250,
    "averageProcessingTime": 1.8,
    "errorRate": 2.5,
    "queueStatus": {
      "pending": 0,
      "processing": 2,
      "completed": 1200,
      "failed": 5
    },
    "globalAgentConfig": {
      "responseLimitsEnabled": true,
      "leadScoreAutoDisableEnabled": true,
      "milestoneAutoDisableEnabled": true
    }
  }
}
```

### 6. Real-time Metrics
Get current system status and real-time metrics.

**GET** `/realtime`

**Response:**
```json
{
  "success": true,
  "data": {
    "activeConversations": 25,
    "messagesLastHour": 15,
    "averageResponseTime": 1.8,
    "systemUptime": 86400,
    "errorRate": 2.5,
    "queueStatus": {
      "pending": 0,
      "processing": 2
    }
  }
}
```

### 7. Data Export
Export analytics data in CSV format.

**GET** `/export`

**Query Parameters:**
- `type` (required): Export type (`overview`, `agents`, `leads`, `conversations`)
- `start` (required): Start date in ISO format
- `end` (required): End date in ISO format

**Response:** CSV file download

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (missing or invalid parameters)
- `401`: Unauthorized (missing or invalid token)
- `500`: Internal Server Error

## Rate Limiting

The analytics API has the following rate limits:
- 100 requests per minute per user
- 1000 requests per hour per user

## Performance Considerations

1. **Date Range**: Limit date ranges to reasonable periods (e.g., 30 days max) for optimal performance
2. **Caching**: Results are cached for 5 minutes to improve response times
3. **Indexing**: Database indexes are optimized for analytics queries
4. **Pagination**: Large result sets are automatically paginated

## Testing

Use the provided test scripts to verify API functionality:

```bash
# Test all endpoints
node test-analytics.js

# Performance testing
node test-analytics-performance.js

# Optimize database indexes
node optimize-analytics-indexes.js
```

## Data Models

### Lead Scoring Scale (1-7)
1. **Contact Received**: Initial contact from customer
2. **Answers 1 Question**: Customer responds to first question
3. **Confirms Interest**: Customer shows clear interest
4. **Milestone Met**: Specific milestone achieved
5. **Reminder Sent**: Follow-up reminder sent
6. **Reminder Answered**: Customer responds to reminder
7. **Sales Done**: Sale completed successfully

### Conversation Status
- `open`: Active conversation
- `scheduled`: Scheduled for follow-up
- `closed`: Conversation ended
- `archived`: Archived conversation

## Monitoring

Monitor the following metrics for optimal performance:
- Response times should be < 2 seconds
- Error rates should be < 5%
- Database query performance
- Memory usage during aggregation

## Troubleshooting

### Common Issues

1. **Slow Response Times**
   - Check database indexes
   - Reduce date range
   - Monitor database performance

2. **Authentication Errors**
   - Verify JWT token is valid
   - Check token expiration
   - Ensure proper Authorization header format

3. **Data Inconsistencies**
   - Verify data integrity
   - Check for missing required fields
   - Validate date ranges

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=analytics:*
```

This will provide detailed logging for troubleshooting analytics queries and performance issues.
