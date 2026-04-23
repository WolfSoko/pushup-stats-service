import { describe, it, expect } from '@jest/globals';
import {
  pushSubscriptionId,
  validateSubscriptionPayload,
} from './subscription';

describe('push/subscription', () => {
  describe('pushSubscriptionId', () => {
    it('generates consistent hash for same endpoint', () => {
      const endpoint = 'https://example.com/push/abc123';
      const id1 = pushSubscriptionId(endpoint);
      const id2 = pushSubscriptionId(endpoint);

      expect(id1).toBe(id2);
    });

    it('generates different hash for different endpoints', () => {
      const endpoint1 = 'https://example.com/push/abc123';
      const endpoint2 = 'https://example.com/push/def456';

      const id1 = pushSubscriptionId(endpoint1);
      const id2 = pushSubscriptionId(endpoint2);

      expect(id1).not.toBe(id2);
    });

    it('returns hex string', () => {
      const endpoint = 'https://example.com/push/test';
      const id = pushSubscriptionId(endpoint);

      expect(id).toMatch(/^[a-f0-9]{64}$/); // SHA-256 = 64 hex chars
    });

    it('handles long endpoint URLs', () => {
      const endpoint = 'https://example.com/very/long/path/' + 'a'.repeat(500);
      const id = pushSubscriptionId(endpoint);

      expect(id).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('validateSubscriptionPayload', () => {
    it('validates correct subscription payload', () => {
      const payload = {
        endpoint: 'https://example.com/push/abc',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      };

      const result = validateSubscriptionPayload(payload);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('allows optional userAgent and locale', () => {
      const payload = {
        endpoint: 'https://example.com/push/abc',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
        userAgent: 'Mozilla/5.0...',
        locale: 'de',
      };

      const result = validateSubscriptionPayload(payload);

      expect(result.valid).toBe(true);
    });

    it('rejects payload without endpoint', () => {
      const payload = {
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      };

      const result = validateSubscriptionPayload(payload);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('endpoint');
    });

    it('rejects payload with non-string endpoint', () => {
      const payload = {
        endpoint: 12345,
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      };

      const result = validateSubscriptionPayload(payload);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('endpoint');
    });

    it('rejects payload without keys', () => {
      const payload = {
        endpoint: 'https://example.com/push/abc',
      };

      const result = validateSubscriptionPayload(payload);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('keys');
    });

    it('rejects payload without p256dh key', () => {
      const payload = {
        endpoint: 'https://example.com/push/abc',
        keys: {
          auth: 'test-auth-key',
        },
      };

      const result = validateSubscriptionPayload(payload);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('p256dh');
    });

    it('rejects payload without auth key', () => {
      const payload = {
        endpoint: 'https://example.com/push/abc',
        keys: {
          p256dh: 'test-p256dh-key',
        },
      };

      const result = validateSubscriptionPayload(payload);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('auth');
    });

    it('rejects undefined payload', () => {
      const result = validateSubscriptionPayload(undefined);

      expect(result.valid).toBe(false);
    });

    it('rejects null payload', () => {
      const result = validateSubscriptionPayload(null);

      expect(result.valid).toBe(false);
    });

    it('rejects zombie endpoints on the `.invalid` TLD (permanently-removed.invalid)', () => {
      const payload = {
        endpoint:
          'https://permanently-removed.invalid/fcm/send/dMMpqrGleWA:APA91bEoMq9',
        keys: { p256dh: 'key1', auth: 'key2' },
      };

      const result = validateSubscriptionPayload(payload);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid');
    });

    it('rejects any `.invalid` hostname, not just the permanently-removed sentinel', () => {
      const payload = {
        endpoint: 'https://some-other-host.invalid/fcm/send/xyz',
        keys: { p256dh: 'key1', auth: 'key2' },
      };

      const result = validateSubscriptionPayload(payload);

      expect(result.valid).toBe(false);
    });

    it('accepts live FCM endpoints', () => {
      const payload = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abcdef',
        keys: { p256dh: 'key1', auth: 'key2' },
      };

      const result = validateSubscriptionPayload(payload);

      expect(result.valid).toBe(true);
    });
  });
});
