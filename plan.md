# 🚀 **Moca - Instagram DM Agent Implementation Plan**

## 📋 **Project Overview**

**Moca** is an Instagram DM agent that handles lead communication intelligently, preventing spam, consolidating messages, and providing a back office for team management. The system centralizes all logic in a backend with database, eliminating external dependencies.

**Key Goal**: Transform the existing Tiare healthcare system into an Instagram DM management platform while preserving the existing architecture.

---

## 🎯 **Core Requirements Analysis**

### **A) Message Reception (Incoming)**
- ✅ Receive messages from Meta webhook (Instagram Graph API)
- ✅ Respond 200 OK immediately to prevent Meta retries
- ✅ Save messages to database (conversations, leads, history)
- ✅ Apply deduplication by `mid` (unique Meta message ID)
- ✅ Apply debounce (consolidate 2-3 messages sent in few seconds)
- ✅ Verify cooldown (no bot response if replied within 7s)

### **B) Message Processing**
- ✅ Evaluate if response is needed (rules + AI decision)
- ✅ Generate response (AI Agent or backend rules)
- ✅ Save planned response to outbound queue

### **C) Response Sending (Outgoing)**
- ✅ Manage outbound queue
- ✅ Respect global rate limits (max 3 messages/second)
- ✅ Respect user locks (PSID) to prevent interleaved responses
- ✅ Apply retry with backoff for 429/613 errors
- ✅ Log sent responses in message history

### **D) Contact & Conversation Management**
- ✅ Each PSID saved as contact with enriched info
- ✅ Active conversation with state (open, scheduled, closed)
- ✅ Timestamps tracking (last_user_at, last_bot_at, cooldown_until)
- ✅ Search, list, and filter conversations from back office

### **E) Back Office (Minimal Features)**
- ✅ Conversations list: view open contacts and last interaction
- ✅ Conversation view: message timeline + manual message input
- ✅ Configuration panel: edit basic parameters
- ✅ Simple authentication (x-admin-token)

---

## 🏗️ **Architecture Transformation Plan**

### **Phase 1: Backend Infrastructure (Week 1-2)** ✅ **READY**
- **Status**: Existing Tiare backend structure is perfect for this transformation
- **Actions**: 
  - Preserve existing Express.js + TypeScript + MongoDB architecture
  - Reuse authentication middleware and database models
  - Adapt existing services for Instagram DM functionality

### **Phase 2: Data Model Adaptation (Week 2-3)**
- **Transform existing models**:
  - `Doctor` → `InstagramAccount` (token, settings, rate limits)
  - `Patient` → `Contact` (PSID, name, sector, email)
  - `Appointment` → `Conversation` (state, timestamps, cooldown)
  - `Billing` → `Message` (incoming/outgoing, AI responses)
  - `EventLog` → `OutboundQueue` (pending messages, retry logic)

### **Phase 3: Instagram API Integration (Week 3-4)**
- **Webhook endpoint**: `/api/instagram/webhook`
- **Message sending**: `/api/instagram/messages`
- **Rate limiting**: Global and per-user pacing
- **Error handling**: 429/613 retry with exponential backoff

### **Phase 4: AI Agent Integration (Week 4-5)**
- **Reuse existing OpenAI service** from Tiare
- **Decision logic**: When to respond, what to say
- **Response generation**: Context-aware message creation
- **Fallback rules**: Simple backend rules when AI unavailable

### **Phase 5: Back Office Development (Week 5-6)**
- **Transform existing Tiare frontend**:
  - Dashboard → Conversations Overview
  - Patients → Contacts Management
  - Appointments → Conversation Timeline
  - Billing → Message Queue Management

### **Phase 6: Testing & Optimization (Week 6-7)**
- **Integration testing**: Instagram API, webhook handling
- **Performance testing**: Rate limiting, queue management
- **Security testing**: Authentication, input validation
- **User acceptance testing**: Back office usability

---

## 🔄 **System Flow Implementation**

### **1. Incoming Message Flow**
```
Instagram Webhook → Backend (200 OK) → Database Upsert → Debounce Worker
```

**Implementation**:
- **Route**: `POST /api/instagram/webhook`
- **Middleware**: Rate limiting, validation, immediate response
- **Service**: `instagramWebhook.service.ts`
- **Database**: Upsert contact + conversation + message

