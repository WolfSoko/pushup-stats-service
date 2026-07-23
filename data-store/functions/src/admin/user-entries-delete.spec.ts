import { describe, it, expect } from '@jest/globals';
import {
  MAX_DELETE_ENTRY_IDS,
  validateDeleteUserEntriesPayload,
} from './user-entries-delete';

describe('admin/user-entries-delete', () => {
  describe('validateDeleteUserEntriesPayload', () => {
    it('should accept a uid with one or more trimmed entryIds', () => {
      // given / when
      const result = validateDeleteUserEntriesPayload({
        uid: ' user-1 ',
        entryIds: [' entry-1 ', 'entry-2'],
      });

      // then
      expect(result).toEqual({
        valid: true,
        uid: 'user-1',
        entryIds: ['entry-1', 'entry-2'],
      });
    });

    it('should reject a missing or empty uid', () => {
      // given / when / then
      expect(validateDeleteUserEntriesPayload({ entryIds: ['e'] }).valid).toBe(
        false
      );
      expect(
        validateDeleteUserEntriesPayload({ uid: '  ', entryIds: ['e'] }).valid
      ).toBe(false);
      expect(validateDeleteUserEntriesPayload(null).valid).toBe(false);
    });

    it('should reject a missing, empty, or non-array entryIds', () => {
      // given / when / then
      expect(validateDeleteUserEntriesPayload({ uid: 'u' }).valid).toBe(false);
      expect(
        validateDeleteUserEntriesPayload({ uid: 'u', entryIds: [] }).valid
      ).toBe(false);
      expect(
        validateDeleteUserEntriesPayload({ uid: 'u', entryIds: 'e' }).valid
      ).toBe(false);
    });

    it('should reject entryIds exceeding the maximum batch size', () => {
      // given
      const entryIds = Array.from(
        { length: MAX_DELETE_ENTRY_IDS + 1 },
        (_, i) => `e${i}`
      );

      // when
      const result = validateDeleteUserEntriesPayload({ uid: 'u', entryIds });

      // then
      expect(result.valid).toBe(false);
    });

    it('should reject a non-string or blank entryId in the array', () => {
      // given / when / then
      expect(
        validateDeleteUserEntriesPayload({ uid: 'u', entryIds: ['e', 42] })
          .valid
      ).toBe(false);
      expect(
        validateDeleteUserEntriesPayload({ uid: 'u', entryIds: ['e', '   '] })
          .valid
      ).toBe(false);
    });
  });
});
