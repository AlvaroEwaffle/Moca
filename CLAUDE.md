# Moca — Launch Readiness Analysis

> Generated: 2026-02-24. This document is the product of a full codebase audit and serves as the authoritative pre-launch gap analysis for Moca.

---

## Overall Assessment

**Moca is ~70% production-ready.**

Core Instagram DM automation works end-to-end (webhook reception → AI response → outbound send → lead scoring). The product is functional but not production-hardened. Four security blockers must be resolved before any real customer traffic.

---

## What Works

- Instagram OAuth connection flow (short → long-lived token exchange)
- Meta webhook reception with correct immediate-200 pattern
- AI response generation via OpenAI (GPT-4)
- Lead scoring (1–7 scale with step names)
- Multi-account support per user
- Conversation management (list, kanban, detail view, manual send)
- Background workers: debounce, sender, comment processor, follow-up scheduler
- User authentication with JWT
- Agent enable/disable per conversation and globally
- Legal pages (Privacy, Terms, Data Deletion) — required for Meta app approval

---

## Blockers — Must Fix Before Launch

### 1. Hardcoded JWT Fallback Secret

**Files:** `backend/src/config/index.ts:17`, `routes/auth.routes.ts:80,86,151,157`, `middleware/auth.ts:41`

```typescript
process.env.JWT_SECRET || 'fallback-secret'  // NEVER use this in prod
```

If `JWT_SECRET` is missing from env, the system silently falls back to a known string. Any attacker can forge valid JWTs.

**Fix:** Remove fallback. Throw at startup if `JWT_SECRET` is not set.

---

### 2. Missing Logout Endpoint + No Token Revocation

**File:** `backend/src/routes/auth.routes.ts` — no `POST /api/auth/logout` route
**File:** `frontend/src/context/AuthContext.tsx:201` — calls that endpoint anyway

Logout is client-side only (localStorage clear). Tokens are never invalidated server-side. A stolen token remains valid for the full 24 h window.

**Fix:** Add logout route that writes the token to a blocklist (in-memory Map or MongoDB) and check blocklist in `authenticateToken` middleware.

---

### 3. No Rate Limiting on Auth Endpoints

`POST /api/auth/login` and `POST /api/auth/register` have no rate limiting. Brute force attacks are unblocked.

**Fix:** Add `express-rate-limit` on auth routes before launch.

---

### 4. Webhook Signature Validation Gaps

**File:** `backend/src/services/instagramWebhook.service.ts`

DM webhooks validate the `X-Hub-Signature-256` header. Comment webhooks (`processChange`) do **not**. An attacker can POST crafted comment events directly.

**Fix:** Extract signature validation to a shared utility and call it for all incoming webhook events, not just DMs.

---

## High Priority — Fix Soon After Launch

### 5. Hardcoded Instagram Client ID in Frontend

**File:** `frontend/src/pages/auth/InstagramAuth.tsx:33`

```typescript
client_id=2160534791106844  // visible in browser source
```

**Fix:** Frontend hits a `/api/instagram-oauth/url` backend endpoint that returns the full OAuth URL. Backend reads `INSTAGRAM_CLIENT_ID` from env. Client ID never touches the frontend bundle.

---

### 6. No Refresh Token Rotation

Frontend stores a `refreshToken` in localStorage and expects a refresh endpoint. Backend never implements one. After 24 h, users are silently logged out.

**Fix:** Implement `POST /api/auth/refresh` on backend; rotate both tokens on each use.

---

### 7. No Billing System

`BillingInterface.tsx` exists in the frontend but renders hardcoded mock data. There are no billing models in MongoDB, no payment processor integration, and no backend billing routes.

**Status:** Revenue gating is impossible without this.
**Fix:** Integrate MercadoPago (mentioned in strategy docs) or a comparable provider. Add `Subscription` and `Invoice` Mongoose models. Gate API access by subscription status.

---

### 8. Race Condition on Conversation Counters

**File:** `backend/src/routes/instagram.routes.ts:313-318`

```typescript
conversation.metrics.totalMessages += 1;  // Not atomic
conversation.metrics.botMessages += 1;
await conversation.save();
```

Two concurrent messages can cause lost increments.

**Fix:** Replace with MongoDB `$inc` atomic updates.

---

### 9. Incomplete Lead Score 5 Logic

**File:** `backend/src/services/leadScoring.service.ts:118`

```typescript
// TODO: Check if a reminder was actually sent in the conversation history
if (maxScore === 5) { ... }
```

Lead score 5 ("Reminder Sent") is never correctly assigned.

**Fix:** Query message history before assigning score 5.

---

### 10. Incomplete Rate Limiting in Sender Worker