### **2. Debounce Worker**
```
Timer (3-4s) → Message Consolidation → Cooldown Check → AI Decision → Queue
```

**Implementation**:
- **Service**: `debounceWorker.service.ts`
- **Logic**: Consolidate messages by PSID, check cooldown, generate response
- **Output**: Add to outbound queue if response needed

### **3. Sender Worker**
```
Queue Check (250ms) → Rate Limit Check → Instagram API → Update Status
```

**Implementation**:
- **Service**: `senderWorker.service.ts`
- **Rate Limiting**: Global pacing, user locks, retry logic
- **API Calls**: Instagram Graph API with error handling

### **4. Back Office Flow**
```
Admin Login → Conversations List → Conversation Detail → Manual Message → Queue
```

**Implementation**:
- **Routes**: Protected admin endpoints
- **UI**: React components for conversation management
- **Real-time**: WebSocket updates for live conversation view

---

## 📊 **Data Model Transformation**

### **InstagramAccount Model** (from Doctor)
```typescript
interface InstagramAccount {
  id: string;
  accountId: string;           // Instagram account ID
  accessToken: string;         // Instagram Graph API token
  refreshToken?: string;       // For token refresh
  tokenExpiry: Date;          // Token expiration
  rateLimits: {
    messagesPerSecond: number; // Global rate limit
    userCooldown: number;      // Seconds between responses to same user
    debounceWindow: number;    // Seconds to consolidate messages
  };
  settings: {
    autoRespond: boolean;      // Enable/disable auto-responses
    aiEnabled: boolean;        // Use AI for responses
    fallbackRules: string[];   // Simple response rules
  };
}
```

### **Contact Model** (from Patient)
```typescript
interface Contact {
  id: string;
  psid: string;               // Instagram PSID (unique)
  name?: string;              // Display name
  sector?: string;            // Business sector
  email?: string;             // Contact email
  metadata: {
    firstSeen: Date;          // First interaction
    lastSeen: Date;           // Last interaction
    messageCount: number;     // Total messages
    responseCount: number;    // Bot responses sent
  };
  tags: string[];             // Custom tags for categorization
}
```

### **Conversation Model** (from Appointment)
```typescript
interface Conversation {
  id: string;
  contactId: string;          // Reference to Contact
  accountId: string;          // Reference to InstagramAccount
  status: 'open' | 'scheduled' | 'closed';
  timestamps: {
    createdAt: Date;          // Conversation start
    lastUserMessage: Date;    // Last user message
    lastBotMessage: Date;     // Last bot response
    cooldownUntil: Date;      // When bot can respond again
  };
  context: {
    topic?: string;           // Conversation topic
    intent?: string;          // User intent
    sentiment?: 'positive' | 'neutral' | 'negative';
  };
}
```

### **Message Model** (from Billing)
```typescript
interface Message {
  id: string;
  mid: string;                // Meta message ID (unique)
  conversationId: string;     // Reference to Conversation
  role: 'user' | 'assistant' | 'system';
  content: string;            // Message text
  metadata: {
    timestamp: Date;          // Message timestamp
    isConsolidated: boolean;  // Multiple messages merged
    originalMids: string[];   // Original message IDs if consolidated
    aiGenerated: boolean;     // Generated by AI or rules
  };
  status: 'received' | 'queued' | 'sent' | 'failed';
}
```

### **OutboundQueue Model** (from EventLog)
```typescript
interface OutboundQueue {
  id: string;
  messageId: string;          // Reference to Message
  conversationId: string;     // Reference to Conversation
  priority: 'high' | 'normal' | 'low';
  scheduledFor: Date;        // When to send
  retryCount: number;        // Number of retry attempts
  lastAttempt: Date;         // Last attempt timestamp
  status: 'pending' | 'processing' | 'sent' | 'failed';
  errorDetails?: {
    code: string;             // Instagram API error code
    message: string;          // Error description
    retryAfter?: Date;        // When to retry
  };
}
```

---

## 🛠️ **Implementation Details**

### **Backend Services to Create/Adapt**

#### **1. Instagram Webhook Service**
```typescript
// src/services/instagramWebhook.service.ts
class InstagramWebhookService {
  async handleWebhook(payload: MetaWebhookPayload): Promise<void>
  async validateSignature(payload: string, signature: string): Promise<boolean>
  async processMessage(message: InstagramMessage): Promise<void>
  async upsertContact(psid: string, message: InstagramMessage): Promise<Contact>
  async createConversation(contactId: string): Promise<Conversation>
}
```

