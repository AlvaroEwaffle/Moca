# Capu Migration Analysis & Plan

## Executive Summary

**Goal:** Decouple the Gmail agent from Moca (Instagram bot) into a new standalone project **Capu**, maintaining the same UI look & feel but as separate systems.

**Current state:** Moca is a monolith with:
- Instagram DM bot (webhooks, comments, conversations, lead scoring, follow-ups)
- Gmail agent (fetch rules, draft generation, contact extraction)
- Shared: Auth, User, Contact, Conversation, Message models, UI components

---

## 1. Current Architecture Analysis

### 1.1 Backend - What Belongs Where

| Component | Moca (Instagram) | Capu (Gmail) | Shared/Copy |
|-----------|------------------|--------------|-------------|
| **Routes** | instagram.*, instagramOAuth, instagramComments, followUp, analytics | gmail.*, gmailAgent, gmailFetchRule, emailDraft, integrations, googleOAuth | auth, agents |
| **Models** | InstagramAccount, InstagramComment, CommentAutoReplyRule, KeywordActivationRule, LeadFollowUp, FollowUpConfig | GmailFetchRule, EmailDraftQueue, Integration | User, Contact, Conversation, Message, Agent |
| **Services** | instagramWebhook, instagramApi, instagramComment, debounceWorker, senderWorker, commentWorker, followUpWorker, globalAgentRules, leadScoring | gmailProcessor, gmail.service, gmailContactExtractor, gmailDraft, gmailFetchRule, emailDraftGeneration, emailDraftQueue, emailDraftWorker | openai, auth, agent |
| **Workers** | debounce, sender, comment, follow-up | gmailFetchRule, emailDraft | — |

### 1.2 Shared vs Distinct

**Shared concepts (polymorphic in current design):**
- **Contact** – has `channel: 'instagram' | 'gmail'`; Gmail uses `email`, Instagram uses `psid`
- **Conversation** – `accountId` points to InstagramAccount for IG, Integration for Gmail
- **Message** – used for both; `mid` format differs (`gmail_xxx` vs Meta IDs)
- **User** – same auth, same users can use both (or separate tenants)

**Key difference:** Gmail uses `Integration` (userId → Integration type=gmail). Instagram uses `InstagramAccount` (userId → InstagramAccount). The `accountId` in Conversation/Message is overloaded.

### 1.3 Frontend Structure

| Area | Moca Pages | Capu Pages |
|------|------------|------------|
| **Core** | Dashboard, Analytics | Dashboard (Gmail-focused) |
| **Channel** | Instagram (Agent Config, Conversations, Comments) | Gmail (Dashboard, Fetcher, Rules, Drafts) |
| **Shared** | MainLayout, Auth, Login, Register, Legal | Same layout, rebranded as "Capu" |
| **System** | QueueStatus, SystemLogs | Capu-specific (Gmail queue, logs) |

**UI components to reuse:** All `components/ui/*`, layout patterns, AuthContext, config.

---

## 2. Migration Strategy Options

### Option A: Full Split (Recommended)
- **Moca:** Only Instagram. Remove all Gmail code.
- **Capu:** New project, Gmail-only. Extract Gmail-related code.
- **Database:** Two options:
  - **A1 – Separate DBs:** Capu has its own MongoDB (`capu` database). Clean separation. Users must register separately (or SSO).

---

## 3. Recommended Migration Plan

### Phase 0: Preparation
- [ ] Create `/Capu` directory
- [ ] Initialize Capu backend (Express, TypeScript, same stack as Moca)
- [ ] Initialize Capu frontend (Vite, React, same stack)
- [ ] Document shared env vars (MONGODB_URI, JWT_SECRET, GOOGLE_*, OPENAI_*)

### Phase 1: Auth & User
- [ ] Copy auth routes, middleware, User model
- [ ] Copy AuthContext, Login, Register, Google OAuth callback
- [ ] Decide: same User DB (shared) or separate Capu users
- [ ] Branding: "Capu" instead of "Moca"

