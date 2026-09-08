import {
  hasSnoozeState,
  SNOOZE_FIELDS,
  snoozeDeletionPatch,
} from './snooze-cleanup';

describe('push/snooze-cleanup', () => {
  describe('hasSnoozeState', () => {
    it('should ignore a document the snooze never touched', () => {
      // given a dispatch state with only the fields still in use
      const data = { uid: 'u1', lastSentAt: 1, inProgress: false };

      // then there is nothing to clean up
      expect(hasSnoozeState(data)).toBe(false);
    });

    it.each(SNOOZE_FIELDS)('should spot a leftover %s', (field) => {
      // given a document carrying one of the retired fields
      expect(hasSnoozeState({ uid: 'u1', [field]: 1 })).toBe(true);
    });

    it('should count a field explicitly set to null', () => {
      // given a doc where the snooze was cleared but the key stayed
      // then it still occupies the document, which is what is being removed
      expect(hasSnoozeState({ snoozedUntil: null })).toBe(true);
    });

    it('should handle a missing document body', () => {
      expect(hasSnoozeState(undefined)).toBe(false);
      expect(hasSnoozeState({})).toBe(false);
    });
  });

  describe('snoozeDeletionPatch', () => {
    it('should remove every field the snooze wrote, and nothing else', () => {
      // given the caller's delete sentinel
      const patch = snoozeDeletionPatch('DELETE');

      // then each retired field is targeted, and only those
      expect(Object.keys(patch).sort()).toEqual([...SNOOZE_FIELDS].sort());
      expect(Object.values(patch)).toEqual(SNOOZE_FIELDS.map(() => 'DELETE'));
    });
  });
});