**File:** `backend/src/services/senderWorker.service.ts:200`

```typescript
if (account.rateLimits.messagesPerSecond > 0) {
  const recentMessages = await OutboundQueue.countDocuments({...});
  // No logic after this — rate limit check is inert
}
```

Rate limiting is scaffolded but never enforced.

**Fix:** Complete the logic: if `recentMessages >= limit`, delay or requeue instead of sending.

---

## Medium Priority — Address in First Month

### Environment Variables

Document all required variables. Currently `JWT_SECRET` is not in any `.env.example`. The existing `.env.example` is labeled for a different product ("Tiare - Healthcare").

Full required list for Moca:

```bash
# Backend
MONGODB_URI=
OPENAI_API_KEY=
INSTAGRAM_VERIFY_TOKEN=
INSTAGRAM_APP_SECRET=
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
JWT_SECRET=                 # REQUIRED — no fallback
PORT=3002
NODE_ENV=production

# Frontend
VITE_API_URL=
VITE_INSTAGRAM_CLIENT_ID=   # Only if not proxied through backend
```

Undocumented but used: `OPENAI_MODEL`, `OPENAI_MAX_TOKENS`, `LOG_AGENT_DECISIONS`

---

### Frontend Gaps

| Area | Issue |
|------|-------|
| Error boundaries | None — one component crash kills the whole app |
| Redirect URIs | Hardcoded `https://moca.pages.dev/instagram-callback` in `dashboard.tsx:101` and `instagramAuth.tsx:58` |
| Onboarding | Silent failure if agent config API call fails — user proceeds without config being saved |
| Loading states | Missing on conversations list, analytics, account pages |
| Token expiry | Frontend doesn't handle 401 responses with auto-refresh |

---

### Database

- **No migration framework.** Schema changes risk corrupting production data. Consider `migrate-mongo`.
- Old 1–10 lead scores (from a previous version) in the DB will not map correctly to the current 1–7 scale. A one-time migration script is needed.
- No backup strategy documented.

---

### Input Validation

- `POST /api/auth/register` — no email format check, no password strength requirement
- Manual message send endpoint — minimal content validation
- No request body size limits on Express (default 100 kb JSON limit via body-parser, but no explicit cap)

---

### Testing

Zero test files. No Jest, Vitest, or any test runner configured anywhere in the codebase.

**Minimum viable test surface before launch:**
1. `debounceWorker.service.ts` — retry logic is easy to regress
2. `instagram.routes.ts` — the webhook handler; a bug here silently drops messages
3. Auth flow — login, token validation, logout

---

## Unused / Unclear Code

These models and features exist but are never referenced by active code paths. Don't delete yet — verify before removing:

- `KeywordActivationRule` model
- `CommentAutoReplyRule` model
- `Agent` model (multi-agent system — purpose unclear)
- `Integration` model
- `SLACK_WEBHOOK_URL` env var (defined, never used)
- `MCP tools` code (present, untested)

---

## Files That Must Not Be Changed Without Full Understanding

(Inherited from root `CLAUDE.md` — repeated here for Moca-specific context)

| File | Risk |
|------|------|
| `backend/src/index.ts` | Worker startup order; race conditions on init |
| `backend/src/routes/instagram.routes.ts` | Immediate-200 webhook pattern; signature validation; most critical file |
| `backend/src/models/conversation.model.ts` | Has production data; lead scoring schema tied to AI prompts |
| `backend/src/services/senderWorker.service.ts` | Rate limits tuned to Instagram Graph API constraints |
| CORS origins in `index.ts` | Cloudflare Pages URLs are production; removing them breaks the frontend |

---

## Launch Checklist

### Hard blockers (P0)
- [ ] Remove JWT hardcoded fallback; validate at startup
- [ ] Implement server-side logout with token blocklist
- [ ] Add rate limiting to auth endpoints
- [ ] Validate webhook signature for all event types (not just DMs)

### Should-have before first customer (P1)
- [ ] Move Instagram client ID out of frontend bundle
- [ ] Complete rate limiting in sender worker
- [ ] Fix race condition on conversation counters (`$inc`)
- [ ] Fix lead score 5 TODO
- [ ] Implement token refresh endpoint
- [ ] Create accurate `.env.example`
- [ ] Add error boundaries in React app

### Post-launch (P2)
- [ ] Billing/subscription system
- [ ] Refresh token rotation
- [ ] Database migration framework
- [ ] Minimum test suite (3 files above)
- [ ] APM / error tracking (Sentry or equivalent)
- [ ] Admin monitoring dashboard wired to real API
- [ ] Handle 1–10 → 1–7 score migration for any existing data
