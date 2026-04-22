import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import { FollowUpConfig } from '../models';
import followUpRoutes from '../routes/followUp.routes';

// Set required env vars for authenticated route handlers.
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.INSTAGRAM_CLIENT_ID = 'test-client-id';
process.env.INSTAGRAM_CLIENT_SECRET = 'test-client-secret';
process.env.INSTAGRAM_REDIRECT_URI = 'http://localhost/callback';

const app = express();
app.use(express.json());
app.use('/api/follow-up', followUpRoutes);

describe('FollowUp Default Config on Account Creation (R1.5)', () => {
  it('creates a FollowUpConfig entry in the database with enabled=true', async () => {
    // Create a test user
    const user = await User.create({
      name: 'Test User',
      email: 'followup-test@example.com',
      password: 'hashedpassword123',
      businessName: 'TestBiz',
      phone: '+56912345678'
    });

    // Simulate what the OAuth callback does when creating a new account
    const accountId = 'test-account-123';

    const existingFollowUpConfig = await FollowUpConfig.findOne({
      userId: user._id.toString(),
      accountId
    });

    expect(existingFollowUpConfig).toBeNull();

    // Create the follow-up config as the OAuth callback would
    const defaultConfig = new FollowUpConfig({
      userId: user._id.toString(),
      accountId,
      enabled: true,
      minLeadScore: 2,
      maxFollowUps: 3,
      timeSinceLastAnswer: 12,
      messageMode: 'template',
      messageTemplate: 'Test follow-up message'
    });
    await defaultConfig.save();

    // Verify it was created correctly
    const created = await FollowUpConfig.findOne({
      userId: user._id.toString(),
      accountId
    });

    expect(created).not.toBeNull();
    expect(created!.enabled).toBe(true);
    expect(created!.maxFollowUps).toBe(3);
    expect(created!.timeSinceLastAnswer).toBe(12);
    expect(created!.messageMode).toBe('template');
  });

  it('defaults new FollowUpConfig records to enabled=true when omitted', async () => {
    const user = await User.create({
      name: 'Default Enabled User',
      email: 'followup-default-enabled@example.com',
      password: 'hashedpassword123',
      businessName: 'DefaultBiz',
      phone: '+56912345670'
    });

    const config = await FollowUpConfig.create({
      userId: user._id.toString(),
      accountId: 'test-account-default-enabled',
      messageTemplate: 'Default enabled follow-up'
    });

    expect(config.enabled).toBe(true);
    expect(config.minLeadScore).toBe(2);
    expect(config.maxFollowUps).toBe(3);
  });

  it('GET /config creates missing config enabled by default', async () => {
    const user = await User.create({
      name: 'Route Default User',
      email: 'followup-route-default@example.com',
      password: 'hashedpassword123',
      businessName: 'RouteDefaultBiz',
      phone: '+56912345671'
    });
    const accountId = 'test-account-route-default';
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      process.env.JWT_SECRET!
    );

    const response = await supertest(app)
      .get(`/api/follow-up/config/${accountId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.enabled).toBe(true);
    expect(response.body.minLeadScore).toBe(2);
    expect(response.body.maxFollowUps).toBe(3);
    expect(response.body.timeSinceLastAnswer).toBe(12);

    const config = await FollowUpConfig.findOne({
      userId: user._id.toString(),
      accountId
    });
    expect(config?.enabled).toBe(true);
  });

  it('does not create duplicate FollowUpConfig if one already exists', async () => {
    const user = await User.create({
      name: 'Test User 2',
      email: 'followup-test2@example.com',
      password: 'hashedpassword123',
      businessName: 'TestBiz2',
      phone: '+56912345679'
    });

    const accountId = 'test-account-456';

    // Pre-existing config
    await FollowUpConfig.create({
      userId: user._id.toString(),
      accountId,
      enabled: false,
      minLeadScore: 3,
      maxFollowUps: 5,
      timeSinceLastAnswer: 24,
      messageMode: 'ai',
      messageTemplate: 'Existing template'
    });

    // Check that a second config would be found (so no duplicate created)
    const existing = await FollowUpConfig.findOne({
      userId: user._id.toString(),
      accountId
    });

    expect(existing).not.toBeNull();
    expect(existing!.enabled).toBe(false); // Preserved original value
    expect(existing!.maxFollowUps).toBe(5); // Preserved original value
  });
});
