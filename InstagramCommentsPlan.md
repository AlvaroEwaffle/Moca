# Instagram Comments Implementation Plan

## 🎯 **Overview**
Implement Instagram comment handling system with configurable fixed responses using Instagram Graph API v23.0.

## 📋 **Current Status**
- **API Version**: Instagram Graph API v23.0
- **Approach**: Instagram Access Token (no Page Access Token required)
- **Focus**: Fixed comment replies and DM messages (no AI)
- **Phase**: Planning & Documentation

## 🔧 **API Endpoints (v23.0)**

### **1. Reply to Comment**
```typescript
POST https://graph.instagram.com/v23.0/{comment-id}/replies
```
- **Purpose**: Reply to a public comment on a post
- **Comment ID**: From webhook payload
- **Result**: Creates a public reply under the comment

### **2. Get Media Details (Optional)**
```typescript
GET https://graph.instagram.com/v23.0/{media-id}?fields=caption,owner,username
```
- **Purpose**: Get post caption and context (for future AI integration)
- **Media ID**: From comment webhook payload
- **Result**: Media caption, owner info, username
- **Note**: Not needed for fixed responses, but available for future use

### **3. Send DM**
```typescript
POST https://graph.instagram.com/v23.0/{IG_ID}/messages
```
- **Purpose**: Send new DM to user after comment reply
- **IG_ID**: Instagram Business Account ID
- **User ID**: Instagram user ID from comment webhook (`comment.from.id`)
- **Note**: This creates a new DM conversation

## 🏗️ **Implementation Phases**

### **Phase 1: Basic Comment Webhook Setup** 🚀

#### **1.1 Update OAuth Scopes**
```typescript
// In instagramOAuth.routes.ts
const authUrl = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights`;
```

#### **1.2 Create Comment Model**
```typescript
// backend/src/models/instagramComment.model.ts
export interface IInstagramComment extends Document {
  commentId: string;
  accountId: string;
  mediaId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: Date;
  status: 'pending' | 'replied' | 'failed';
  replyText?: string;
  replyTimestamp?: Date;
  dmSent?: boolean;
  dmTimestamp?: Date;
}
```

#### **1.3 Update Webhook Handler**
```typescript
// In instagramWebhook.service.ts
// Add comment webhook processing
if (entry.changes) {
  for (const change of entry.changes) {
    if (change.field === 'comments') {
      await this.processCommentWebhook(change);
    }
  }
}
```

### **Phase 2: Comment Processing Service** 🔧

#### **2.1 Update InstagramAccount Model**
```typescript
// Add to instagramAccount.model.ts
commentSettings: {
  enabled: boolean;
  autoReplyComment: boolean;
  autoReplyDM: boolean;
  commentMessage: string;  // Fixed comment reply
  dmMessage: string;       // Fixed DM message
  replyDelay: number;      // Delay in seconds
}
```

#### **2.2 Comment Service (Fixed Responses)**
```typescript
// backend/src/services/instagramComment.service.ts
export class InstagramCommentService {
  async processComment(comment: any, accountId: string) {
    const account = await InstagramAccount.findById(accountId);
    
    if (!account.commentSettings.enabled) return;
    
    // 1. Save comment to database
    const commentDoc = new InstagramComment({
      commentId: comment.id,
      accountId,
      mediaId: comment.media_id,
      userId: comment.from.id,
      username: comment.from.username,
      text: comment.text,
      timestamp: new Date(comment.timestamp),
      status: 'pending'
    });
    
    // 2. Reply to comment (if enabled)
    if (account.commentSettings.autoReplyComment) {
      await this.replyToComment(comment.id, account.commentSettings.commentMessage, accessToken);
      commentDoc.status = 'replied';
      commentDoc.replyText = account.commentSettings.commentMessage;
      commentDoc.replyTimestamp = new Date();
    }
    
    // 3. Send DM (if enabled)
    if (account.commentSettings.autoReplyDM) {
      await this.sendDMReply(comment.from.id, account.commentSettings.dmMessage, accessToken, accountId);
      commentDoc.dmSent = true;
      commentDoc.dmTimestamp = new Date();
    }
    
    await commentDoc.save();
  }