#### **2. Debounce Worker Service**
```typescript
// src/services/debounceWorker.service.ts
class DebounceWorkerService {
  async processDebouncedMessages(): Promise<void>
  async consolidateMessages(psid: string, windowMs: number): Promise<string>
  async checkCooldown(conversationId: string): Promise<boolean>
  async generateResponse(conversationId: string): Promise<string>
  async queueResponse(conversationId: string, response: string): Promise<void>
}
```

#### **3. Sender Worker Service**
```typescript
// src/services/senderWorker.service.ts
class SenderWorkerService {
  async processOutboundQueue(): Promise<void>
  async sendMessage(messageId: string): Promise<boolean>
  async handleRateLimitError(error: InstagramError): Promise<void>
  async applyBackoff(messageId: string, retryCount: number): Promise<void>
  async updateMessageStatus(messageId: string, status: string): Promise<void>
}
```

#### **4. Instagram API Service**
```typescript
// src/services/instagramApi.service.ts
class InstagramApiService {
  async sendMessage(psid: string, message: string): Promise<InstagramResponse>
  async refreshToken(accountId: string): Promise<void>
  async validateToken(accountId: string): Promise<boolean>
  async getAccountInfo(accountId: string): Promise<InstagramAccountInfo>
}
```

### **Frontend Components to Create/Adapt**

#### **1. Conversations Dashboard**
```typescript
// src/pages/conversations/ConversationsDashboard.tsx
// Transform existing Dashboard.tsx
interface ConversationsDashboard {
  conversations: Conversation[];
  stats: {
    totalContacts: number;
    activeConversations: number;
    pendingResponses: number;
    messagesToday: number;
  };
  filters: {
    status: string;
    dateRange: DateRange;
    tags: string[];
  };
}
```

#### **2. Conversation Detail View**
```typescript
// src/pages/conversations/ConversationDetail.tsx
// Transform existing AppointmentsPage.tsx
interface ConversationDetail {
  conversation: Conversation;
  messages: Message[];
  contact: Contact;
  sendManualMessage: (content: string) => Promise<void>;
  updateStatus: (status: string) => Promise<void>;
}
```

#### **3. Settings Panel**
```typescript
// src/pages/settings/InstagramSettings.tsx
// Transform existing billing interface
interface InstagramSettings {
  account: InstagramAccount;
  rateLimits: RateLimitSettings;
  aiSettings: AIConfiguration;
  webhookSettings: WebhookConfiguration;
}
```

---

## 🔒 **Security & Authentication**

### **Admin Authentication**
- **Method**: Simple token-based auth (x-admin-token header)
- **Implementation**: Reuse existing auth middleware
- **Security**: Environment variable for admin token
- **Rate Limiting**: Prevent brute force attacks

### **Webhook Security**
- **Signature Validation**: Verify Meta webhook signatures
- **IP Whitelisting**: Only accept from Meta IP ranges
- **Token Validation**: Validate Instagram access tokens

### **Data Protection**
- **Input Sanitization**: Clean all incoming messages
- **SQL Injection Prevention**: Use Mongoose properly
- **Rate Limiting**: Prevent abuse of all endpoints

---

## 📱 **Instagram API Integration**

### **Webhook Configuration**
```typescript
// Webhook endpoint: /api/instagram/webhook
// Meta verification: GET /api/instagram/webhook?hub.mode=subscribe&hub.challenge=...
// Message reception: POST /api/instagram/webhook
```

### **Message Sending**
```typescript
// Instagram Graph API: /me/messages
// Rate limits: 250 messages per user per day
// Response time: 24-hour window for responses
```

### **Error Handling**
```typescript
// 429: Rate limit exceeded → exponential backoff
// 613: User limit exceeded → wait until next day
// 100: Invalid parameter → log and skip
// 190: Invalid token → refresh token
```

---

## 🧪 **Testing Strategy**

### **Unit Tests**
- **Services**: InstagramWebhook, DebounceWorker, SenderWorker
- **Models**: Data validation and relationships
- **Utilities**: Rate limiting, debouncing, cooldown logic

### **Integration Tests**
- **Webhook Flow**: End-to-end message processing
- **API Integration**: Instagram Graph API calls
- **Database Operations**: CRUD operations and relationships

