import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';

// Set env before importing
process.env.INSTAGRAM_APP_SECRET = 'test-app-secret-12345';
process.env.INSTAGRAM_VERIFY_TOKEN = 'test-verify-token';

import { InstagramWebhookService } from '../services/instagramWebhook.service';

describe('InstagramWebhookService.validateSignature', () => {
  let service: InstagramWebhookService;
  const appSecret = 'test-app-secret-12345';

  beforeEach(() => {
    service = new InstagramWebhookService();
  });

  function createValidSignature(payload: string): string {
    return 'sha256=' + crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('hex');
  }

  it('accepts a valid HMAC-SHA256 signature', async () => {
    const payload = JSON.stringify({ object: 'instagram', entry: [] });
    const signature = createValidSignature(payload);

    const result = await service.validateSignature(payload, signature);
    expect(result).toBe(true);
  });

  it('rejects an invalid signature', async () => {
    const payload = JSON.stringify({ object: 'instagram', entry: [] });
    const fakeSignature = 'sha256=' + 'a'.repeat(64);

    const result = await service.validateSignature(payload, fakeSignature);
    expect(result).toBe(false);
  });

  it('rejects when payload has been tampered with', async () => {
    const originalPayload = JSON.stringify({ object: 'instagram', entry: [] });
    const signature = createValidSignature(originalPayload);
    const tamperedPayload = JSON.stringify({ object: 'instagram', entry: [{ hacked: true }] });

    const result = await service.validateSignature(tamperedPayload, signature);
    expect(result).toBe(false);
  });

  it('rejects when signature is missing sha256= prefix', async () => {
    const payload = JSON.stringify({ object: 'instagram' });
    // Create raw hex without prefix — timingSafeEqual will fail on length mismatch
    const rawHex = crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('hex');

    const result = await service.validateSignature(payload, rawHex);
    expect(result).toBe(false);
  });

  it('returns false when INSTAGRAM_APP_SECRET is empty', async () => {
    // Create a service instance with no secret
    const originalSecret = process.env.INSTAGRAM_APP_SECRET;
    process.env.INSTAGRAM_APP_SECRET = '';
    const serviceNoSecret = new InstagramWebhookService();

    const payload = JSON.stringify({ object: 'instagram' });
    const result = await serviceNoSecret.validateSignature(payload, 'sha256=abc');
    expect(result).toBe(false);

    // Restore
    process.env.INSTAGRAM_APP_SECRET = originalSecret;
  });
});

describe('InstagramWebhookService.handleVerification', () => {
  let service: InstagramWebhookService;

  beforeEach(() => {
    service = new InstagramWebhookService();
  });

  it('returns the challenge when mode and token match', () => {
    const result = service.handleVerification('subscribe', 'test-verify-token', 'challenge-123');
    expect(result).toBe('challenge-123');
  });

  it('returns null when mode is wrong', () => {
    const result = service.handleVerification('unsubscribe', 'test-verify-token', 'challenge-123');
    expect(result).toBeNull();
  });

  it('returns null when token does not match', () => {
    const result = service.handleVerification('subscribe', 'wrong-token', 'challenge-123');
    expect(result).toBeNull();
  });
});
