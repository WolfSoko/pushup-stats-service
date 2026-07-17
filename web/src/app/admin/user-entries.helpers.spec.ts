import { type ExerciseEntry } from '@pu-stats/models';
import {
  adminEntrySortValue,
  dialogResultToPatch,
  entryToDialogData,
  primaryValue,
} from './user-entries.helpers';
import {
  type ExerciseEntryDialogResult,
  type PushupEntryDialogResult,
} from '../stats/components/training-entry-dialog/training-entry-dialog.models';

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

function pushupEntry(overrides: Partial<ExerciseEntry> = {}): ExerciseEntry {
  return {
    _id: 'e3',
    userId: 'u1',
    exerciseId: 'pushup',
    timestamp: '2026-04-03T07:00:00.000Z',
    reps: 20,
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

  describe('entryToDialogData', () => {
    it('should open a pushup entry in pushup mode', () => {
      // given / when
      const data = entryToDialogData(pushupEntry({ variantId: 'diamond' }));

      // then
      expect(data).toMatchObject({
        kind: 'pushup',
        reps: 20,
        source: 'web',
        type: 'diamond',
      });
    });

    it('should open a catalog exercise in exercise mode with its id', () => {
      // given / when
      const data = entryToDialogData(runningEntry());

      // then
      expect(data).toMatchObject({
        kind: 'exercise',
        exerciseId: 'cardio.running',
        distanceM: 5000,
        durationSec: 1500,
      });
    });
  });

  describe('dialogResultToPatch', () => {
    it('should map a pushup result to reps/source/variant + timestamp', () => {
      // given
      const result: PushupEntryDialogResult = {
        kind: 'pushup',
        timestamp: '2026-04-03T09:00:00.000+02:00',
        reps: 25,
        sets: [25],
        source: 'quick-add',
        type: 'wide',
      };

      // when
      const patch = dialogResultToPatch(pushupEntry(), result);

      // then
      expect(patch).toEqual({
        timestamp: '2026-04-03T09:00:00.000+02:00',
        reps: 25,
        source: 'quick-add',
        variantId: 'wide',
      });
    });

    it('should clear a pushup variant when the type is emptied', () => {
      // given / when
      const patch = dialogResultToPatch(pushupEntry({ variantId: 'wide' }), {
        kind: 'pushup',
        timestamp: '2026-04-03T09:00:00.000+02:00',
        reps: 25,
        sets: [25],
        source: 'web',
        type: '',
      });

      // then
      expect(patch['variantId']).toBeNull();
    });

    it('should clear a stored multi-set breakdown when collapsed to one set', () => {
      // given a pushup that had sets, edited down to a single set
      const patch = dialogResultToPatch(pushupEntry({ sets: [10, 10] }), {
        kind: 'pushup',
        timestamp: '2026-04-03T09:00:00.000+02:00',
        reps: 20,
        sets: [20],
        source: 'web',
        type: '',
      });

      // then — `[]` is the explicit clear sentinel (maps to deleteField)
      expect(patch['sets']).toEqual([]);
    });

    it('should map a reps exercise result to reps + variant', () => {
      // given
      const result: ExerciseEntryDialogResult = {
        kind: 'exercise',
        timestamp: '2026-04-01T11:00:00.000+02:00',
        exerciseId: 'legs.squats',
        measurement: 'reps',
        reps: 45,
        sets: [45],
        intervals: [],
        variantId: 'weighted',
      };

      // when
      const patch = dialogResultToPatch(repsEntry(), result);

      // then — source is not part of an exercise patch (kept as-is server-side)
      expect(patch).toEqual({
        timestamp: '2026-04-01T11:00:00.000+02:00',
        reps: 45,
        variantId: 'weighted',
      });
    });

    it('should map a distance-time result to distance + duration', () => {
      // given
      const result: ExerciseEntryDialogResult = {
        kind: 'exercise',
        timestamp: '2026-04-02T09:00:00.000+02:00',
        exerciseId: 'cardio.running',
        measurement: 'distance-time',
        reps: 0,
        sets: [],
        intervals: [],
        distanceM: 6000,
        durationSec: 1800,
      };

      // when
      const patch = dialogResultToPatch(runningEntry(), result);

      // then
      expect(patch).toMatchObject({
        distanceM: 6000,
        durationSec: 1800,
        timestamp: '2026-04-02T09:00:00.000+02:00',
      });
    });
  });
});