### Phase 2: Capu Backend – Gmail Core
- [ ] Copy models: Integration, GmailFetchRule, EmailDraftQueue, Contact (Gmail-only), Conversation, Message
- [ ] Copy routes: gmail, gmailFetchRule, emailDraft, integrations, googleOAuth, gmailAgent, agents
- [ ] Copy services: gmail.service, gmailProcessor, gmailContactExtractor, gmailDraft, gmailFetchRule, emailDraftGeneration, emailDraftQueue, integrationToken
- [ ] Copy workers: gmailFetchRuleWorker, emailDraftWorker
- [ ] Copy gmailAgent runner, tokenStore
- [ ] Strip Instagram references; use Integration as the primary "account"

### Phase 3: Capu Frontend
- [ ] Copy MainLayout, rebrand to Capu (logo, title, nav)
- [ ] Copy Gmail pages: GmailDashboard, GmailFetcher, GmailFetchRules, GmailFetchRuleForm, GmailDrafts, GmailDraftDetail
- [ ] Copy Gmail components: ExecutionLogsViewer, GenerateDraftButton
- [ ] Copy shared: components/ui, AuthContext, config, hooks
- [ ] Nav: Dashboard, Gmail (Rules, Drafts, Fetcher), Analytics (optional), Settings
- [ ] Remove Instagram nav, Conversations (or keep if Gmail has email threads as "conversations")

### Phase 4: Moca Cleanup
- [ ] Remove Gmail routes from Moca index
- [ ] Remove Gmail models (or keep with channel filter if shared DB)
- [ ] Remove Gmail services, workers
- [ ] Remove Gmail nav and pages from Moca frontend
- [ ] Remove ENABLE_GMAIL_AGENT flag
- [ ] Update CORS for Capu domain

### Phase 5: Database Strategy
- **If separate DB:** Capu uses `MONGODB_URI_CAPU` or `capu` database name
- **If shared DB:** Use `channel: 'gmail'` everywhere; Capu only queries Gmail data
- **User table:** Shared = same login for both. Separate = Capu has own User collection

### Phase 6: Deployment
- [ ] Capu backend: new port (e.g. 3003) or new service
- [ ] Capu frontend: capu.pages.dev or capu.ewaffle.cl
- [ ] Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY, MONGODB_URI
- [ ] CI/CD: separate pipelines for Moca and Capu

---

## 4. Dependency Graph (What Capu Needs)

```
Capu Backend
├── User (auth)
├── Integration (Gmail OAuth)
├── Contact (channel: gmail)
├── Conversation (Gmail threads)
├── Message (Gmail emails)
├── GmailFetchRule
├── EmailDraftQueue
├── Agent (for draft generation)
├── gmail.service (Gmail API)
├── gmailProcessor
├── gmailContactExtractor
├── gmailDraft
├── emailDraftGeneration
├── openai.service
└── googleOAuth
```

---

## 5. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Duplicate User management | Use shared User DB + same JWT; or implement SSO |
| Breaking Moca during extraction | Do Capu first (additive), then strip from Moca |
| Conversation model semantics | Gmail "conversations" = email threads; align field names |
| OpenAI usage | Same key; monitor usage per app |

---

## 6. File Inventory – Gmail-Specific (to move to Capu)

**Backend:**
- `gmailAgent/` (entire folder)
- `models/`: gmailFetchRule, emailDraftQueue, integration
- `routes/`: gmail, gmailAgent, gmailFetchRule, emailDraft, googleOAuth, integrations
- `services/`: gmail, gmailProcessor, gmailContactExtractor, gmailDraft, gmailFetchRule, emailDraftGeneration, emailDraftQueue, emailDraftWorker, gmailFetchRuleWorker, integrationToken, googleOAuth
- `agents.routes` (Gmail uses it for draft generation)

**Frontend:**
- `pages/gmail/*` (6 files)
- `components/gmail/*` (2 files)
- Gmail routes in App.tsx
- Gmail nav item in MainLayout

---

## 7. Next Steps

1. Confirm: Shared DB vs separate DB for Capu
2. Confirm: Same User/auth (one login for both) vs separate Capu users
3. Create Capu directory structure
4. Execute Phase 1–4 in order
5. Test Capu end-to-end before stripping Moca
