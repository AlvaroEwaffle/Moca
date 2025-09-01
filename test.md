# 🧪 **Moca Instagram DM Agent - Backend Testing Guide**

## 🌐 **Health & Status Tests**

### Health Check
```bash
# Local health check
curl -X GET "http://localhost:3002/api/health"

# Production health check
curl -X GET "https://moca-production.up.railway.app/api/health"
```

## 📱 **Instagram Webhook Tests**

### Webhook Verification (GET)
```bash
# Local webhook verification
curl -X GET "http://localhost:3002/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=villena&hub.challenge=CHALLENGE_ACCEPTED"



# Production webhook verification
curl -X GET "https://moca-production.up.railway.app/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=cataleya&hub.challenge=test_challenge_123"
```

### Webhook Message Reception (POST)
```bash
# Local webhook message reception (Direct Messages - Legacy Format)
curl -X POST "http://localhost:3002/api/instagram/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: YOUR_SIGNATURE" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "123456789",
      "time": 1234567890,
      "messaging": [{
        "sender": {"id": "USER_PSID"},
        "recipient": {"id": "PAGE_ID"},
        "timestamp": 1234567890,
        "message": {
          "mid": "MESSAGE_ID",
          "text": "Hello, this is a test message!"
        }
      }]
    }]
  }'

# Local webhook message reception (Direct Messages - New Format)
curl -X POST "http://localhost:3002/api/instagram/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: YOUR_SIGNATURE" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "123456789",
      "time": 1234567890,
      "messages": [{
        "sender": {"id": "USER_PSID"},
        "recipient": {"id": "PAGE_ID"},
        "timestamp": "1527459824",
        "message": {
          "mid": "MESSAGE_ID",
          "text": "Hello, this is a test message!"
        }
      }]
    }]
  }'

# Production webhook message reception (Direct Messages - Legacy Format)
curl -X POST "https://moca-production.up.railway.app/api/instagram/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: YOUR_SIGNATURE" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "123456789",
      "time": 1234567890,
      "messaging": [{
        "sender": {"id": "USER_PSID"},
        "recipient": {"id": "PAGE_ID"},
        "timestamp": 1234567890,
        "message": {
          "mid": "MESSAGE_ID",
          "text": "Hello, this is a test message!"
        }
      }]
    }]
  }'

# Production webhook message reception (Direct Messages - New Format)
curl -X POST "https://moca-production.up.railway.app/api/instagram/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: YOUR_SIGNATURE" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "123456789",
      "time": 1234567890,
      "messages": [{
        "sender": {"id": "USER_PSID"},
        "recipient": {"id": "PAGE_ID"},
        "timestamp": "1527459824",
        "message": {
          "mid": "MESSAGE_ID",
          "text": "Hello, this is a test message!"
        }
      }]
    }]
  }'

# Local webhook comment reception
curl -X POST "http://localhost:3002/api/instagram/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: YOUR_SIGNATURE" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "123456789",
      "time": 1234567890,
      "changes": [{
        "field": "comments",
        "value": {
          "from": {
            "id": "232323232",
            "username": "test_user"
          },
          "media": {
            "id": "123123123",
            "media_product_type": "FEED"
          },
          "id": "17865799348089039",
          "parent_id": "1231231234",
          "text": "This is a test comment!"
        }
      }]
    }]
  }'

# Production webhook comment reception
curl -X POST "https://moca-production.up.railway.app/api/instagram/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: YOUR_SIGNATURE" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "123456789",
      "time": 1234567890,
      "changes": [{
        "field": "comments",
        "value": {
          "from": {
            "id": "232323232",
            "username": "test_user"
          },
          "media": {
            "id": "123123123",
            "media_product_type": "FEED"
          },
          "id": "17865799348089039",
          "parent_id": "1231231234",
          "text": "This is a test comment!"
        }
      }]
    }]
  }'
```

## 👥 **Contact Management Tests**

### Get All Contacts
```bash
# Local - Get all contacts
curl -X GET "http://localhost:3002/api/instagram/contacts"

# Local - Get contacts with pagination
curl -X GET "http://localhost:3002/api/instagram/contacts?page=1&limit=10"

# Local - Search contacts
curl -X GET "http://localhost:3002/api/instagram/contacts?search=john"

# Production - Get all contacts
curl -X GET "https://moca-production.up.railway.app/api/instagram/contacts"
```

