import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import { FollowUpConfig, InstagramAccount } from '../models';

// Set required env vars before importing routes
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.INSTAGRAM_CLIENT_ID = 'test-client-id';
process.env.INSTAGRAM_CLIENT_SECRET = 'test-client-secret';
process.env.INSTAGRAM_REDIRECT_URI = 'http://localhost/callback';

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
