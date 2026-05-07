import {
  exerciseEntryToUnified,
  pushupRecordToUnified,
  unifiedEntryFilterKey,
} from './unified-entry.models';
import type { ExerciseEntry } from './exercise.models';
import type { PushupRecord } from './pushup.models';

describe('pushupRecordToUnified', () => {
  describe('Given a fully populated pushup record', () => {
    it('maps every persisted field through and tags kind as "pushup"', () => {
      const r: PushupRecord = {
        _id: 'p1',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 25,
        sets: [10, 15],
        source: 'web',
        type: 'diamond',
        createdAt: '2026-04-15T10:00:01Z',
        updatedAt: '2026-04-15T10:00:01Z',
      };
      expect(pushupRecordToUnified(r)).toEqual({
        kind: 'pushup',
        _id: 'p1',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 25,
        sets: [10, 15],
        source: 'web',
        variantType: 'diamond',
        createdAt: '2026-04-15T10:00:01Z',
        updatedAt: '2026-04-15T10:00:01Z',
      });
    });
  });

  describe('Given a pushup record without optional fields', () => {
    it('omits sets/createdAt/updatedAt and surfaces null for missing type', () => {
      const r: PushupRecord = {
        _id: 'p2',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 10,
        source: 'web',
      };
      const out = pushupRecordToUnified(r);
      expect(out.kind).toBe('pushup');
      expect(out.variantType).toBeNull();
      expect('sets' in out).toBe(false);
      expect('createdAt' in out).toBe(false);
      expect('updatedAt' in out).toBe(false);
    });
  });
});

describe('exerciseEntryToUnified', () => {
  describe('Given a reps-measured exercise entry', () => {
    it('maps reps + sets and tags kind as "exercise"', () => {
      const e: ExerciseEntry = {
        _id: 'e1',
        userId: 'u1',
        exerciseId: 'abs.situps',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 30,
        sets: [10, 10, 10],
        source: 'web',
      };
      expect(exerciseEntryToUnified(e)).toEqual({
        kind: 'exercise',
        _id: 'e1',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 30,
        sets: [10, 10, 10],
        source: 'web',
        exerciseId: 'abs.situps',
      });
    });
  });

  describe('Given an exercise entry without reps (e.g. future plank)', () => {
    it('surfaces reps as 0 so the table cell stays numeric', () => {
      const e: ExerciseEntry = {
        _id: 'e2',
        userId: 'u1',
        exerciseId: 'plank.standard',
        timestamp: '2026-04-15T10:00:00Z',
        durationSec: 60,
        source: 'web',
      };
      const out = exerciseEntryToUnified(e);
      expect(out.reps).toBe(0);
      expect(out.durationSec).toBe(60);
    });
  });

  describe('Given an entry with measurement companions', () => {
    it('passes durationSec, distanceM, weightKg through verbatim', () => {
      const e: ExerciseEntry = {
        _id: 'e3',
        userId: 'u1',
        exerciseId: 'cardio.running',
        timestamp: '2026-04-15T10:00:00Z',
        distanceM: 5000,
        durationSec: 1650,
        source: 'web',
      };
      const out = exerciseEntryToUnified(e);
      expect(out.distanceM).toBe(5000);
      expect(out.durationSec).toBe(1650);
    });

    it('omits companions that are undefined on the source doc', () => {
      const e: ExerciseEntry = {
        _id: 'e4',
        userId: 'u1',
        exerciseId: 'abs.situps',
        timestamp: '2026-04-15T10:00:00Z',
        reps: 10,
        source: 'web',
      };
      const out = exerciseEntryToUnified(e);
      expect('durationSec' in out).toBe(false);
      expect('distanceM' in out).toBe(false);
      expect('weightKg' in out).toBe(false);
    });
  });
});

describe('unifiedEntryFilterKey', () => {
  it('returns "pushup" for any pushup-kind entry regardless of variant', () => {
    expect(
      unifiedEntryFilterKey({
        kind: 'pushup',
        _id: 'p',
        timestamp: 't',
        reps: 1,
        source: 'web',
        variantType: 'diamond',
      })
    ).toBe('pushup');
    expect(
      unifiedEntryFilterKey({
        kind: 'pushup',
        _id: 'p',
        timestamp: 't',
        reps: 1,
        source: 'web',
        variantType: null,
      })
    ).toBe('pushup');
  });

  it('returns the exerciseId for exercise-kind entries', () => {
    expect(
      unifiedEntryFilterKey({
        kind: 'exercise',
        _id: 'e',
        timestamp: 't',
        reps: 1,
        source: 'web',
        exerciseId: 'legs.squats',
      })
    ).toBe('legs.squats');
  });
});

