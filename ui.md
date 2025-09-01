# 🎨 **Moca Frontend UI Plan - Instagram DM Agent**

## 📋 **Overview**

This plan outlines the transformation of the current healthcare frontend into a minimal, focused Instagram DM Agent management interface. We'll keep user registration, simplify onboarding, replace Google Calendar with Instagram integration, and create a clean dashboard for managing Instagram conversations.

---

## 🎯 **Core Requirements**

### **✅ Keep (Minimal Changes)**
- **User Registration/Login**: Keep existing auth system
- **UI Components**: Use existing shadcn/ui components
- **Layout Structure**: Maintain MainLayout.tsx
- **Routing**: Keep React Router setup

### **🔄 Transform (Major Changes)**
- **Onboarding**: 3 simple questions → Instagram setup
- **Google Calendar** → **Instagram Login/Token Management**
- **Dashboard**: Healthcare metrics → Instagram conversation metrics
- **Navigation**: Medical features → Instagram management features

### **🗑️ Remove (Unused)**
- All healthcare-specific pages (appointments, patients, billing)
- Medical terminology and icons
- Healthcare-specific components

---

## 🏗️ **New Page Structure**

### **📁 Pages Directory**
```
frontend/src/pages/
├── auth/
│   ├── Login.tsx ✅ (keep)
│   ├── Register.tsx ✅ (keep)
│   └── Onboarding.tsx 🔄 (transform to 3 questions)
├── dashboard/
│   └── Dashboard.tsx 🔄 (Instagram metrics)
├── conversations/
│   ├── ConversationsList.tsx 🆕 (main conversations view)
│   ├── ConversationDetail.tsx 🆕 (individual conversation)
│   └── SendMessage.tsx 🆕 (manual message sending)
├── instagram/
│   ├── InstagramSetup.tsx 🆕 (Instagram account connection)
│   ├── InstagramAccounts.tsx 🆕 (manage multiple accounts)
│   └── InstagramSettings.tsx 🆕 (account settings)
├── system/
│   ├── QueueStatus.tsx 🆕 (outbound queue monitoring)
│   ├── SystemLogs.tsx 🆕 (system health & logs)
│   └── Settings.tsx 🆕 (global settings)
├── Error.tsx ✅ (keep)
├── Index.tsx ✅ (keep)
├── Landing.tsx ✅ (keep)
└── NotFound.tsx ✅ (keep)
```

---

## 🎨 **UI Components to Keep (Minimal)**

### **✅ Essential Components**
```typescript
// Core UI Components
- Button, Input, Label, Card, Badge
- Dialog, Sheet, Tabs, Table
- Select, Switch, Textarea
- Toast, Skeleton, Separator
- Avatar, Progress, Alert

// Layout Components  
- MainLayout.tsx (modified)
- Navigation (simplified)

// Hooks
- use-toast.ts
- use-mobile.tsx
```

### **🗑️ Remove Unused Components**
```typescript
// Healthcare-specific (remove)
- MercadoPagoButton.tsx
- PremiumResult.tsx
- PremiumResultLoader.tsx
- Calendar components (replace with Instagram)
- All appointment/patient/billing pages
```

---

## 🔄 **Transformation Details**

### **1. Onboarding.tsx - 3 Simple Questions**

**Current**: 4-step healthcare setup (working hours, consultation types, billing, reminders)

**New**: 3-step Instagram setup
```typescript
// Step 1: Business Information
- Business name
- Business type/industry
- Primary language

// Step 2: Instagram Account Connection
- Instagram account login
- Token generation
- Account verification

// Step 3: Agent Behavior (System Prompt)
- How should the agent respond?
- Tone of voice (professional, friendly, casual)
- Key information to include
```

**UI Changes**:
- Replace medical icons with Instagram/business icons
- Simplify form fields
- Add Instagram OAuth flow
- System prompt textarea

### **2. Dashboard.tsx - Instagram Metrics**

**Current**: Healthcare metrics (patients, appointments, billing)

**New**: Instagram conversation metrics
```typescript
// Key Metrics Cards
- Total Conversations (active, closed, archived)
- Messages Today (received, sent, pending)
- Response Rate (auto vs manual)
- Queue Status (pending, processing, failed)

// Recent Activity
- Latest conversations
- Recent messages
- System alerts
- Queue status
```

**UI Changes**:
- Replace medical icons with Instagram icons
- Update color scheme (blue → Instagram purple/pink)
- Change terminology (patients → contacts, appointments → conversations)

### **3. Instagram Integration Pages**

**InstagramSetup.tsx**:
```typescript
// Instagram OAuth Flow
- Connect Instagram Business Account
- Generate access tokens
- Verify webhook setup
- Test message sending
```

**InstagramAccounts.tsx**:
```typescript
// Multiple Account Management
- List all connected accounts
- Add new accounts
- Edit account settings
- Remove accounts
- Test connections
```

**InstagramSettings.tsx**:
```typescript
// Account-specific Settings
- Response templates
- Business hours
- Auto-response rules
- Rate limiting
- Webhook configuration
```

### **4. Conversation Management**

**ConversationsList.tsx**:
```typescript
// Main Conversations View
- Filter by status (new, active, closed)
- Search by contact name/message
- Sort by date, priority, status
- Bulk actions (mark as read, close, assign)
```

