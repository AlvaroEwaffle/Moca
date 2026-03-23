import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import supertest from 'supertest';

// Set required env vars before importing routes
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';

import authRoutes from '../routes/auth.routes';
import { authenticateToken } from '../middleware/auth';

// --- App setup (no rate limiter — we test auth logic, not rate limits) ---
// We create a thin app that mounts the auth routes.
// Rate limiters key on IP, so we set unique X-Forwarded-For headers per describe block.
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use('/api/auth', authRoutes);

const request = supertest(app);

// Helper: unique IP per test suite to avoid rate limiter collisions
let ipCounter = 0;
function uniqueIp(): string {
  ipCounter++;
  return `10.0.0.${ipCounter}`;
}

describe('POST /api/auth/register', () => {
  const ip = uniqueIp();
  const validUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'securepassword123',
    businessName: 'Test Business',
    phone: '+56912345678'
  };

  it('registers a new user and returns tokens', async () => {
    const res = await request.post('/api/auth/register')
      .set('X-Forwarded-For', ip)
      .send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
    // Password should not be in response
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('returns 409 when email already registered', async () => {
    const ip2 = uniqueIp();
    const ip3 = uniqueIp();
    const dupUser = { ...validUser, email: 'dup@example.com' };
    // First registration should succeed
    await request.post('/api/auth/register')
      .set('X-Forwarded-For', ip2)
      .send(dupUser);
    // Second registration with same email should fail
    const res = await request.post('/api/auth/register')
      .set('X-Forwarded-For', ip3)
      .send(dupUser);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when required fields are missing', async () => {
    const ip3 = uniqueIp();
    const res = await request.post('/api/auth/register')
      .set('X-Forwarded-For', ip3)
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  const loginIp = uniqueIp();

  beforeAll(async () => {
    const regIp = uniqueIp();
    await request.post('/api/auth/register')
      .set('X-Forwarded-For', regIp)
      .send({
        name: 'Login User',
        email: 'login@example.com',
        password: 'password12345',
        businessName: 'Login Business',
        phone: '+56911111111'
      });
  });

  it('logs in with correct credentials and returns tokens', async () => {
    const res = await request.post('/api/auth/login')
      .set('X-Forwarded-For', loginIp)
      .send({
        email: 'login@example.com',
        password: 'password12345'
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
  });

  it('returns 401 with wrong password', async () => {
    const ip2 = uniqueIp();
    const res = await request.post('/api/auth/login')
      .set('X-Forwarded-For', ip2)
      .send({
        email: 'login@example.com',
        password: 'wrongpassword'
      });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 with non-existent email', async () => {
    const ip3 = uniqueIp();
    const res = await request.post('/api/auth/login')
      .set('X-Forwarded-For', ip3)
      .send({
        email: 'nobody@nowhere.com',
        password: 'doesntmatter'
      });
    expect(res.status).toBe(401);
  });

  it('returns 400 when email or password is missing', async () => {
    const ip4 = uniqueIp();
    const res = await request.post('/api/auth/login')
      .set('X-Forwarded-For', ip4)
      .send({ email: 'login@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/auth/me', () => {
  it('returns user data with valid token', async () => {
    const regIp = uniqueIp();
    const regRes = await request.post('/api/auth/register')
      .set('X-Forwarded-For', regIp)
      .send({
        name: 'Me User',
        email: 'me@example.com',
        password: 'password12345',
        businessName: 'Me Business',
        phone: '+56933333333'
      });
    const token = regRes.body.data.tokens.accessToken;

    const res = await request.get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('me@example.com');
    expect(res.body.data.password).toBeUndefined();
  });

  it('returns 401 without token', async () => {
    const res = await request.get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 403 with invalid token', async () => {
    const res = await request.get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(403);
  });
});

describe('authenticateToken middleware — unit tests', () => {
  it('rejects requests without Authorization header', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/protected', authenticateToken, (_req, res) => {
      res.json({ ok: true });
    });
    const r = supertest(testApp);

    const res = await r.get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Access token required');
  });

  it('rejects tokens that are not valid JWT format', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/protected', authenticateToken, (_req, res) => {
      res.json({ ok: true });
    });
    const r = supertest(testApp);

    const res = await r.get('/protected')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Invalid token format');
  });

  it('passes valid JWT through and sets req.user', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/protected', authenticateToken, (req, res) => {
      res.json({ userId: req.user?.userId, email: req.user?.email });
    });
    const r = supertest(testApp);

    const token = jwt.sign(
      { userId: 'user-123', email: 'test@test.com' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    const res = await r.get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-123');
    expect(res.body.email).toBe('test@test.com');
  });
});
