import { describe, it, expect } from '@jest/globals';
import {
  shouldSendReminder,
  buildNotificationPayload,
  isExpiredSubscriptionError,
  isLeaseStale,
  STALE_LEASE_MS,
  PUSH_SEND_OPTIONS,
  ReminderConfig,
  FirestoreTimestamp,
} from './reminders';

describe('push/reminders', () => {
  describe('shouldSendReminder', () => {
    const mockFirestoreTime = (ms: number): FirestoreTimestamp => ({
      toMillis: () => ms,
    });

    const baseTime = new Date('2024-03-15T10:00:00Z').getTime(); // 11:00 Berlin time (UTC+1)

    it('returns false when reminder is not enabled', () => {
      const reminder: ReminderConfig = { enabled: false };
      const result = shouldSendReminder(reminder, null, baseTime, null);
      expect(result).toBe(false);
    });

    it('returns false when reminder is undefined', () => {
      const result = shouldSendReminder(undefined, null, baseTime, null);
      expect(result).toBe(false);
    });

    it('returns true when reminder is enabled and no constraints', () => {
      const reminder: ReminderConfig = { enabled: true };
      const result = shouldSendReminder(reminder, null, baseTime, null);
      expect(result).toBe(true);
    });

    it('respects quiet hours (non-midnight-crossing)', () => {
      // Quiet hours from 22:00 to 06:00 Berlin time
      const reminder: ReminderConfig = {
        enabled: true,
        timezone: 'Europe/Berlin',
        quietHours: [{ from: '22:00', to: '06:00' }],
      };

      // 14:00 Berlin time (outside quiet hours) -> should send
      const dayTime = new Date('2024-03-15T13:00:00Z').getTime();
      expect(shouldSendReminder(reminder, null, dayTime, null)).toBe(true);

      // 23:00 Berlin time (inside quiet hours) -> should not send
      const nightTime = new Date('2024-03-15T22:00:00Z').getTime();
      expect(shouldSendReminder(reminder, null, nightTime, null)).toBe(false);

      // 05:00 Berlin time (inside quiet hours) -> should not send
      const earlyMorning = new Date('2024-03-15T04:00:00Z').getTime();
      expect(shouldSendReminder(reminder, null, earlyMorning, null)).toBe(
        false
      );
    });

    it('respects quiet hours (simple daytime range)', () => {
      // Quiet hours from 12:00 to 14:00
      const reminder: ReminderConfig = {
        enabled: true,
        timezone: 'Europe/Berlin',
        quietHours: [{ from: '12:00', to: '14:00' }],
      };

      // 11:00 Berlin -> should send
      const beforeQuiet = new Date('2024-03-15T10:00:00Z').getTime();
      expect(shouldSendReminder(reminder, null, beforeQuiet, null)).toBe(true);

      // 13:00 Berlin (1 PM) -> should not send
      const duringQuiet = new Date('2024-03-15T12:00:00Z').getTime();
      expect(shouldSendReminder(reminder, null, duringQuiet, null)).toBe(false);

      // 15:00 Berlin -> should send
      const afterQuiet = new Date('2024-03-15T14:00:00Z').getTime();
      expect(shouldSendReminder(reminder, null, afterQuiet, null)).toBe(true);
    });

    it('handles multiple quiet hour ranges', () => {
      const reminder: ReminderConfig = {
        enabled: true,
        timezone: 'Europe/Berlin',
        quietHours: [
          { from: '08:00', to: '09:00' }, // Morning quiet
          { from: '20:00', to: '22:00' }, // Evening quiet
        ],
      };

      // 08:30 Berlin -> should not send (in first quiet hour)
      const morningQuiet = new Date('2024-03-15T07:30:00Z').getTime();
      expect(shouldSendReminder(reminder, null, morningQuiet, null)).toBe(
        false
      );

      // 10:00 Berlin -> should send (between quiet hours)
      const between = new Date('2024-03-15T09:00:00Z').getTime();
      expect(shouldSendReminder(reminder, null, between, null)).toBe(true);

      // 21:00 Berlin -> should not send (in second quiet hour)
      const eveningQuiet = new Date('2024-03-15T20:00:00Z').getTime();
      expect(shouldSendReminder(reminder, null, eveningQuiet, null)).toBe(
        false
      );
    });

    it('respects snooze time', () => {
      const reminder: ReminderConfig = { enabled: true };
      const now = baseTime;
      const snoozeUntil = mockFirestoreTime(now + 1000 * 60 * 10); // Snooze 10 minutes

      // Should not send while snoozed
      const result = shouldSendReminder(reminder, null, now, snoozeUntil);
      expect(result).toBe(false);

      // Should send after snooze expires
      const afterSnooze = now + 1000 * 60 * 11;
      const resultAfter = shouldSendReminder(
        reminder,
        null,
        afterSnooze,
        snoozeUntil
      );
      expect(resultAfter).toBe(true);
    });

    it('respects interval since last send', () => {
      const reminder: ReminderConfig = { enabled: true, intervalMinutes: 60 };
      const now = baseTime;
      const lastSent = mockFirestoreTime(now - 1000 * 60 * 30); // 30 min ago

      // Should not send (interval not elapsed)
      const result = shouldSendReminder(reminder, lastSent, now, null);
      expect(result).toBe(false);

      // Should send after interval elapses
      const afterInterval = now + 1000 * 60 * 31;
      const resultAfter = shouldSendReminder(
        reminder,
        lastSent,
        afterInterval,
        null
      );
      expect(resultAfter).toBe(true);
    });

    it('uses default interval when not specified', () => {
      const reminder: ReminderConfig = { enabled: true };
      const now = baseTime;
      // Exactly 59 minutes and 59 seconds ago (just under 1 hour)
      const lastSent = mockFirestoreTime(now - 1000 * 60 * 60 + 1000);

      // Should not send (default 60 min interval not elapsed)
      const result = shouldSendReminder(reminder, lastSent, now, null);
      expect(result).toBe(false);

      // Should send after 1 hour elapses
      const afterInterval = now + 2000;
      const resultAfter = shouldSendReminder(
        reminder,
        lastSent,
        afterInterval,
        null
      );
      expect(resultAfter).toBe(true);
    });

    it('handles Firestore timestamp objects without toMillis method', () => {
      const reminder: ReminderConfig = { enabled: true };
      const now = baseTime;

      // Simulate raw Firestore timestamp that needs parsing
      const lastSent = {
        toMillis: undefined,
      } as unknown as FirestoreTimestamp;

      // Should handle gracefully (won't throw)
      expect(() => {
        shouldSendReminder(reminder, lastSent, now, null);
      }).not.toThrow();
    });

    it('combines all constraints correctly', () => {
      const reminder: ReminderConfig = {
        enabled: true,
        timezone: 'Europe/Berlin',
        intervalMinutes: 60,
        quietHours: [{ from: '22:00', to: '06:00' }],
      };

      const now = baseTime; // 11:00 Berlin, during day
      const lastSent = mockFirestoreTime(now - 1000 * 60 * 120); // 2 hours ago

      // Should send: enabled, not in quiet hours, interval elapsed
      expect(shouldSendReminder(reminder, lastSent, now, null)).toBe(true);

      // Should not send: in quiet hours
      const nightTime = new Date('2024-03-15T23:00:00Z').getTime();
      expect(shouldSendReminder(reminder, lastSent, nightTime, null)).toBe(
        false
      );

      // Should not send: interval not elapsed
      const lastSentRecent = mockFirestoreTime(now - 1000 * 60 * 30); // 30 min ago
      const soonAfter = now + 1000 * 60 * 5; // 5 minutes later
      expect(
        shouldSendReminder(reminder, lastSentRecent, soonAfter, null)
      ).toBe(false);
    });
  });

  describe('buildNotificationPayload', () => {
    it('returns a message string', () => {
      const message = buildNotificationPayload();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('returns German message by default', () => {
      const germanMessages = [
        'Zeit für Liegestütze! 💪',
        'Kurze Pause? Perfekt für Liegestütze!',
        'Du schaffst das – ein paar Liegestütze!',
        'Beweg dich! Liegestütze warten auf dich. 🔥',
        'Dein Körper ruft: Liegestütze, los!',
      ];

      const message = buildNotificationPayload();
      expect(germanMessages).toContain(message);
    });

    it('returns German message when language is not specified', () => {
      const germanMessages = [
        'Zeit für Liegestütze! 💪',
        'Kurze Pause? Perfekt für Liegestütze!',
        'Du schaffst das – ein paar Liegestütze!',
        'Beweg dich! Liegestütze warten auf dich. 🔥',
        'Dein Körper ruft: Liegestütze, los!',
      ];

      const message = buildNotificationPayload(undefined);
      expect(germanMessages).toContain(message);
    });

    it('returns English message when language is "en"', () => {
      const englishMessages = [
        'Time for push-ups! 💪',
        'Quick break? Perfect for push-ups!',
        'You got this – a few push-ups!',
        'Move it! Push-ups are waiting for you. 🔥',
        'Your body calls: push-ups, go!',
      ];

      const message = buildNotificationPayload('en');
      expect(englishMessages).toContain(message);
    });

    it('returns German message for unknown language', () => {
      const germanMessages = [
        'Zeit für Liegestütze! 💪',
        'Kurze Pause? Perfekt für Liegestütze!',
        'Du schaffst das – ein paar Liegestütze!',
        'Beweg dich! Liegestütze warten auf dich. 🔥',
        'Dein Körper ruft: Liegestütze, los!',
      ];

      const message = buildNotificationPayload('fr');
      expect(germanMessages).toContain(message);
    });

    it('returns one of the available messages', () => {
      const allMessages = [
        'Zeit für Liegestütze! 💪',
        'Kurze Pause? Perfekt für Liegestütze!',
        'Du schaffst das – ein paar Liegestütze!',
        'Beweg dich! Liegestütze warten auf dich. 🔥',
        'Dein Körper ruft: Liegestütze, los!',
        'Time for push-ups! 💪',
        'Quick break? Perfect for push-ups!',
        'You got this – a few push-ups!',
        'Move it! Push-ups are waiting for you. 🔥',
        'Your body calls: push-ups, go!',
      ];

      // Test multiple times to check randomness
      for (let i = 0; i < 20; i++) {
        const message = buildNotificationPayload(
          Math.random() > 0.5 ? 'en' : 'de'
        );
        expect(allMessages).toContain(message);
      }
    });
  });

  describe('isLeaseStale', () => {
    const mockFirestoreTime = (ms: number): FirestoreTimestamp => ({
      toMillis: () => ms,
    });

    const now = Date.now();

    it('returns true when leaseAcquiredAt is null', () => {
      expect(isLeaseStale(null, now)).toBe(true);
    });

    it('returns true when leaseAcquiredAt is undefined', () => {
      expect(isLeaseStale(undefined, now)).toBe(true);
    });

    it('returns false when lease was acquired recently (1 minute ago)', () => {
      const oneMinAgo = mockFirestoreTime(now - 60_000);
      expect(isLeaseStale(oneMinAgo, now)).toBe(false);
    });

    it('returns false when lease was acquired just under the limit', () => {
      const justUnder = mockFirestoreTime(now - STALE_LEASE_MS + 1);
      expect(isLeaseStale(justUnder, now)).toBe(false);
    });

    it('returns true when lease was acquired exactly at the limit', () => {
      const atLimit = mockFirestoreTime(now - STALE_LEASE_MS);
      expect(isLeaseStale(atLimit, now)).toBe(true);
    });

    it('returns true when lease was acquired long ago (1 hour)', () => {
      const oneHourAgo = mockFirestoreTime(now - 60 * 60_000);
      expect(isLeaseStale(oneHourAgo, now)).toBe(true);
    });

    it('handles timestamp without toMillis (legacy format)', () => {
      const legacyTimestamp = {
        toMillis: undefined,
      } as unknown as FirestoreTimestamp;
      // No toMillis and invalid string → treated as stale
      expect(isLeaseStale(legacyTimestamp, now)).toBe(true);
    });

    it('STALE_LEASE_MS is 10 minutes', () => {
      expect(STALE_LEASE_MS).toBe(10 * 60 * 1000);
    });
  });

  describe('isExpiredSubscriptionError', () => {
    const ENDPOINT_FCM =
      'https://fcm.googleapis.com/fcm/send/fgr7FAJdyMU:APA91bEq...';
    const ENDPOINT_ZOMBIE =
      'https://permanently-removed.invalid/fcm/send/fgr7FAJdyMU:APA91bEq...';

    it('classifies statusCode 410 Gone as expired', () => {
      expect(
        isExpiredSubscriptionError({ statusCode: 410 }, ENDPOINT_FCM)
      ).toBe(true);
    });

    it('classifies statusCode 404 Not Found as expired', () => {
      expect(
        isExpiredSubscriptionError({ statusCode: 404 }, ENDPOINT_FCM)
      ).toBe(true);
    });

    it('classifies any endpoint on the .invalid TLD as expired (Chromium sentinel)', () => {
      // Chrome/Edge return `permanently-removed.invalid` as the sanitized
      // endpoint after the push service has invalidated the subscription.
      // DNS lookup fails (RFC 6761) so web-push throws a network error, not
      // a WebPushError — without this classification the sub is never cleaned.
      expect(isExpiredSubscriptionError({}, ENDPOINT_ZOMBIE)).toBe(true);
    });

    it('classifies DNS failures (ENOTFOUND) as expired', () => {
      const err = { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND foo' };
      expect(isExpiredSubscriptionError(err, ENDPOINT_ZOMBIE)).toBe(true);
    });

    it('classifies DNS failures via err.message when code is absent', () => {
      // Some Node versions surface DNS failures only in the error message.
      const err = {
        message: 'getaddrinfo ENOTFOUND permanently-removed.invalid',
      };
      expect(isExpiredSubscriptionError(err, ENDPOINT_ZOMBIE)).toBe(true);
    });

    it('classifies transient DNS failures (EAI_AGAIN) as expired for .invalid endpoints', () => {
      const err = { code: 'EAI_AGAIN' };
      expect(isExpiredSubscriptionError(err, ENDPOINT_ZOMBIE)).toBe(true);
    });

    it('does NOT classify 500 Internal Server Error as expired (transient push-service failure)', () => {
      expect(
        isExpiredSubscriptionError({ statusCode: 500 }, ENDPOINT_FCM)
      ).toBe(false);
    });

    it('does NOT classify 429 rate-limit as expired', () => {
      expect(
        isExpiredSubscriptionError({ statusCode: 429 }, ENDPOINT_FCM)
      ).toBe(false);
    });

    it('does NOT classify a generic error with a live FCM endpoint as expired', () => {
      // Network hiccup or unknown failure against a real endpoint — stay
      // conservative, keep the sub, let the next tick retry.
      const err = { message: 'socket hang up', code: 'ECONNRESET' };
      expect(isExpiredSubscriptionError(err, ENDPOINT_FCM)).toBe(false);
    });

    it('handles null/undefined error safely', () => {
      expect(isExpiredSubscriptionError(null, ENDPOINT_ZOMBIE)).toBe(true);
      expect(isExpiredSubscriptionError(undefined, ENDPOINT_FCM)).toBe(false);
    });

    it('handles malformed endpoint strings without throwing', () => {
      expect(isExpiredSubscriptionError({ statusCode: 410 }, '')).toBe(true);
      expect(isExpiredSubscriptionError({}, 'not-a-url')).toBe(false);
    });
  });

  describe('PUSH_SEND_OPTIONS', () => {
    it('uses high urgency so Android wakes the SW instead of batching', () => {
      expect(PUSH_SEND_OPTIONS.urgency).toBe('high');
    });

    it('uses a short TTL so stale reminders do not pile up in the queue', () => {
      expect(PUSH_SEND_OPTIONS.TTL).toBe(1800);
    });

    it('uses a topic so FCM collapses queued reminders', () => {
      expect(PUSH_SEND_OPTIONS.topic).toBe('reminder');
    });
  });
});