**ConversationDetail.tsx**:
```typescript
// Individual Conversation View
- Message history (timeline)
- Contact information
- Send manual response
- Conversation actions (close, archive, assign)
- AI response suggestions
```

**SendMessage.tsx**:
```typescript
// Manual Message Sending
- Select conversation
- Message composer
- Attachments support
- Send options (immediate, scheduled)
```

### **5. System Monitoring**

**QueueStatus.tsx**:
```typescript
// Outbound Queue Monitoring
- Queue statistics (pending, processing, sent, failed)
- Failed message retry
- Rate limit status
- Processing time metrics
```

**SystemLogs.tsx**:
```typescript
// System Health & Logs
- Recent system events
- Error logs
- Performance metrics
- API connection status
```

---

## 🎨 **Design System Updates**

### **Color Scheme**
```css
/* Current: Medical Blue */
--primary: #3b82f6 (blue-500)
--secondary: #64748b (slate-500)

/* New: Instagram Purple/Pink */
--primary: #8b5cf6 (violet-500)
--secondary: #ec4899 (pink-500)
--accent: #f59e0b (amber-500)
```

### **Icons & Imagery**
```typescript
// Replace Medical Icons
- Calendar → MessageSquare
- Users → Users (contacts)
- DollarSign → TrendingUp (metrics)
- Clock → Activity (system status)
- Stethoscope → Instagram (brand)

// Add Instagram-specific Icons
- MessageCircle, Send, Bot, Settings
- AlertCircle, CheckCircle, XCircle
- BarChart3, PieChart, Activity
```

### **Typography & Spacing**
```css
/* Keep existing typography scale */
/* Update terminology */
- "Pacientes" → "Contactos"
- "Citas" → "Conversaciones" 
- "Facturación" → "Métricas"
- "Doctor" → "Agente"
```

---

## 🚀 **Implementation Phases**

### **Phase 1: Core Transformation (Week 1)**
1. **Update Onboarding**: 3-question Instagram setup
2. **Transform Dashboard**: Instagram metrics and recent activity
3. **Create Instagram Setup**: OAuth flow and account connection
4. **Update Navigation**: Remove medical links, add Instagram links

### **Phase 2: Conversation Management (Week 2)**
1. **ConversationsList**: Main conversations view with filtering
2. **ConversationDetail**: Individual conversation management
3. **SendMessage**: Manual message sending interface
4. **Real-time Updates**: WebSocket integration for live updates

### **Phase 3: System Monitoring (Week 3)**
1. **QueueStatus**: Outbound queue monitoring
2. **SystemLogs**: System health and error tracking
3. **InstagramAccounts**: Multiple account management
4. **Settings**: Global and account-specific settings

### **Phase 4: Polish & Optimization (Week 4)**
1. **UI Polish**: Final design refinements
2. **Performance**: Optimize API calls and rendering
3. **Testing**: End-to-end testing
4. **Documentation**: User guides and API docs

---

## 📱 **Responsive Design**

### **Mobile-First Approach**
```typescript
// Mobile Layout (< 768px)
- Single column layout
- Collapsible navigation
- Touch-friendly buttons
- Swipe gestures for conversations

// Tablet Layout (768px - 1024px)
- Two-column layout
- Sidebar navigation
- Optimized for touch

// Desktop Layout (> 1024px)
- Multi-column layout
- Full sidebar
- Keyboard shortcuts
- Drag & drop support
```

---

## 🔧 **Technical Implementation**

### **API Integration**
```typescript
// New API Endpoints to Integrate
- GET /api/instagram/conversations
- GET /api/instagram/conversations/:id
- POST /api/instagram/conversations/:id/messages
- GET /api/instagram/queue/status
- GET /api/instagram/accounts
- POST /api/instagram/accounts
- GET /api/instagram/system/logs
```

### **State Management**
```typescript
// Context/State Structure
- ConversationsContext (conversations, filters, pagination)
- InstagramContext (accounts, settings, connection status)
- SystemContext (queue status, logs, alerts)
- UserContext (user info, preferences)
```

### **Real-time Updates**
```typescript
// WebSocket Integration
- New message notifications
- Queue status updates
- System alerts
- Connection status changes
```

---

## 🎯 **Success Metrics**

### **User Experience**
- **Setup Time**: < 5 minutes from registration to first conversation
- **Response Time**: < 2 seconds for conversation loading
- **Mobile Usage**: 80%+ mobile-friendly interface
- **Error Rate**: < 1% UI errors

### **Functionality**
- **Instagram Integration**: 100% successful account connections
- **Message Delivery**: 95%+ successful manual message sending
- **Real-time Updates**: < 1 second delay for new messages
- **System Monitoring**: 100% visibility into queue and system status

---

## 🚀 **Next Steps**

1. **Review this plan** and provide feedback
2. **Start with Phase 1**: Core transformation
3. **Create component library**: Reusable Instagram-specific components
4. **Implement API integration**: Connect to existing backend endpoints
5. **Test thoroughly**: Ensure all functionality works end-to-end

---

**🎉 This plan transforms Moca into a clean, focused Instagram DM Agent management interface while keeping the robust foundation of the existing frontend architecture.**
