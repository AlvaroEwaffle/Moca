# 🎯 **Leads Follow Up Feature - Implementation Plan**

## 📋 **Overview**
Automated lead follow-up system that runs 3 times per day via cron jobs to nurture and convert leads through personalized follow-up sequences.

## 🎯 **Core Concept**
- **Cron Job**: Runs 3 times daily (morning, afternoon, evening)
- **Lead Identification**: Automatically identifies leads based on lead score and conversation status
- **Follow-up Sequences**: Personalized messages based on lead stage and time since last interaction
- **Conversion Tracking**: Monitors follow-up effectiveness and conversion rates

## 🏗️ **System Architecture**

### **1. Lead Follow-up Worker Service**
```typescript
// backend/src/services/followUpWorker.service.ts
class FollowUpWorkerService {
  // Main cron job handler
  async processFollowUps(): Promise<void>
  
  // Lead identification and filtering
  async getLeadsForFollowUp(): Promise<Lead[]>
  
  // Follow-up sequence logic
  async processLeadFollowUp(lead: Lead): Promise<void>
  
  // Message personalization
  async generateFollowUpMessage(lead: Lead, sequence: FollowUpSequence): Promise<string>
  
  // Send follow-up message
  async sendFollowUpMessage(lead: Lead, message: string): Promise<void>
}
```

### **2. Follow-up Configuration Model**
```typescript
// backend/src/models/followUpConfig.model.ts
interface IFollowUpConfig {
  userId: string;
  accountId: string;
  enabled: boolean;
  sequences: FollowUpSequence[];
  globalSettings: GlobalFollowUpSettings;
  createdAt: Date;
  updatedAt: Date;
}

interface FollowUpSequence {
  id: string;
  name: string;
  triggerConditions: TriggerCondition[];
  messages: FollowUpMessage[];
  isActive: boolean;
  priority: number;
}

interface FollowUpMessage {
  id: string;
  delayHours: number; // Hours after trigger condition
  messageTemplate: string;
  messageType: 'text' | 'image' | 'video';
  mediaUrl?: string;
  isActive: boolean;
}
```

### **3. Lead Follow-up Tracking Model**
```typescript
// backend/src/models/leadFollowUp.model.ts
interface ILeadFollowUp {
  leadId: string;
  conversationId: string;
  accountId: string;
  userId: string;
  sequenceId: string;
  messageId: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'converted';
  scheduledAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  convertedAt?: Date;
  followUpCount: number;
  lastFollowUpAt?: Date;
  nextFollowUpAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

## 🔄 **Follow-up Logic Flow**

### **1. Lead Identification Criteria**
- **Lead Score**: 2-6 (qualified but not converted)
- **Last Activity**: No response in last 24 hours
- **Follow-up Count**: Less than maximum allowed (e.g., 5 follow-ups)
- **Time Since Last Follow-up**: Respects minimum interval (e.g., 24 hours)


3. **Personalization**
   - Dynamic content insertion
   - Lead-specific data integration
   - A/B testing for messages

1. **Performance Tracking**
   - Follow-up effectiveness metrics
   - Conversion rate analysis
   - Response time tracking


## 📊 **Analytics & Metrics**

### **Key Performance Indicators**
- **Follow-up Response Rate**: % of leads that respond to follow-ups
- **Conversion Rate**: % of leads that convert after follow-up
- **Time to Conversion**: Average time from first follow-up to conversion
- **Follow-up Effectiveness**: Which sequences work best
- **Optimal Timing**: Best times to send follow-ups

### **Dashboard Metrics** To add in existing Analytics page.
- Total follow-ups sent today
- Follow-up response rate
- Conversion rate by sequence
- Top performing follow-up messages
- Lead progression through sequences

## 🔧 **Technical Requirements**

### **Cron Job Configuration**
```typescript
// Run at 9 AM, 2 PM, and 6 PM local time
const cronSchedule = '0 9,14,18 * * *'; // 3 times daily
```

### **Rate Limiting**
- **Instagram API**: Respect rate limits (200 messages/hour)
- **Queue Management**: Process follow-ups in batches
- **Error Handling**: Retry failed follow-ups with exponential backoff

### **Scalability Considerations**
- **Batch Processing**: Process leads in batches of 50-100
- **Queue System**: Use Redis for follow-up queue management
- **Database Indexing**: Optimize queries for lead identification
- **Caching**: Cache follow-up configs and templates

## 🎨 **UI Components**

### **Follow-up Configuration Page**
- **Trigger Conditions**: Visual condition builder

### **Lead Follow-up Dashboard** To be added in the existing conversations page
- **Lead List**: Leads currently in follow-up sequences set a label.

## 🚀 **Success Metrics**

### **Short-term (1 month)**
- 80% of qualified leads receive follow-ups
- 25% response rate to follow-ups
- 15% conversion rate from follow-ups


## 🔒 **Security & Compliance**

### **Data Protection**
- **Lead Data Encryption**: Encrypt sensitive lead information
- **Access Control**: Role-based access to follow-up features
- **Audit Logs**: Track all follow-up activities
- **GDPR Compliance**: Respect opt-out requests

### **Rate Limiting & Spam Prevention**
- **Daily Limits**: Maximum follow-ups per lead per day
- **Sequence Limits**: Maximum follow-ups per sequence
- **Opt-out Handling**: Immediate stop on opt-out requests
- **Spam Detection**: Monitor for spam-like behavior

## 📝 **Next Steps**

1. **Review and Approve Plan**: Confirm feature scope and priorities
2. **Create Detailed Technical Specs**: Detailed implementation requirements
3. **Set up Development Environment**: Prepare for development
4. **Begin Phase 1 Implementation**: Start with core infrastructure
5. **Test and Iterate**: Continuous testing and improvement

---

**Created**: 2025-01-17  
**Status**: Planning Phase  
**Priority**: High  
**Estimated Timeline**: 3 weeks  
**Team**: Backend + Frontend + DevOps