### Get Specific Contact
```bash
# Local - Get contact by ID
curl -X GET "http://localhost:3002/api/instagram/contacts/CONTACT_ID"

# Production - Get contact by ID
curl -X GET "https://moca-production.up.railway.app/api/instagram/contacts/CONTACT_ID"
```

## 💬 **Conversation Management Tests**

### Get All Conversations
```bash
# Local - Get all conversations
curl -X GET "http://localhost:3002/api/instagram/conversations"

# Local - Get conversations with filters
curl -X GET "http://localhost:3002/api/instagram/conversations?status=open&page=1&limit=10"

# Production - Get all conversations
curl -X GET "https://moca-production.up.railway.app/api/instagram/conversations"
```

### Get Specific Conversation with Messages
```bash
# Local - Get conversation with messages
curl -X GET "http://localhost:3002/api/instagram/conversations/CONVERSATION_ID"

# Production - Get conversation with messages
curl -X GET "https://moca-production.up.railway.app/api/instagram/conversations/CONVERSATION_ID"
```

### Send Manual Message
```bash
# Local - Send manual message
curl -X POST "http://localhost:3002/api/instagram/conversations/CONVERSATION_ID/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a manual test message from the API",
    "type": "text"
  }'

# Production - Send manual message
curl -X POST "https://moca-production.up.railway.app/api/instagram/conversations/CONVERSATION_ID/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a manual test message from the API",
    "type": "text"
  }'
```

## 📬 **Queue Management Tests**

### Get Queue Status
```bash
# Local - Get queue statistics
curl -X GET "http://localhost:3002/api/instagram/queue/status"

# Production - Get queue statistics
curl -X GET "https://moca-production.up.railway.app/api/instagram/queue/status"
```

### Retry Failed Messages
```bash
# Local - Retry failed messages
curl -X POST "http://localhost:3002/api/instagram/queue/retry"

# Production - Retry failed messages
curl -X POST "https://moca-production.up.railway.app/api/instagram/queue/retry"
```

## 🔧 **API Connection Tests**

### Test Instagram API Connection
```bash
# Local - Test Instagram API connection
curl -X GET "http://localhost:3002/api/instagram/test-connection"

# Production - Test Instagram API connection
curl -X GET "https://moca-production.up.railway.app/api/instagram/test-connection"
```

## 📊 **System Monitoring Tests**

### Get System Statistics
```bash
# Local - Get system stats
curl -X GET "http://localhost:3002/api/instagram/stats"

# Production - Get system stats
curl -X GET "https://moca-production.up.railway.app/api/instagram/stats"
```

## 📱 **Instagram Account Management**

### Create Instagram Account
```bash
# Local - Create Instagram account
curl -X POST "http://localhost:3002/api/instagram/accounts" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "your_instagram_account_id",
    "accessToken": "your_instagram_access_token",
    "refreshToken": "your_refresh_token_optional",
    "rateLimits": {
      "messagesPerSecond": 3,
      "userCooldown": 7,
      "debounceWindow": 4000
    },
    "settings": {
      "autoRespond": true,
      "aiEnabled": true,
      "fallbackRules": [
        "Thank you for your message! We will get back to you soon.",
        "Thanks for reaching out! Our team will respond shortly."
      ]
    }
  }'

# Production - Create Instagram account
curl -X POST "https://moca-production.up.railway.app/api/instagram/accounts" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "your_instagram_account_id",
    "accessToken": "your_instagram_access_token"
  }'
```

### Get All Instagram Accounts
```bash
# Local - Get all accounts
curl -X GET "http://localhost:3002/api/instagram/accounts"

# Production - Get all accounts
curl -X GET "https://moca-production.up.railway.app/api/instagram/accounts"
```

### Get Specific Instagram Account
```bash
# Local - Get specific account
curl -X GET "http://localhost:3002/api/instagram/accounts/your_instagram_account_id"

# Production - Get specific account
curl -X GET "https://moca-production.up.railway.app/api/instagram/accounts/your_instagram_account_id"
```

### Update Instagram Account
```bash
# Local - Update account settings
curl -X PUT "http://localhost:3002/api/instagram/accounts/your_instagram_account_id" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "autoRespond": false,
      "aiEnabled": true
    }
  }'

# Production - Update account settings
curl -X PUT "https://moca-production.up.railway.app/api/instagram/accounts/your_instagram_account_id" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "autoRespond": false,
      "aiEnabled": true
    }
  }'
```

