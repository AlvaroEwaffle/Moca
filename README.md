# 🚀 **Moca - Instagram DM Agent**

[![GitHub](https://img.shields.io/badge/GitHub-Moca-blue?style=flat&logo=github)](https://github.com/AlvaroEwaffle/Moca)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue?style=flat&logo=react)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-green?style=flat&logo=mongodb)](https://www.mongodb.com/)

**Moca** is an intelligent Instagram DM agent that handles lead communication automatically, preventing spam, consolidating messages, and providing a professional back office for team management. Built on a solid foundation with AI-powered responses and comprehensive analytics.

## 🌟 **Features**

### **🤖 AI-Powered Communication**
- **Intelligent Response Generation**: OpenAI-powered responses with context awareness
- **Intent Analysis**: Automatic detection of user intentions and sentiment
- **Multi-language Support**: Spanish and English with automatic language detection
- **Fallback Responses**: Rule-based responses when AI is unavailable

### **📱 Instagram Integration**
- **Webhook Processing**: Real-time message reception from Meta
- **Rate Limiting**: Instagram API compliance with intelligent throttling
- **Message Consolidation**: Debouncing rapid messages to prevent spam
- **Attachment Support**: Images, videos, and files with captions

### **💼 Lead Management**
- **Contact Database**: Comprehensive contact profiles with business information
- **Conversation Tracking**: Full conversation history with context
- **Lead Qualification**: AI-powered lead scoring and categorization
- **Business Intelligence**: Sector analysis, budget tracking, and timeline management

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

**Built with ❤️ by the Moca Team**

Transform your Instagram business communication with intelligent automation and AI-powered responses. Moca makes managing Instagram DMs effortless and professional. 