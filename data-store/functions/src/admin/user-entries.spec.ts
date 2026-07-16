import { describe, it, expect } from '@jest/globals';
import {
  MAX_USER_ENTRIES_LIMIT,
  serializeEntry,
  toIsoString,
  validateListUserEntriesPayload,
  validateUpdateUserEntryPayload,
} from './user-entries';

describe('admin/user-entries', () => {
  describe('validateListUserEntriesPayload', () => {
    it('should accept a bare uid and apply the default limit', () => {
      // given / when
      const result = validateListUserEntriesPayload({ uid: '  user-1  ' });

      // then
      expect(result).toEqual({ valid: true, uid: 'user-1', limit: 1000 });
    });

    it('should reject a missing or empty uid', () => {
      // given / when / then
      expect(validateListUserEntriesPayload({}).valid).toBe(false);
      expect(validateListUserEntriesPayload({ uid: '   ' }).valid).toBe(false);
      expect(validateListUserEntriesPayload(null).valid).toBe(false);
    });

    it('should cap an oversized limit at the maximum', () => {
      // given / when
      const result = validateListUserEntriesPayload({
        uid: 'u',
        limit: 999999,
      });

      // then
      expect(result).toEqual({
        valid: true,
        uid: 'u',
        limit: MAX_USER_ENTRIES_LIMIT,
      });
    });

    it('should reject a non-positive or non-integer limit', () => {
      // given / when / then
      expect(validateListUserEntriesPayload({ uid: 'u', limit: 0 }).valid).toBe(
        false
      );
      expect(
        validateListUserEntriesPayload({ uid: 'u', limit: 1.5 }).valid
      ).toBe(false);
    });
  });

  describe('validateUpdateUserEntryPayload', () => {
    it('should accept a valid patch and trim identifiers', () => {
      // given / when
      const result = validateUpdateUserEntryPayload({
        uid: ' user-1 ',
        entryId: ' entry-1 ',
        patch: { reps: 30, timestamp: '2026-04-01T10:00:00.000Z' },
      });

      // then
      expect(result).toEqual({
        valid: true,
        uid: 'user-1',
        entryId: 'entry-1',
        patch: { reps: 30, timestamp: '2026-04-01T10:00:00.000Z' },
      });
    });

    it('should reject an attempt to change exerciseId', () => {
      // given / when
      const result = validateUpdateUserEntryPayload({
        uid: 'u',
        entryId: 'e',
        patch: { exerciseId: 'legs.squats', reps: 10 },
      });

      // then
      expect(result).toEqual({
        valid: false,
        error: 'exerciseId is immutable',
      });
    });

    it('should trim a whitespace-padded ISO timestamp', () => {
      // given / when
      const result = validateUpdateUserEntryPayload({
        uid: 'u',
        entryId: 'e',
        patch: { timestamp: '  2026-04-01T12:30:00+02:00  ' },
      });

      // then
      expect(result).toEqual({
        valid: true,
        uid: 'u',
        entryId: 'e',
        patch: { timestamp: '2026-04-01T12:30:00+02:00' },
      });
    });

    it('should reject a malformed timestamp', () => {
      // given / when
      const result = validateUpdateUserEntryPayload({
        uid: 'u',
        entryId: 'e',
        patch: { timestamp: 'not-a-timestamp' },
      });

      // then
      expect(result.valid).toBe(false);
    });

    it('should reject a timestamp without a timezone suffix', () => {
      // given / when — ambiguous local time would be parsed in the server locale
      const result = validateUpdateUserEntryPayload({
        uid: 'u',
        entryId: 'e',
        patch: { timestamp: '2026-04-01T12:30:00' },
      });

      // then
      expect(result.valid).toBe(false);
    });

    it('should reject an unknown patch field', () => {
      // given / when
      const result = validateUpdateUserEntryPayload({
        uid: 'u',
        entryId: 'e',
        patch: { repss: 30 },
      });

      // then
      expect(result).toEqual({
        valid: false,
        error: 'unknown patch field: repss',
      });
    });

    it('should reject an empty patch', () => {
      // given / when
      const result = validateUpdateUserEntryPayload({
        uid: 'u',
        entryId: 'e',
        patch: {},
      });

      // then
      expect(result.valid).toBe(false);
    });

    it('should reject a non-finite numeric field', () => {
      // given / when
      const result = validateUpdateUserEntryPayload({
        uid: 'u',
        entryId: 'e',
        patch: { reps: Number.NaN },
      });

      // then
      expect(result.valid).toBe(false);
    });

    it('should treat a whitespace-only variantId as a clear (null)', () => {
      // given / when
      const result = validateUpdateUserEntryPayload({
        uid: 'u',
        entryId: 'e',
        patch: { variantId: '   ' },
      });

      // then
      expect(result).toEqual({
        valid: true,
        uid: 'u',
        entryId: 'e',
        patch: { variantId: null },
      });
    });

    it('should trim surrounding whitespace from a variantId', () => {
      // given / when
      const result = validateUpdateUserEntryPayload({
        uid: 'u',
        entryId: 'e',
        patch: { variantId: '  bodyweight  ' },
      });

      // then
      expect(result.valid && result.patch.variantId).toBe('bodyweight');
    });

    it('should pass through cleared breakdowns and a cleared variant', () => {
      // given / when
      const result = validateUpdateUserEntryPayload({
        uid: 'u',
        entryId: 'e',
        patch: { sets: [], variantId: null },
      });

      // then
      expect(result).toEqual({
        valid: true,
        uid: 'u',
        entryId: 'e',
        patch: { sets: [], variantId: null },
      });
    });

    it('should reject a non-number in a breakdown array', () => {
      // given / when
      const result = validateUpdateUserEntryPayload({
        uid: 'u',
        entryId: 'e',
        patch: { sets: [10, 'x'] },
      });

      // then
      expect(result.valid).toBe(false);
    });

    it('should reject missing uid, entryId, or patch', () => {
      // given / when / then
      expect(
        validateUpdateUserEntryPayload({ entryId: 'e', patch: { reps: 1 } })
          .valid
      ).toBe(false);
      expect(
        validateUpdateUserEntryPayload({ uid: 'u', patch: { reps: 1 } }).valid
      ).toBe(false);
      expect(
        validateUpdateUserEntryPayload({ uid: 'u', entryId: 'e' }).valid
      ).toBe(false);
    });
  });

  describe('toIsoString', () => {
    it('should pass through an ISO string unchanged', () => {
      // given / when / then
      expect(toIsoString('2026-04-01T10:00:00.000Z')).toBe(
        '2026-04-01T10:00:00.000Z'
      );
    });

    it('should convert a Firestore Timestamp-like value via toDate()', () => {
      // given
      const date = new Date('2026-04-01T10:00:00.000Z');
      const timestamp = { toDate: () => date };

      // when / then
      expect(toIsoString(timestamp)).toBe('2026-04-01T10:00:00.000Z');
    });

    it('should return undefined for non-string, non-timestamp values', () => {
      // given / when / then
      expect(toIsoString(undefined)).toBeUndefined();
      expect(toIsoString(null)).toBeUndefined();
      expect(toIsoString(42)).toBeUndefined();
      expect(toIsoString({})).toBeUndefined();
    });

    it('should drop a malformed/non-ISO string instead of passing it through', () => {
      // given / when / then — the admin UI feeds these to DatePipe, which
      // throws on an unparseable date, so a bad legacy value must not survive.
      expect(toIsoString('not a date')).toBeUndefined();
      expect(toIsoString('2026-04-01')).toBeUndefined();
      expect(toIsoString('2026-04-01T10:00:00')).toBeUndefined();
    });
  });

  describe('serializeEntry', () => {
    it('should project allowlisted fields and set _id from the doc id', () => {
      // given
      const data = {
        userId: 'user-1',
        exerciseId: 'legs.squats',
        variantId: 'weighted',
        source: 'web',
        timestamp: '2026-04-01T10:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
        reps: 30,
        weightKg: 20,
        sets: [10, 10, 10],
      };

      // when
      const entry = serializeEntry('e1', data);

      // then
      expect(entry).toEqual({
        _id: 'e1',
        userId: 'user-1',
        exerciseId: 'legs.squats',
        variantId: 'weighted',
        source: 'web',
        timestamp: '2026-04-01T10:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
        reps: 30,
        weightKg: 20,
        sets: [10, 10, 10],
      });
    });

    it('should coerce a legacy Firestore Timestamp field to an ISO string', () => {
      // given
      const data = {
        userId: 'user-1',
        exerciseId: 'pushup',
        timestamp: { toDate: () => new Date('2026-04-01T10:00:00.000Z') },
      };

      // when
      const entry = serializeEntry('e1', data);

      // then
      expect(entry.timestamp).toBe('2026-04-01T10:00:00.000Z');
    });

    it('should drop non-JSON field shapes and non-finite numbers', () => {
      // given
      const data = {
        userId: 'user-1',
        exerciseId: 'pushup',
        reps: Number.NaN,
        weightKg: Number.POSITIVE_INFINITY,
        durationSec: 42,
        sets: [10, Number.NaN, 20],
        ref: { path: 'exerciseEntries/e1' },
        _id: 'stray-id',
      };

      // when
      const entry = serializeEntry('e1', data);

      // then
      expect(entry._id).toBe('e1');
      expect('reps' in entry).toBe(false);
      expect('weightKg' in entry).toBe(false);
      expect('ref' in entry).toBe(false);
      expect(entry.durationSec).toBe(42);
      expect(entry.sets).toEqual([10, 20]);
    });
  });
});
