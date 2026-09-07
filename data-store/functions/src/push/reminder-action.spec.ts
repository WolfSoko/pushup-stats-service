import { describe, expect, it } from '@jest/globals';

import {
  buildQuickLogEntry,
  decideReminderAction,
  newReminderActionToken,
  parseReminderActionRequest,
  REMINDER_ACTION_MAX_AGE_MS,
  zonedLocalTimestamp,
  type PendingReminderAction,
  type ReminderActionRequest,
} from './reminder-action';

const NOW = new Date('2026-09-06T08:30:15.250Z').getTime();
const TOKEN = 'abc123token';

function pending(
  overrides: Partial<PendingReminderAction> = {}
): PendingReminderAction {
  return {
    token: TOKEN,
    issuedAt: { toMillis: () => NOW - 60_000 },
    quickLogReps: 10,
    ...overrides,
  };
}

function request(
  overrides: Partial<ReminderActionRequest> = {}
): ReminderActionRequest {
  return {
    uid: 'user-1',
    token: TOKEN,
    action: 'quick-log',
    ...overrides,
  };
}

describe('push/reminder-action', () => {
  describe('newReminderActionToken', () => {
    it('should produce unguessable, distinct tokens', () => {
      // when
      const a = newReminderActionToken();
      const b = newReminderActionToken();

      // then
      expect(a).not.toBe(b);
      expect(a.length).toBeGreaterThanOrEqual(40);
      expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('parseReminderActionRequest', () => {
    it('should accept a quick-log request', () => {
      // when
      const parsed = parseReminderActionRequest({
        uid: 'u',
        token: 't',
        action: 'quick-log',
      });

      // then
      expect(parsed).toEqual({ uid: 'u', token: 't', action: 'quick-log' });
    });

    it.each([
      ['missing uid', { token: 't', action: 'quick-log' }],
      ['empty token', { uid: 'u', token: '', action: 'quick-log' }],
      ['unknown action', { uid: 'u', token: 't', action: 'delete-all' }],
      ['the removed snooze action', { uid: 'u', token: 't', action: 'snooze' }],
      ['non-object payload', 'quick-log'],
      ['null payload', null],
    ])('should reject %s', (_label, raw) => {
      // then
      expect(parseReminderActionRequest(raw)).toBeNull();
    });
  });

  describe('decideReminderAction', () => {
    it('should quick-log with the reps the server offered, not the ones the client claims', () => {
      // when
      const decision = decideReminderAction(
        request({ action: 'quick-log' }),
        pending({ quickLogReps: 10 }),
        'Europe/Berlin',
        NOW
      );

      // then
      expect(decision).toMatchObject({
        ok: true,
        action: 'quick-log',
        reps: 10,
        entry: {
          userId: 'user-1',
          exerciseId: 'pushup',
          reps: 10,
          sets: [10],
          source: 'reminder',
          timestamp: '2026-09-06T10:30+02:00',
        },
      });
    });

    it('should clamp absurd pending reps to the quick-log maximum', () => {
      // when
      const decision = decideReminderAction(
        request({ action: 'quick-log' }),
        pending({ quickLogReps: 9999 }),
        undefined,
        NOW
      );

      // then
      expect(decision).toMatchObject({ ok: true, reps: 500 });
    });

    it('should refuse a quick-log when the reminder offered none', () => {
      // when
      const decision = decideReminderAction(
        request({ action: 'quick-log' }),
        pending({ quickLogReps: undefined }),
        undefined,
        NOW
      );

      // then
      expect(decision).toEqual({ ok: false, reason: 'quick-log-not-offered' });
    });

    it('should reject when no action is pending (already consumed)', () => {
      // then
      expect(decideReminderAction(request(), null, undefined, NOW)).toEqual({
        ok: false,
        reason: 'no-pending-action',
      });
      expect(
        decideReminderAction(request(), undefined, undefined, NOW)
      ).toEqual({ ok: false, reason: 'no-pending-action' });
    });

    it('should reject a token that does not match', () => {
      // then
      expect(
        decideReminderAction(
          request({ token: 'other' }),
          pending(),
          undefined,
          NOW
        )
      ).toEqual({ ok: false, reason: 'token-mismatch' });
    });

    it('should reject a token older than the push TTL', () => {
      // given
      const stale = pending({
        issuedAt: { toMillis: () => NOW - REMINDER_ACTION_MAX_AGE_MS - 1 },
      });

      // then
      expect(decideReminderAction(request(), stale, undefined, NOW)).toEqual({
        ok: false,
        reason: 'expired',
      });
    });

    it('should accept a numeric issuedAt and reject a missing one', () => {
      // then
      expect(
        decideReminderAction(
          request(),
          pending({ issuedAt: NOW - 1000 }),
          undefined,
          NOW
        ).ok
      ).toBe(true);
      expect(
        decideReminderAction(
          request(),
          pending({ issuedAt: null }),
          undefined,
          NOW
        )
      ).toEqual({ ok: false, reason: 'expired' });
    });
  });

  describe('buildQuickLogEntry / zonedLocalTimestamp', () => {
    it('should format the wall-clock time in the user timezone with its offset', () => {
      // given summer time in Berlin (UTC+2) and standard time in New York (UTC-4)
      const now = new Date('2026-09-06T08:30:15.250Z');

      // then
      expect(zonedLocalTimestamp(now, 'Europe/Berlin')).toBe(
        '2026-09-06T10:30+02:00'
      );
      expect(zonedLocalTimestamp(now, 'America/New_York')).toBe(
        '2026-09-06T04:30-04:00'
      );
      expect(zonedLocalTimestamp(now, 'Asia/Kolkata')).toBe(
        '2026-09-06T14:00+05:30'
      );
    });

    it('should cross the date line correctly', () => {
      // given a UTC evening that is already tomorrow in Tokyo
      const now = new Date('2026-12-31T16:00:00Z');

      // then
      expect(zonedLocalTimestamp(now, 'Asia/Tokyo')).toBe(
        '2027-01-01T01:00+09:00'
      );
    });

    it('should fall back to the default timezone for garbage input', () => {
      // given
      const now = new Date('2026-01-15T09:00:00Z');

      // then Berlin in winter is UTC+1
      expect(zonedLocalTimestamp(now, 'Not/AZone')).toBe(
        '2026-01-15T10:00+01:00'
      );
      expect(zonedLocalTimestamp(now, undefined)).toBe(
        '2026-01-15T10:00+01:00'
      );
    });

    it('should mirror the client entry shape', () => {
      // when
      const entry = buildQuickLogEntry(
        'u1',
        25,
        'Europe/Berlin',
        new Date('2026-09-06T08:30:00Z')
      );

      // then
      expect(entry).toEqual({
        userId: 'u1',
        exerciseId: 'pushup',
        timestamp: '2026-09-06T10:30+02:00',
        reps: 25,
        sets: [25],
        source: 'reminder',
        createdAt: '2026-09-06T08:30:00.000Z',
        updatedAt: '2026-09-06T08:30:00.000Z',
      });
    });
  });
});