  async replyToComment(commentId: string, replyText: string, accessToken: string) {
    const response = await fetch(`https://graph.instagram.com/v23.0/${commentId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        message: replyText
      })
    });
    return await response.json();
  }

  async sendDMReply(userId: string, message: string, accessToken: string, accountId: string) {
    const response = await fetch(`https://graph.instagram.com/v23.0/${accountId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: {
          id: userId
        },
        message: {
          text: message
        }
      })
    });
    return await response.json();
  }
}
```

#### **2.3 Comment Worker (Simplified)**
```typescript
// backend/src/services/commentWorker.service.ts
export class CommentWorkerService {
  async processPendingComments() {
    const pendingComments = await InstagramComment.find({ status: 'pending' });
    
    for (const comment of pendingComments) {
      try {
        // Process comment with fixed responses
        await this.instagramCommentService.processComment(comment);
      } catch (error) {
        console.error('Error processing comment:', error);
        comment.status = 'failed';
        await comment.save();
      }
    }
  }
}
```

### **Phase 3: UI Configuration** 🎨

#### **3.1 Account Settings UI**
```typescript
// In InstagramAccounts.tsx
// Add comment settings section:
<div className="comment-settings">
  <h3>Comment Processing</h3>
  
  <div className="setting">
    <label>Enable Comment Processing</label>
    <input type="checkbox" checked={commentSettings.enabled} />
  </div>
  
  <div className="setting">
    <label>Auto Reply to Comments</label>
    <input type="checkbox" checked={commentSettings.autoReplyComment} />
  </div>
  
  <div className="setting">
    <label>Comment Reply Message</label>
    <textarea 
      value={commentSettings.commentMessage}
      placeholder="Thanks for your comment! 🙏"
    />
  </div>
  
  <div className="setting">
    <label>Send DM After Comment Reply</label>
    <input type="checkbox" checked={commentSettings.autoReplyDM} />
  </div>
  
  <div className="setting">
    <label>DM Message</label>
    <textarea 
      value={commentSettings.dmMessage}
      placeholder="Thanks for commenting! Feel free to DM me if you have any questions! 💬"
    />
  </div>
  
  <div className="setting">
    <label>Reply Delay (seconds)</label>
    <input type="number" value={commentSettings.replyDelay} min="0" max="300" />
  </div>
</div>
```

#### **3.2 Comment Management UI**
```typescript
// New page: CommentManagement.tsx
// Show pending comments
// Manual reply interface
// Comment analytics
// Fixed response preview
// Enable/disable per comment
```

### **Phase 4: API Endpoints** 🔌

#### **4.1 Comment Routes**
```typescript
// backend/src/routes/instagramComments.routes.ts
router.post('/webhook', processCommentWebhook);
router.get('/comments/:accountId', getComments);
router.post('/comments/:commentId/reply', replyToComment);
router.put('/settings/:accountId', updateCommentSettings);
router.get('/comments/:commentId/status', getCommentStatus);
```

### **Phase 5: Testing & Deployment** 🧪

#### **5.1 Test Comment Flow**
1. **Enable comment processing** for an account
2. **Configure fixed messages** in UI
3. **Post a test comment** on Instagram
4. **Verify webhook** receives the comment
5. **Check fixed reply** is posted to comment
6. **Verify DM** is sent to user
7. **Confirm database** records are updated

#### **5.2 Error Handling**
- **Rate limiting** compliance
- **Token expiration** handling
- **API error** recovery
- **Webhook validation**
- **Fixed response validation**

## 🔑 **Key Features**

### **Fixed Response System**
- Configurable comment reply messages
- Configurable DM messages
- No AI processing required
- Reliable and consistent responses

### **Comment Management**
- Store comments with reply status
- Track DM sending status
- Manual override capabilities

### **Configuration**
- Per-account comment settings
- Enable/disable features independently
- Custom message templates
- Reply delay controls

## 📊 **Data Flow**

1. **Comment Webhook** → Instagram sends comment data
2. **Check Settings** → Verify comment processing is enabled
3. **Fixed Reply** → Post configured reply message
4. **Fixed DM** → Send configured DM message
5. **Database Update** → Store comment and reply data

## 🚀 **Next Steps**

1. **Start Phase 1** - Basic webhook setup
2. **Implement Phase 2** - Comment processing with fixed responses
3. **Build Phase 3** - UI configuration
4. **Complete Phase 4** - API endpoints
5. **Test Phase 5** - Full integration

## 📝 **Notes**

- **No Page Access Token** required for Instagram API with Instagram Login
- **Fixed responses** are more reliable than AI-generated ones
- **v23.0 API** provides all necessary endpoints
- **Simple configuration** through UI
- **No AI processing** required for basic functionality
- **Error handling** is crucial for production stability
