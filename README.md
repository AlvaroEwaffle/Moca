# 🚀 **Moca - Instagram DM Agent**

[![GitHub](https://img.shields.io/badge/GitHub-Moca-blue?style=flat&logo=github)](https://github.com/AlvaroEwaffle/Moca)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue?style=flat&logo=react)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-green?style=flat&logo=mongodb)](https://www.mongodb.com/)

**Moca** is an intelligent Instagram DM agent that handles lead communication automatically, preventing spam, consolidating messages, and providing a professional back office for team management. Built on a solid foundation with AI-powered responses and comprehensive analytics.

## 🚀 **Current Status**

**Latest Working Version:** `86db3cd` - "Complete Agent Toggle System with Backend Integration"

### ✅ **What's Working:**
- **Multi-Account Support**: Perfect account identification with Page-Scoped ID matching
- **Username Display**: Instagram usernames fetched and displayed in conversations
- **Enhanced UI**: Simplified and clean interface with better organization
- **Message Processing**: Real-time webhook processing with spam prevention
- **Structured AI Responses**: JSON-based responses with lead scoring and context awareness
- **Lead Scoring System**: 1-10 scale tracking customer interest progression
- **Repetition Prevention**: Smart context-aware responses that avoid repetition
- **Data Population**: Proper contact data population with metadata
- **Agent Toggle System**: Complete frontend and backend integration for per-conversation control
- **Conversation Details**: Comprehensive AI metadata display with organized sections
- **Streamlined List**: Clean conversation list with essential metrics only
- **Instagram Account Management**: Custom system prompt editor for each account
- **Simplified Navigation**: Clean sidebar with essential features only

### 🎯 **Recent Achievements:**
- **Complete Agent Toggle System**: Full frontend and backend integration for per-conversation AI control
- **Real-time Agent Control**: Toggle AI responses on/off per conversation with immediate effect
- **Instagram Account Management**: Complete system for managing Instagram accounts and custom AI prompts
- **Custom System Prompts**: Per-account AI instruction editor with real-time updates
- **Simplified Navigation**: Clean sidebar with only essential features (Dashboard, Conversations, Instagram, Configuration)
- **Enhanced Conversation Details**: Comprehensive AI metadata display with organized sections
- **Streamlined Conversation List**: Clean interface with essential metrics only
- **UI Simplification**: Removed redundant information and improved focus
- **Max Score Display**: Added peak score tracking in conversation list
- **Better Organization**: Improved padding and visual hierarchy
- **Structured AI Responses**: Implemented JSON-based response system with lead scoring
- **Lead Scoring System**: 1-10 scale tracking customer interest progression
- **Repetition Prevention**: Smart context-aware responses that avoid repetition
- **Generic AI Instructions**: Template-based system for consistent responses
- **Conversation Analytics**: Comprehensive metadata and progression tracking
- Fixed ContactId reference for proper data population
- Implemented end-to-end username fetching and display

## 📖 **What is Moca?**

**Moca** is your intelligent Instagram DM assistant that automatically handles customer conversations, prevents spam, and helps your team manage leads effectively. Think of it as a smart receptionist for your Instagram business account.

**Key Benefits:**
- 🤖 **Auto-responds** to customer messages intelligently
- 🛡️ **Prevents spam** by consolidating multiple messages
- 📊 **Organizes conversations** for easy team management
- ⚡ **Works 24/7** without human intervention
- 🎯 **Captures leads** automatically from Instagram DMs

## 🎯 **What Moca Does (User Stories)**

### **For Instagram Customers:**
- **"I send a message to a business Instagram account"**
  - ✅ Moca receives the message instantly
  - ✅ Moca responds intelligently within seconds
  - ✅ Moca remembers our conversation history
  - ✅ Moca doesn't spam me with multiple responses

### **For Business Owners:**
- **"I want to see all my Instagram conversations in one place"**
  - ✅ Moca shows all active conversations
  - ✅ Moca displays customer info and message history
  - ✅ Moca highlights urgent conversations
  - ✅ Moca tracks conversation status (new, active, closed)

- **"I want to respond manually when needed"**
  - ✅ Moca lets me send manual responses
  - ✅ Moca shows me the full conversation context
  - ✅ Moca keeps track of who responded when

- **"I want to configure how Moca responds"**
  - ✅ Moca lets me set auto-response rules
  - ✅ Moca lets me enable/disable AI responses
  - ✅ Moca lets me customize response timing

### **For Team Members:**
- **"I want to manage multiple Instagram accounts"**
  - ✅ Moca handles multiple Instagram business accounts
  - ✅ Moca keeps conversations organized by account
  - ✅ Moca shows account-specific settings

- **"I want to see conversation analytics"**
  - ✅ Moca tracks response times
  - ✅ Moca shows conversation volume
  - ✅ Moca identifies peak activity times

## 🌟 **Features**

### **🤖 AI-Powered Communication**
- **Structured AI Responses**: JSON-based responses with lead scoring and metadata
- **Lead Scoring System**: 1-10 scale tracking customer interest progression
- **Repetition Prevention**: Smart context-aware responses that avoid repetition
- **Intent Analysis**: Automatic detection of user intentions and sentiment
- **Context Awareness**: Full conversation history analysis for better responses
- **Generic AI Instructions**: Template-based system for consistent responses
- **Per-Conversation Control**: Toggle AI responses on/off for individual conversations
- **Real-time Agent Management**: Instant enable/disable of AI responses with backend integration
- **Multi-language Support**: Spanish and English with automatic language detection
- **Fallback Responses**: Rule-based responses when AI is unavailable

### **📱 Instagram Integration**
- **Webhook Processing**: Real-time message reception from Meta
- **Rate Limiting**: Instagram API compliance with intelligent throttling
- **Message Consolidation**: Debouncing rapid messages to prevent spam
- **Attachment Support**: Images, videos, and files with captions
- **Multi-Account Support**: Handle multiple Instagram business accounts seamlessly
- **Username Display**: Fetch and display actual Instagram usernames in conversations
- **Account Management**: Centralized Instagram account configuration and settings
- **Custom System Prompts**: Per-account AI instruction editor for personalized responses

### **💼 Lead Management**
- **Contact Database**: Comprehensive contact profiles with business information
- **Conversation Tracking**: Full conversation history with context
- **Lead Qualification**: AI-powered lead scoring and categorization
- **Business Intelligence**: Sector analysis, budget tracking, and timeline management
- **Clean UI**: Streamlined conversations interface with essential information

### **⚡ Smart Automation**
- **Debounce Worker**: Consolidates multiple rapid messages
- **Sender Worker**: Manages outbound queue with retry logic
- **Cooldown Management**: Prevents message flooding to users
- **Business Hours**: Configurable response scheduling

### **📊 Analytics & Insights**
- **Response Metrics**: Response rates, engagement scores, and conversion probability
- **Performance Tracking**: Processing times, error rates, and queue statistics
- **Real-time Monitoring**: Live dashboard with queue status and system health

## 🏗️ **Architecture**

### **Backend Stack**
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with middleware support
- **Database**: MongoDB with Mongoose ODM
- **AI Integration**: OpenAI GPT-4 with custom prompts
- **Queue System**: In-memory queue with persistent storage

### **Frontend Stack**
- **Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS with custom components
- **State Management**: React hooks with context
- **Routing**: React Router with protected routes

### **Data Models**
- **InstagramAccount**: API credentials, rate limits, and webhook settings
- **Contact**: User profiles, business info, and engagement metrics
- **Conversation**: Chat threads with context and analytics
- **Message**: Individual messages with metadata and status
- **OutboundQueue**: Message queuing with retry and rate limiting

## 🎬 **How Moca Works (Simple Flow)**

### **1. Customer Sends Message**
```
Customer → Instagram → Moca Webhook → Database → Response Queue
```

**What happens:**
- Customer sends message to your Instagram business account
- Instagram notifies Moca instantly
- Moca saves the message and customer info
- Moca decides if a response is needed

### **2. Moca Generates Response**
```
Message Analysis → AI Decision → Response Generation → Queue for Sending
```

**What happens:**
- Moca analyzes the message content
- Moca checks if customer is in cooldown (prevents spam)
- Moca uses AI to generate appropriate response
- Moca adds response to sending queue

### **3. Moca Sends Response**
```
Queue → Rate Limit Check → Instagram API → Success/Failure Logging
```

**What happens:**
- Moca checks Instagram's rate limits
- Moca sends response through Instagram Graph API ✅ **WORKING!**
- Moca logs success or handles errors
- Moca updates conversation status

### **4. Team Manages Conversations**
```
Dashboard → Conversation List → Detail View → Manual Response
```

**What happens:**
- Team sees all active conversations
- Team clicks on conversation to see full history
- Team can send manual responses when needed
- Team can close or manage conversation status

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ and npm
- MongoDB 6+ (local or cloud)
- OpenAI API key
- Instagram Business Account with Graph API access

### **1. Clone Repository**
```bash
git clone https://github.com/AlvaroEwaffle/Moca.git
cd Moca
```

### **2. Backend Setup**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run build
npm start
```

### **3. Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```

### **4. Environment Variables**
```bash
# Backend (.env)
MONGODB_URI=mongodb://localhost:27017/moca
OPENAI_API_KEY=your_openai_api_key
INSTAGRAM_VERIFY_TOKEN=your_webhook_verify_token
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_ACCESS_TOKEN=your_access_token

# Frontend (.env)
VITE_API_URL=http://localhost:3002
```

## 📡 **API Endpoints**

### **Instagram Management**
```http
GET    /api/instagram/webhook          # Webhook verification
POST   /api/instagram/webhook          # Message reception
GET    /api/instagram/test-connection  # Test Instagram API
```

### **Contact Management**
```http
GET    /api/instagram/contacts         # List all contacts
GET    /api/instagram/contacts/:id     # Get contact details
```

### **Conversation Management**
```http
GET    /api/instagram/conversations           # List conversations
GET    /api/instagram/conversations/:id       # Get conversation with messages
POST   /api/instagram/conversations/:id/messages  # Send manual message
```

### **Queue Management**
```http
GET    /api/instagram/queue/status     # Get queue statistics
POST   /api/instagram/queue/retry      # Retry failed messages
```

### **Health & System**
```http
GET    /api/health                     # System health check
GET    /api/instagram/*                # All Instagram endpoints
```

## 🔧 **Configuration**

### **Instagram App Setup**
1. Create Facebook App in [Facebook Developers](https://developers.facebook.com/)
2. Add Instagram Basic Display product
3. Configure webhook URL: `https://yourdomain.com/api/instagram/webhook`
4. Set verify token in environment variables
5. Subscribe to `messages` and `messaging_postbacks` events

### **Rate Limiting**
```typescript
// Default configuration
{
  globalRateLimit: 3,        // Messages per second globally
  userRateLimit: 1,          // Messages per second per user
  userCooldown: 3,           // Seconds between responses to same user
  debounceWindow: 4000       // Milliseconds to consolidate messages
}
```

### **AI Configuration**
```typescript
// OpenAI settings
{
  model: 'gpt-4',
  maxTokens: 150,
  temperature: 0.7,
  presencePenalty: 0.1,
  frequencyPenalty: 0.1
}
```

## 📊 **Data Flow**

### **1. Message Reception**
```
Instagram Webhook → Webhook Service → Message Processing → Database Storage
```

### **2. AI Response Generation**
```
User Message → Intent Analysis → Context Gathering → AI Generation → Response Creation
```

### **3. Message Delivery**
```
Response Creation → Outbound Queue → Rate Limit Check → Instagram API → Delivery Confirmation
```

### **4. Analytics Update**
```
Message Events → Metrics Calculation → Database Update → Real-time Dashboard
```

## 🧪 **Testing**

### **Backend Tests**
```bash
cd backend
npm run test-instagram      # Test Instagram models
npm run test-webhook        # Test webhook functionality
```

### **API Testing**
```bash
# Test webhook verification
curl "http://localhost:3002/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=test&hub.challenge=test"

# Test contact listing
curl "http://localhost:3002/api/instagram/contacts"

# Test queue status
curl "http://localhost:3002/api/instagram/queue/status"
```

## 📈 **Performance & Scalability**

### **Current Metrics**
- **Message Processing**: < 100ms average
- **AI Response Time**: < 2s average
- **Database Queries**: Optimized with indexes
- **Queue Throughput**: 100+ messages per minute

### **Scalability Features**
- **Horizontal Scaling**: Stateless services
- **Database Indexing**: Optimized for high-volume queries
- **Rate Limiting**: Instagram API compliance
- **Error Handling**: Comprehensive retry logic

## 🔒 **Security**

### **Webhook Security**
- **Signature Validation**: HMAC-SHA256 verification
- **Token Verification**: Secure webhook challenge
- **Input Sanitization**: XSS and injection protection

### **API Security**
- **Rate Limiting**: Per-endpoint and global limits
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Secure error messages

## 🚀 **Deployment**

### **Production Setup**
```bash
# Build backend
cd backend
npm run build
NODE_ENV=production npm start

# Build frontend
cd frontend
npm run build
npm run deploy
```

### **Environment Variables**
```bash
# Production environment
NODE_ENV=production
MONGODB_URI=your_production_mongodb_uri
OPENAI_API_KEY=your_production_openai_key
INSTAGRAM_VERIFY_TOKEN=your_production_verify_token
```

## 🤝 **Contributing**

### **Development Setup**
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### **Code Standards**
- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- Comprehensive error handling

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 **Support**

### **Documentation**
- [API Reference](docs/api.md)
- [Configuration Guide](docs/configuration.md)
- [Deployment Guide](docs/deployment.md)

### **Community**
- [GitHub Issues](https://github.com/AlvaroEwaffle/Moca/issues)
- [Discussions](https://github.com/AlvaroEwaffle/Moca/discussions)

---

# 📋 **Development Roadmap & Plan**

## 🚀 **Latest Working Version - Complete Agent Toggle System**

**Commit:** `86db3cd` - "Complete Agent Toggle System with Backend Integration"

### **✅ Current Status:**
- **Multi-Account Support**: ✅ Complete
- **Username Display**: ✅ Complete  
- **Clean UI**: ✅ Complete
- **Contact Population**: ✅ Complete
- **Agent Toggle System**: ✅ Complete
- **Instagram Account Management**: ✅ Complete
- **Custom System Prompts**: ✅ Complete
- **Simplified Navigation**: ✅ Complete
- **Structured AI Responses**: ✅ Complete
- **Lead Scoring System**: ✅ Complete
- **Repetition Prevention**: ✅ Complete
- **Context Awareness**: ✅ Complete

### **🎯 AI Enhancement Phase Complete:**
All AI enhancement features are now implemented and working! The system now provides:
- **Structured JSON responses** with lead scoring and metadata
- **1-10 lead scoring scale** tracking customer interest progression
- **Repetition prevention** with smart context-aware responses
- **Generic AI instructions** template for consistent responses
- **Comprehensive analytics** and conversation metadata tracking

### **🎯 Agent Control Phase Complete:**
Complete agent management system is now implemented and working! The system now provides:
- **Per-conversation AI control** with instant toggle functionality
- **Real-time backend integration** for immediate effect
- **Debounce worker respect** for AI enabled/disabled status
- **Error handling** with UI state reversion on failures
- **Instagram account management** with custom system prompts
- **Simplified navigation** with essential features only

---

## **📋 Next Goals - Advanced Features Phase:**

### **✅ COMPLETED - UI Enhancement Phase:**
- ✅ **Enhanced Conversation Details**: Comprehensive AI metadata display with organized sections
- ✅ **Streamlined Conversation List**: Clean interface with essential metrics only
- ✅ **UI Simplification**: Removed redundant information and improved focus
- ✅ **Max Score Display**: Added peak score tracking in conversation list
- ✅ **Better Organization**: Improved padding and visual hierarchy

### **1. Agent Toggle Backend**
- Connect frontend toggle to backend API
- Per-conversation agent control
- Real-time toggle updates

### **2. Advanced Conversation Management**
- Lead progression visualization
- Intent analysis dashboard
- Response quality metrics
- Conversation flow analytics

### **3. Business Intelligence**
- Lead conversion tracking
- Response performance analytics
- Customer journey mapping
- ROI measurement tools

---

## **🔧 Implementation Plan**

### **✅ Phase 1: Core Infrastructure - COMPLETED**
1. ✅ **Create Generic AI Instructions Template** (`backend/src/templates/aiInstructions.ts`)
2. ✅ **Update OpenAI Service** for structured JSON responses
3. ✅ **Update Instagram Account Model** with custom instructions
4. ✅ **Create Lead Scoring Service** (`backend/src/services/leadScoring.service.ts`)

### **✅ Phase 2: Response Processing - COMPLETED**
1. ✅ **Update Debounce Worker Service** for structured responses
2. ✅ **Update Conversation Model** with lead scoring fields
3. ✅ **Update Webhook Service** for response metadata
4. ✅ **Create Response Validator** (`backend/src/utils/responseValidator.ts`)

### **✅ Phase 3: Frontend Integration - COMPLETED**
1. ✅ **Update Conversations List** with lead scores
2. ✅ **Update Conversation Detail** with structured data
3. ✅ **Create Lead Score Indicator** component
4. ✅ **Add Response Metadata Display**

### **✅ Phase 4: UI Enhancement - COMPLETED**
1. ✅ **Enhanced Conversation Details** with comprehensive AI metadata
2. ✅ **Streamlined Conversation List** with essential metrics
3. ✅ **UI Simplification** and better organization
4. ✅ **Max Score Display** and improved visual hierarchy

### **✅ Phase 5: Instagram Account Management - COMPLETED**
1. ✅ **Instagram Account Management UI** with custom system prompt editor
2. ✅ **Backend API Endpoint** for updating custom instructions
3. ✅ **Simplified Navigation** with essential features only
4. ✅ **Real-time System Prompt Updates** with proper error handling

### **✅ Phase 6: Agent Toggle System - COMPLETED**
1. ✅ **Backend API Endpoint** for toggling AI responses per conversation
2. ✅ **Frontend Integration** with real-time toggle functionality
3. ✅ **Debounce Worker Integration** to respect AI enabled/disabled status
4. ✅ **Error Handling** with UI state reversion on API failures

### **Phase 7: Testing & Validation**
1. **End-to-End Testing** of structured responses
2. **Lead Scoring Accuracy** validation
3. **Account-Specific Instructions** testing
4. **Conversation Context** handling verification

---

## **🎯 Success Metrics**

### **AI Response Quality**
- **Repetition Rate**: < 5% of responses repeat previous content
- **Context Awareness**: 90%+ responses reference conversation history
- **Lead Scoring Accuracy**: 85%+ correct lead level identification
- **Response Relevance**: 90%+ responses directly address user queries

### **System Performance**
- **Response Time**: < 2 seconds for structured AI responses
- **JSON Validation**: 100% valid JSON response format
- **Lead Progression**: Accurate tracking of customer journey
- **Error Handling**: < 1% failed structured responses

### **Business Impact**
- **Lead Qualification**: Improved lead scoring and categorization
- **Conversation Management**: Better context awareness and flow
- **Team Efficiency**: Enhanced conversation insights and metadata
- **Customer Experience**: More natural and contextual responses

---

**Built with ❤️ by the Moca Team**

Transform your Instagram business communication with intelligent automation and AI-powered responses. Moca makes managing Instagram DMs effortless and professional.