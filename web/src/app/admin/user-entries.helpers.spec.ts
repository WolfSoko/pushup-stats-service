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

    it('should express the timestamp in local time while preserving the instant', () => {
      // given a UTC-stored entry
      const entry = repsEntry({ timestamp: '2026-04-01T10:00:00.000Z' });

      // when
      const data = entryToDialogData(entry);

      // then — the dialog seeds from a tz-aware string that denotes the same
      // instant (so an unchanged save round-trips), regardless of runner tz
      expect(new Date(data.timestamp).getTime()).toBe(
        new Date(entry.timestamp).getTime()
      );
    });
  });

  describe('dialogResultToPatch', () => {
    // A UTC entry and its same-instant local-offset echo, so tests can isolate
    // value diffs from the timestamp field.
    const sameInstantTs = '2026-04-03T09:00:00.000+02:00'; // == 07:00:00Z

    it('should emit only the fields that actually changed', () => {
      // given a pushup edited: reps + source + variant changed, time unchanged
      const result: PushupEntryDialogResult = {
        kind: 'pushup',
        timestamp: sameInstantTs,
        reps: 25,
        sets: [25],
        source: 'quick-add',
        type: 'wide',
      };

      // when
      const patch = dialogResultToPatch(pushupEntry(), result);

      // then — no `timestamp` (same instant), only the changed values
      expect(patch).toEqual({
        reps: 25,
        source: 'quick-add',
        variantId: 'wide',
      });
    });

    it('should return an empty patch when nothing changed', () => {
      // given / when — every field equals the stored entry
      const patch = dialogResultToPatch(pushupEntry(), {
        kind: 'pushup',
        timestamp: sameInstantTs,
        reps: 20,
        sets: [20],
        source: 'web',
        type: '',
      });

      // then
      expect(patch).toEqual({});
    });

    it('should include the timestamp only when the instant moved', () => {
      // given a genuinely different instant
      const patch = dialogResultToPatch(pushupEntry(), {
        kind: 'pushup',
        timestamp: '2026-04-03T09:30:00.000+02:00', // 07:30Z ≠ 07:00Z
        reps: 20,
        sets: [20],
        source: 'web',
        type: '',
      });

      // then
      expect(patch).toEqual({ timestamp: '2026-04-03T09:30:00.000+02:00' });
    });

    it('should clear a pushup variant when the type is emptied', () => {
      // given / when — only the variant changes
      const patch = dialogResultToPatch(pushupEntry({ variantId: 'wide' }), {
        kind: 'pushup',
        timestamp: sameInstantTs,
        reps: 20,
        sets: [20],
        source: 'web',
        type: '',
      });

      // then
      expect(patch).toEqual({ variantId: null });
    });

    it('should clear a stored multi-set breakdown when collapsed to one set', () => {
      // given a pushup that had sets, edited down to a single set
      const patch = dialogResultToPatch(pushupEntry({ sets: [10, 10] }), {
        kind: 'pushup',
        timestamp: sameInstantTs,
        reps: 20,
        sets: [20],
        source: 'web',
        type: '',
      });

      // then — `[]` is the explicit clear sentinel (maps to deleteField)
      expect(patch).toEqual({ sets: [] });
    });

    it('should map a changed reps exercise result to reps + variant', () => {
      // given
      const result: ExerciseEntryDialogResult = {
        kind: 'exercise',
        timestamp: '2026-04-01T12:00:00.000+02:00', // == entry 10:00Z
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
      expect(patch).toEqual({ reps: 45, variantId: 'weighted' });
    });

    it('should map a distance-time result to the changed distance + duration', () => {
      // given
      const result: ExerciseEntryDialogResult = {
        kind: 'exercise',
        timestamp: '2026-04-02T10:00:00.000+02:00', // == entry 08:00Z
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
      expect(patch).toEqual({ distanceM: 6000, durationSec: 1800 });
    });

    it('should keep only the timestamp for a stale (uncatalogued) exercise id', () => {
      // given an entry whose exercise id no longer resolves
      const entry = repsEntry({ exerciseId: 'gone.forever' });

      // when — the dialog still submits reps, but it must be dropped
      const patch = dialogResultToPatch(entry, {
        kind: 'exercise',
        timestamp: '2026-04-01T13:00:00.000+02:00', // 11:00Z ≠ 10:00Z
        exerciseId: 'gone.forever',
        measurement: 'reps',
        reps: 99,
        sets: [99],
        intervals: [],
      });

      // then
      expect(patch).toEqual({ timestamp: '2026-04-01T13:00:00.000+02:00' });
    });
  });
});
