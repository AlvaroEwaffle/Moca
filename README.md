# 🚀 **Moca - Instagram DM Agent**

[![GitHub](https://img.shields.io/badge/GitHub-Moca-blue?style=flat&logo=github)](https://github.com/AlvaroEwaffle/Moca)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue?style=flat&logo=react)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-green?style=flat&logo=mongodb)](https://www.mongodb.com/)

**Moca** is an intelligent Instagram DM agent that handles lead communication automatically, preventing spam, consolidating messages, and providing a professional back office for team management. Built on a solid foundation with modern web technologies.

## 🎯 **What Moca Does**

### **Smart Message Management**
- 🤖 **AI-Powered Responses**: Generate contextual replies using OpenAI
- ⚡ **Debounce Logic**: Consolidate multiple rapid messages into one
- 🚫 **Anti-Spam Protection**: Cooldown system prevents bot spam
- 📊 **Rate Limiting**: Respects Instagram API limits automatically

### **Professional Back Office**
- 👥 **Conversation Management**: View and manage all active conversations
- 💬 **Manual Override**: Send manual messages when needed
- ⚙️ **Configuration Panel**: Adjust settings, rate limits, and AI behavior
- 📈 **Analytics Dashboard**: Monitor performance and engagement

### **Instagram Integration**
- 🔗 **Webhook Handling**: Secure Meta webhook integration
- 📱 **Message Sending**: Instagram Graph API with error handling
- 🔄 **Token Management**: Automatic token refresh and validation
- 📋 **Queue Management**: Reliable outbound message processing

## 🏗️ **Architecture**

### **Backend Stack**
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with middleware architecture
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens with admin access
- **External APIs**: Instagram Graph API, OpenAI GPT

### **Frontend Stack**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with SWC optimization
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Query + React Hook Form
- **Routing**: React Router DOM with protected routes

### **Core Services**
- **Instagram Webhook Service**: Handle incoming messages
- **Debounce Worker**: Consolidate and process messages
- **Sender Worker**: Manage outbound queue and rate limits
- **AI Service**: Generate intelligent responses
- **Queue Management**: Handle retries and error recovery

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+
- MongoDB (local or Atlas)
- Instagram Business Account
- OpenAI API Key

### **Installation**

1. **Clone the repository**
```bash
git clone https://github.com/AlvaroEwaffle/Moca.git
cd Moca
```

2. **Install dependencies**
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. **Environment setup**
```bash
# Backend (.env)
cd backend
cp .env.example .env

# Configure your environment variables
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_ACCESS_TOKEN=your_access_token
OPENAI_API_KEY=your_openai_key
ADMIN_TOKEN=your_admin_token
```

4. **Start development servers**
```bash
# Backend (Port 3002)
cd backend
npm run dev

# Frontend (Port 8080)
cd ../frontend
npm run dev
```

## 📱 **Instagram Setup**

### **1. Create Instagram App**
- Go to [Meta for Developers](https://developers.facebook.com/)
- Create a new app with Instagram Basic Display
- Add Instagram Graph API permissions

### **2. Configure Webhook**
- Set webhook URL: `https://yourdomain.com/api/instagram/webhook`
- Verify token: Use your `INSTAGRAM_VERIFY_TOKEN`
- Subscribe to `messages` and `messaging_postbacks` events

### **3. Get Access Token**
- Generate Instagram Graph API access token
- Add to your environment variables
- Token refreshes every 60 days

## 🔧 **Configuration**

### **Rate Limiting**
```bash
GLOBAL_RATE_LIMIT=3          # Messages per second globally
USER_COOLDOWN_SECONDS=3      # Seconds between responses to same user
DEBOUNCE_WINDOW_MS=4000      # Milliseconds to consolidate messages
```

### **AI Settings**
```bash
AI_ENABLED=true              # Enable AI-generated responses
OPENAI_MODEL=gpt-4           # OpenAI model to use
MAX_TOKENS=150               # Maximum response length
```

### **Webhook Security**
```bash
INSTAGRAM_VERIFY_TOKEN=your_webhook_verify_token
WEBHOOK_SECRET=your_webhook_secret
```

## 📊 **API Endpoints**

### **Instagram Webhook**
```http
POST /api/instagram/webhook
```
Handles incoming Instagram messages and webhook verification.

### **Conversations**
```http
GET /api/conversations          # List all conversations
GET /api/conversations/:id      # Get conversation details
POST /api/conversations/:id/messages  # Send manual message
```

### **Contacts**
```http
GET /api/contacts               # List all contacts
GET /api/contacts/:id           # Get contact details
PUT /api/contacts/:id           # Update contact information
```

### **Settings**
```http
GET /api/settings               # Get current settings
PUT /api/settings               # Update settings
```

## 🎨 **Back Office Features**

### **Conversations Dashboard**
- 📋 **Active Conversations**: View all open conversations
- 🔍 **Search & Filter**: Find conversations by contact, status, or date
- 📊 **Statistics**: Total contacts, active conversations, response rates

### **Conversation Detail**
- 💬 **Message Timeline**: Complete conversation history
- ✏️ **Manual Response**: Send custom messages
- 🏷️ **Status Management**: Open, schedule, or close conversations
- 📝 **Notes & Tags**: Add context and categorization

### **Configuration Panel**
- ⚙️ **Instagram Settings**: API tokens and webhook configuration
- 🤖 **AI Configuration**: OpenAI settings and response rules
- 📏 **Rate Limits**: Adjust pacing and cooldown parameters
- 🔒 **Security**: Admin token and access control

## 🔄 **System Flow**

### **1. Message Reception**
```
Instagram Webhook → Backend (200 OK) → Database Storage → Debounce Worker
```

### **2. Message Processing**
```
Debounce Timer → Message Consolidation → Cooldown Check → AI Decision → Queue
```

### **3. Response Sending**
```
Queue Check → Rate Limit Check → Instagram API → Status Update
```

### **4. Back Office**
```
Admin Login → Conversations List → Conversation Detail → Manual Message → Queue
```

## 🧪 **Testing**

### **Run Tests**
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd ../frontend
npm test

# Integration tests
npm run test:integration
```

### **Test Coverage**
- **Unit Tests**: Services, models, utilities
- **Integration Tests**: API endpoints, database operations
- **E2E Tests**: Complete user workflows
- **Performance Tests**: Rate limiting and queue processing

## 🚀 **Deployment**

### **Environment Variables**
```bash
# Production
NODE_ENV=production
PORT=3002
MONGODB_URI=mongodb+srv://...

# Instagram
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_ACCESS_TOKEN=your_access_token

# Security
ADMIN_TOKEN=your_secure_admin_token
JWT_SECRET=your_jwt_secret
```

### **Deploy to Production**
```bash
# Build frontend
cd frontend
npm run build

# Deploy backend
cd ../backend
npm run build
npm start
```

## 📈 **Monitoring & Analytics**

### **Key Metrics**
- **Response Time**: Average time to respond to messages
- **Queue Performance**: Outbound message processing speed
- **Error Rates**: Failed messages and retry success rates
- **User Engagement**: Conversation duration and message frequency

### **Logging**
- **Webhook Logs**: All incoming message processing
- **Queue Monitoring**: Outbound message status and retries
- **Rate Limit Tracking**: API usage and limit management
- **Error Tracking**: Detailed error logs with context

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### **Development Guidelines**
- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation for new features
- Follow the existing code style

## 📄 **License**

This project is proprietary software developed for Moca Instagram DM Management.

## 🆘 **Support**

- **Documentation**: Check this README and the `plan.md` file
- **Issues**: Report bugs and feature requests on GitHub
- **Discussions**: Join the conversation in GitHub Discussions

## 🎉 **Acknowledgments**

Built on the solid foundation of the Tiare healthcare system, transformed into a powerful Instagram DM management platform.

---

**Built with ❤️ for Instagram business automation**

**Status: 🚀 Ready for Development** 