### Delete Instagram Account
```bash
# Local - Delete account
curl -X DELETE "http://localhost:3002/api/instagram/accounts/your_instagram_account_id"

# Production - Delete account
curl -X DELETE "https://moca-production.up.railway.app/api/instagram/accounts/your_instagram_account_id"
```

## 🧪 **Test Scenarios**

### 1. **Basic Health Check**
```bash
# Test if the server is running
curl -X GET "http://localhost:3002/api/health" | jq
```

### 2. **Webhook Verification Test**
```bash
# Test webhook verification (replace with your actual verify token)
curl -X GET "http://localhost:3002/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=test_challenge"
```

### 3. **Simulate Incoming Message**
```bash
# Simulate an incoming Instagram message
curl -X POST "http://localhost:3002/api/instagram/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "123456789",
      "time": 1234567890,
      "messaging": [{
        "sender": {"id": "test_user_psid"},
        "recipient": {"id": "test_page_id"},
        "timestamp": 1234567890,
        "message": {
          "mid": "test_message_id",
          "text": "Hello! I need help with my website."
        }
      }]
    }]
  }'
```

### 3.5. **Simulate Incoming Comment**
```bash
# Simulate an incoming Instagram comment
curl -X POST "http://localhost:3002/api/instagram/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "123456789",
      "time": 1234567890,
      "changes": [{
        "field": "comments",
        "value": {
          "from": {
            "id": "232323232",
            "username": "test_user"
          },
          "media": {
            "id": "123123123",
            "media_product_type": "FEED"
          },
          "id": "17865799348089039",
          "parent_id": "1231231234",
          "text": "This is a test comment!"
        }
      }]
    }]
  }'
```

### 4. **Check Message Processing**
```bash
# Check if messages were processed
curl -X GET "http://localhost:3002/api/instagram/conversations" | jq
```

### 5. **Monitor Queue Status**
```bash
# Check queue status after message processing
curl -X GET "http://localhost:3002/api/instagram/queue/status" | jq
```

## 🔍 **Debugging Commands**

### Check Server Logs
```bash
# If running locally, check the console output for detailed logs
# Look for logs starting with:
# 🔧 InstagramApiService: 
# 🔄 DebounceWorkerService: 
# 📤 SenderWorkerService: 
# 📥 Instagram webhook: 
```

### Test Database Connection
```bash
# The health endpoint will show if MongoDB is connected
curl -X GET "http://localhost:3002/api/health" | jq '.database'
```

## 📝 **Environment Variables Required**

Make sure these environment variables are set:
```bash
MONGODB_URI=mongodb://localhost:27017/moca
OPENAI_API_KEY=your_openai_api_key
INSTAGRAM_VERIFY_TOKEN=your_verify_token
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_ACCESS_TOKEN=your_access_token
```

## 🚀 **Quick Test Sequence**

```bash
# 1. Health check
curl -X GET "http://localhost:3002/api/health"

# 2. Test webhook verification
curl -X GET "http://localhost:3002/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=test&hub.challenge=test"

# 3. Send test message
curl -X POST "http://localhost:3002/api/instagram/webhook" \
  -H "Content-Type: application/json" \
  -d '{"object":"instagram","entry":[{"id":"123","time":1234567890,"messaging":[{"sender":{"id":"test_user"},"recipient":{"id":"test_page"},"timestamp":1234567890,"message":{"mid":"test_msg","text":"Hello!"}}]}]}'

# 4. Check conversations
curl -X GET "http://localhost:3002/api/instagram/conversations"

# 5. Check queue status
curl -X GET "http://localhost:3002/api/instagram/queue/status"
```

## 📋 **Expected Responses**

### Health Check Response
```json
{
  "status": "OK",
  "timestamp": "2025-08-31T23:53:06.025Z",
  "service": "Moca Instagram DM Agent API",
  "version": "1.0.0"
}
```

### Webhook Verification Response
```
CHALLENGE_ACCEPTED
```

### Webhook Message Response
```
OK
```

### Conversations Response
```json
{
  "success": true,
  "data": {
    "conversations": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0
    }
  }
}
```



