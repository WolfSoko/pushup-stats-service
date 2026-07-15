import { describe, it, expect } from '@jest/globals';
import {
  MAX_USER_ENTRIES_LIMIT,
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
});