### **Performance Tests**
- **Rate Limiting**: Verify pacing and cooldown
- **Queue Processing**: Outbound message handling
- **Database Performance**: Large conversation volumes

### **Security Tests**
- **Webhook Validation**: Signature verification
- **Authentication**: Admin token validation
- **Input Validation**: Message content sanitization

---

## 🚀 **Deployment & DevOps**

### **Environment Variables**
```bash
# Instagram Configuration
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_VERIFY_TOKEN=your_webhook_verify_token
INSTAGRAM_ACCESS_TOKEN=your_access_token

# Admin Authentication
ADMIN_TOKEN=your_admin_token

# Rate Limiting
GLOBAL_RATE_LIMIT=3
USER_COOLDOWN_SECONDS=3
DEBOUNCE_WINDOW_MS=4000

# AI Configuration
OPENAI_API_KEY=your_openai_key
AI_ENABLED=true
```

### **Monitoring & Logging**
- **Webhook Logs**: All incoming messages and processing
- **Queue Monitoring**: Outbound message status and retries
- **Rate Limit Tracking**: API usage and limits
- **Error Tracking**: Failed messages and retry attempts

---

## 📅 **Timeline & Milestones**

### **Week 1-2: Backend Infrastructure** 🏗️
- [ ] Adapt existing Tiare models for Instagram functionality
- [ ] Create Instagram webhook endpoint
- [ ] Implement basic message reception and storage
- [ ] Set up Instagram API service

### **Week 3-4: Core Logic Implementation** ⚙️
- [ ] Implement debounce worker service
- [ ] Implement sender worker service
- [ ] Add rate limiting and cooldown logic
- [ ] Integrate AI response generation

### **Week 5-6: Frontend Development** 🎨
- [ ] Transform existing Tiare UI for conversation management
- [ ] Create conversations dashboard
- [ ] Implement conversation detail view
- [ ] Add settings and configuration panels

### **Week 7: Testing & Deployment** 🧪
- [ ] Comprehensive testing suite
- [ ] Performance optimization
- [ ] Security audit
- [ ] Production deployment

---

## 🎯 **Success Criteria**

### **Functional Requirements**
- ✅ **Message Deduplication**: No duplicate responses to same `mid`
- ✅ **Debounce Logic**: Multiple messages in <4s consolidated
- ✅ **Cooldown System**: Prevents spam (2 messages in 5s → 1 response)
- ✅ **Rate Limiting**: Respects Instagram API limits (<5 msgs/sec)
- ✅ **Retry Logic**: Handles 429/613 errors with backoff
- ✅ **Back Office**: List, view, manual send, configure

### **Performance Requirements**
- **Response Time**: Webhook response <100ms
- **Processing**: Message processing <5s
- **Queue**: Outbound queue processing <1s
- **Database**: Query response <100ms

### **Security Requirements**
- **Webhook Validation**: 100% signature verification
- **Authentication**: Secure admin access
- **Input Sanitization**: All messages cleaned
- **Rate Limiting**: Prevent abuse

---

## 🔄 **Migration Strategy**

### **Preserve Existing Structure**
- **Keep**: Express.js, TypeScript, MongoDB, authentication
- **Adapt**: Models, services, routes for Instagram functionality
- **Transform**: Frontend components for conversation management
- **Maintain**: Code quality, testing, deployment patterns

### **Gradual Transition**
1. **Phase 1**: Add Instagram functionality alongside existing features
2. **Phase 2**: Gradually replace healthcare features with DM management
3. **Phase 3**: Remove unused healthcare code
4. **Phase 4**: Optimize and polish Instagram DM system

---

## 💡 **Innovation Opportunities**

### **AI Enhancement**
- **Smart Routing**: Route conversations to human agents when needed
- **Sentiment Analysis**: Detect user mood and adjust responses
- **Intent Recognition**: Understand user goals and provide relevant info
- **Multi-language Support**: Handle conversations in different languages

### **Advanced Features**
- **Automated Follow-ups**: Schedule reminder messages
- **Lead Scoring**: Prioritize high-value conversations
- **Integration APIs**: Connect with CRM and marketing tools
- **Analytics Dashboard**: Conversation insights and metrics

---

**🎉 This plan transforms the existing Tiare healthcare system into a powerful Instagram DM management platform while preserving the solid architecture and development practices already established.**
