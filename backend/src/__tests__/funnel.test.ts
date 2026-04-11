import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import Conversation from '../models/conversation.model';
import Contact from '../models/contact.model';

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';

import analyticsRoutes from '../routes/analytics.routes';
import { authenticateToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/analytics', analyticsRoutes);

const request = supertest(app);

describe('GET /api/analytics/funnel (R2.3)', () => {
  let token: string;

  beforeEach(async () => {
    token = jwt.sign(
      { userId: 'test-user-id', email: 'test@example.com' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    // Create test data — contacts + conversations at various scores
    const contact = await Contact.create({
      name: 'Funnel Test Contact',
      psid: 'psid-funnel',
      accountId: 'account-funnel'
    });

    // Score 1: 3 conversations
    for (let i = 0; i < 3; i++) {
      await Conversation.create({
        contactId: contact._id,
        accountId: 'account-funnel',
        status: 'open',
        leadScoring: { currentScore: 1 }
      });
    }

    // Score 2: 2 conversations
    for (let i = 0; i < 2; i++) {
      await Conversation.create({
        contactId: contact._id,
        accountId: 'account-funnel',
        status: 'open',
        leadScoring: { currentScore: 2 }
      });
    }

    // Score 3: 1 conversation
    await Conversation.create({
      contactId: contact._id,
      accountId: 'account-funnel',
      status: 'open',
      leadScoring: { currentScore: 3 }
    });
  });

  it('returns funnel data with correct score distribution', async () => {
    const res = await request
      .get('/api/analytics/funnel')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(6);
    expect(res.body.data.funnel).toHaveLength(7); // scores 1-7

    const score1 = res.body.data.funnel.find((f: any) => f.score === 1);
    expect(score1.count).toBe(3);

    const score2 = res.body.data.funnel.find((f: any) => f.score === 2);
    expect(score2.count).toBe(2);

    const score3 = res.body.data.funnel.find((f: any) => f.score === 3);
    expect(score3.count).toBe(1);

    const score7 = res.body.data.funnel.find((f: any) => f.score === 7);
    expect(score7.count).toBe(0);
  });

  it('calculates conversion rates between steps', async () => {
    const res = await request
      .get('/api/analytics/funnel')
      .set('Authorization', `Bearer ${token}`);

    const funnel = res.body.data.funnel;
    // Score 2 conversion rate = count(2) / count(1) * 100 = 2/3 * 100 = 66.7
    const score2 = funnel.find((f: any) => f.score === 2);
    expect(score2.conversionRate).toBeCloseTo(66.7, 0);
  });
});

describe('GET /api/analytics/follow-up-stats (R2.5)', () => {
  let token: string;

  beforeEach(async () => {
    token = jwt.sign(
      { userId: 'test-user-id', email: 'test@example.com' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );
  });

  it('returns follow-up stats with correct structure', async () => {
    const res = await request
      .get('/api/analytics/follow-up-stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalSent');
    expect(res.body.data).toHaveProperty('responseRate');
    expect(res.body.data).toHaveProperty('conversionRate');
  });
});
