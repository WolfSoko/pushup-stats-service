import { type ExerciseEntry } from '@pu-stats/models';
import {
  adminEntrySortValue,
  buildEntryPatch,
  companionField,
  primaryValue,
} from './user-entries.helpers';

function repsEntry(overrides: Partial<ExerciseEntry> = {}): ExerciseEntry {
  return {
    _id: 'e1',
    userId: 'u1',
    exerciseId: 'legs.squats',
    timestamp: '2026-04-01T10:00:00.000Z',
    reps: 30,
    source: 'web',
    ...overrides,
  };
}

function runningEntry(overrides: Partial<ExerciseEntry> = {}): ExerciseEntry {
  return {
    _id: 'e2',
    userId: 'u1',
    exerciseId: 'cardio.running',
    timestamp: '2026-04-02T08:00:00.000Z',
    distanceM: 5000,
    durationSec: 1500,
    source: 'web',
    ...overrides,
  };
}

describe('user-entries.helpers', () => {
  describe('primaryValue', () => {
    it('should read the measurement value field for a known exercise', () => {
      // given / when / then
      expect(primaryValue(repsEntry())).toBe(30);
      expect(primaryValue(runningEntry())).toBe(5000);
    });

    it('should fall back to a raw value for an unknown exercise', () => {
      // given
      const entry = repsEntry({ exerciseId: 'gone.forever', reps: 7 });

      // when / then
      expect(primaryValue(entry)).toBe(7);
    });
  });

  describe('companionField', () => {
    it('should report durationSec for distance-time and none for reps', () => {
      // given / when / then
      expect(companionField(runningEntry())).toBe('durationSec');
      expect(companionField(repsEntry())).toBeUndefined();
    });
  });

  describe('adminEntrySortValue', () => {
    it('should sort timestamp as an epoch number', () => {
      // given
      const entry = repsEntry({ timestamp: '2026-04-01T10:00:00.000Z' });

      // when / then
      expect(adminEntrySortValue(entry, 'timestamp')).toBe(
        new Date('2026-04-01T10:00:00.000Z').getTime()
      );
    });

    it('should normalise a malformed timestamp to 0', () => {
      // given
      const entry = repsEntry({ timestamp: 'not-a-date' });

      // when / then — NaN would make MatSort unstable
      expect(adminEntrySortValue(entry, 'timestamp')).toBe(0);
    });

    it('should sort value by the primary measurement number', () => {
      // given / when / then
      expect(adminEntrySortValue(repsEntry({ reps: 42 }), 'value')).toBe(42);
    });

    it('should sort source case-insensitively', () => {
      // given / when / then
      expect(
        adminEntrySortValue(repsEntry({ source: 'ANDROID' }), 'source')
      ).toBe('android');
    });
  });

  describe('buildEntryPatch', () => {
    it('should return null when nothing changed', () => {
      // given
      const entry = repsEntry();

      // when
      const patch = buildEntryPatch(entry, {
        timestamp: entry.timestamp,
        value: entry.reps ?? null,
        companion: null,
      });

      // then
      expect(patch).toBeNull();
    });

    it('should patch only the changed timestamp', () => {
      // given
      const entry = repsEntry();

      // when
      const patch = buildEntryPatch(entry, {
        timestamp: '2026-05-01T09:00:00.000Z',
        value: entry.reps ?? null,
        companion: null,
      });

      // then
      expect(patch).toEqual({ timestamp: '2026-05-01T09:00:00.000Z' });
    });

    it('should patch the primary value into the measurement field', () => {
      // given
      const entry = repsEntry();

      // when
      const patch = buildEntryPatch(entry, {
        timestamp: entry.timestamp,
        value: 45,
        companion: null,
      });

      // then
      expect(patch).toEqual({ reps: 45 });
    });

    it('should patch the companion field for a distance-time entry', () => {
      // given
      const entry = runningEntry();

      // when
      const patch = buildEntryPatch(entry, {
        timestamp: entry.timestamp,
        value: entry.distanceM ?? null,
        companion: 1600,
      });

      // then
      expect(patch).toEqual({ durationSec: 1600 });
    });
  });
});