// ── Additional regression / boundary tests ────────────────────────────────

describe('pushupRecordToUnified — boundary cases', () => {
  it('handles a reps value of 0 without coercion', () => {
    const r: PushupRecord = {
      _id: 'p-zero',
      timestamp: '2026-04-15T10:00:00Z',
      reps: 0,
      source: 'web',
    };
    expect(pushupRecordToUnified(r).reps).toBe(0);
  });

  it('preserves an explicit empty-string type as null (undefined coerced)', () => {
    // PushupRecord.type is optional; `undefined` becomes null via `?? null`
    const r: PushupRecord = {
      _id: 'p-no-type',
      timestamp: '2026-04-15T10:00:00Z',
      reps: 5,
      source: 'mobile',
    };
    expect(pushupRecordToUnified(r).variantType).toBeNull();
  });

  it('always sets kind to "pushup" — never "exercise"', () => {
    const r: PushupRecord = { _id: 'p', timestamp: 't', reps: 1, source: 'w' };
    expect(pushupRecordToUnified(r).kind).toBe('pushup');
  });
});

describe('exerciseEntryToUnified — boundary cases', () => {
  it('preserves a variantId on the output when the source entry has one', () => {
    const e: ExerciseEntry = {
      _id: 'e-variant',
      userId: 'u1',
      exerciseId: 'pushup',
      variantId: 'wide',
      timestamp: '2026-04-15T10:00:00Z',
      reps: 20,
      source: 'web',
    };
    const out = exerciseEntryToUnified(e);
    expect(out.variantId).toBe('wide');
  });

  it('omits variantId from the output when the source entry has none', () => {
    const e: ExerciseEntry = {
      _id: 'e-no-variant',
      userId: 'u1',
      exerciseId: 'abs.situps',
      timestamp: '2026-04-15T10:00:00Z',
      reps: 10,
      source: 'web',
    };
    expect('variantId' in exerciseEntryToUnified(e)).toBe(false);
  });

  it('preserves createdAt/updatedAt when present', () => {
    const e: ExerciseEntry = {
      _id: 'e-ts',
      userId: 'u1',
      exerciseId: 'abs.situps',
      timestamp: '2026-04-15T10:00:00Z',
      reps: 10,
      source: 'web',
      createdAt: '2026-04-15T10:00:01Z',
      updatedAt: '2026-04-15T10:05:00Z',
    };
    const out = exerciseEntryToUnified(e);
    expect(out.createdAt).toBe('2026-04-15T10:00:01Z');
    expect(out.updatedAt).toBe('2026-04-15T10:05:00Z');
  });

  it('omits sets from the output when the source entry has no sets', () => {
    const e: ExerciseEntry = {
      _id: 'e-no-sets',
      userId: 'u1',
      exerciseId: 'abs.situps',
      timestamp: '2026-04-15T10:00:00Z',
      reps: 25,
      source: 'web',
    };
    expect('sets' in exerciseEntryToUnified(e)).toBe(false);
  });

  it('always sets kind to "exercise" — never "pushup"', () => {
    const e: ExerciseEntry = {
      _id: 'e-kind',
      userId: 'u1',
      exerciseId: 'legs.squats',
      timestamp: '2026-04-15T10:00:00Z',
      reps: 10,
      source: 'web',
    };
    expect(exerciseEntryToUnified(e).kind).toBe('exercise');
  });

  it('passes weightKg through when the source entry has one', () => {
    const e: ExerciseEntry = {
      _id: 'e-weight',
      userId: 'u1',
      exerciseId: 'strength.squat',
      timestamp: '2026-04-15T10:00:00Z',
      reps: 5,
      weightKg: 80,
      source: 'web',
    };
    const out = exerciseEntryToUnified(e);
    expect(out.weightKg).toBe(80);
  });
});
