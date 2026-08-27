import { ExerciseDefinition } from '@pu-stats/models';
import { buildExerciseResult } from './exercise-result.builder';
import { buildVariantPatch } from './training-entry-dialog.submit';

const repsDef: ExerciseDefinition = {
  id: 'abs.situps',
  categoryId: 'core',
  measurement: 'reps',
  min: 1,
  max: 500,
  unit: 'reps',
};
const timeDef: ExerciseDefinition = {
  id: 'plank.standard',
  categoryId: 'core',
  measurement: 'time',
  min: 1,
  max: 3600,
  unit: 's',
};
const distanceTimeDef: ExerciseDefinition = {
  id: 'cardio.running',
  categoryId: 'cardio',
  measurement: 'distance-time',
  min: 100,
  max: 100000,
  unit: 'm',
};
const distanceDef: ExerciseDefinition = {
  ...distanceTimeDef,
  measurement: 'distance',
};

describe('buildExerciseResult — measurement branches', () => {
  it('should emit intervals + empty sets for a time measurement', () => {
    // given / when
    const result = buildExerciseResult({
      timestamp: 't',
      def: timeDef,
      variantPatch: {},
      sets: [99],
      intervals: [30, 0, 30],
      intervalDurationsSec: [],
      durationSec: 90,
      distanceM: null,
    });

    // then
    expect(result).toMatchObject({
      kind: 'exercise',
      exerciseId: 'plank.standard',
      measurement: 'time',
      durationSec: 90,
      intervals: [30, 30],
      sets: [],
      reps: 0,
    });
  });

  it('should return null for a time measurement without a duration', () => {
    // given / when
    const result = buildExerciseResult({
      timestamp: 't',
      def: timeDef,
      variantPatch: {},
      sets: [],
      intervals: [],
      intervalDurationsSec: [],
      durationSec: null,
      distanceM: null,
    });

    // then
    expect(result).toBeNull();
  });

  it('should emit distance + duration for a distance-time measurement', () => {
    // given / when
    const result = buildExerciseResult({
      timestamp: 't',
      def: distanceTimeDef,
      variantPatch: {},
      sets: [],
      intervals: [],
      intervalDurationsSec: [],
      durationSec: 1500,
      distanceM: 5250,
    });

    // then
    expect(result).toMatchObject({
      measurement: 'distance-time',
      distanceM: 5250,
      durationSec: 1500,
      intervals: [],
      sets: [],
      reps: 0,
    });
  });

  it('should emit index-aligned split times for a distance-time measurement', () => {
    // given / when
    const result = buildExerciseResult({
      timestamp: 't',
      def: distanceTimeDef,
      variantPatch: {},
      sets: [],
      intervals: [1000, 1000, 1000],
      intervalDurationsSec: [270, 265, 280],
      durationSec: 815,
      distanceM: 3000,
    });

    // then
    expect(result).toMatchObject({
      measurement: 'distance-time',
      intervals: [1000, 1000, 1000],
      intervalDurationsSec: [270, 265, 280],
    });
  });

  it('should drop a split time whose interval was empty, keeping index alignment', () => {
    // given / when — the middle interval was left blank (0), so it's
    // dropped from `intervals` along with its split time.
    const result = buildExerciseResult({
      timestamp: 't',
      def: distanceTimeDef,
      variantPatch: {},
      sets: [],
      intervals: [1000, 0, 1000],
      intervalDurationsSec: [270, 999, 280],
      durationSec: 550,
      distanceM: 2000,
    });

    // then
    expect(result).toMatchObject({
      intervals: [1000, 1000],
      intervalDurationsSec: [270, 280],
    });
  });

  it('should emit an empty intervalDurationsSec when no split times were entered', () => {
    // given / when
    const result = buildExerciseResult({
      timestamp: 't',
      def: distanceTimeDef,
      variantPatch: {},
      sets: [],
      intervals: [1000, 1000],
      intervalDurationsSec: [0, 0],
      durationSec: 550,
      distanceM: 2000,
    });

    // then
    expect(result?.intervalDurationsSec).toEqual([]);
  });

  it('should emit distance + intervals for a pure distance measurement', () => {
    // given / when — distance has no live catalog entry but stays in
    // lockstep with the model so a future distance-only exercise works.
    const result = buildExerciseResult({
      timestamp: 't',
      def: distanceDef,
      variantPatch: {},
      sets: [],
      intervals: [400, 400],
      intervalDurationsSec: [],
      durationSec: null,
      distanceM: 800,
    });

    // then
    expect(result).toMatchObject({
      measurement: 'distance',
      distanceM: 800,
      intervals: [400, 400],
      sets: [],
      reps: 0,
    });
    expect((result as { durationSec?: number }).durationSec).toBeUndefined();
  });

  it('should emit sets + empty intervals for a strength measurement', () => {
    // given / when
    const result = buildExerciseResult({
      timestamp: 't',
      def: repsDef,
      variantPatch: {},
      sets: [12, 0, 8],
      intervals: [99],
      intervalDurationsSec: [],
      durationSec: null,
      distanceM: null,
    });

    // then
    expect(result).toMatchObject({
      measurement: 'reps',
      reps: 20,
      sets: [12, 8],
      intervals: [],
    });
  });

  it('should return null for a strength measurement with no reps', () => {
    // given / when
    const result = buildExerciseResult({
      timestamp: 't',
      def: repsDef,
      variantPatch: {},
      sets: [0],
      intervals: [],
      intervalDurationsSec: [],
      durationSec: null,
      distanceM: null,
    });

    // then
    expect(result).toBeNull();
  });
});

describe('buildExerciseResult — intervalDurationsSec parallel-array invariant', () => {
  // intervalDurationsSec is index-aligned with intervals: same length, one entry per
  // interval. Any code path that mutates one array must touch the other too. These
  // assertions guard that contract across all builder scenarios.
  it('should keep intervalDurationsSec.length equal to intervals.length when split times are present', () => {
    // given — 3-interval run with all splits filled
    // when
    const result = buildExerciseResult({
      timestamp: 't',
      def: distanceTimeDef,
      variantPatch: {},
      sets: [],
      intervals: [1000, 1000, 1000],
      intervalDurationsSec: [270, 265, 280],
      durationSec: 815,
      distanceM: 3000,
    });

    // then
    expect(result!.intervalDurationsSec!.length).toBe(
      result!.intervals!.length
    );
  });

  it('should keep intervalDurationsSec.length equal to intervals.length after blank intervals are dropped', () => {
    // given — middle interval is blank (0), so builder drops it along with its split
    // when
    const result = buildExerciseResult({
      timestamp: 't',
      def: distanceTimeDef,
      variantPatch: {},
      sets: [],
      intervals: [1000, 0, 1000],
      intervalDurationsSec: [270, 999, 280],
      durationSec: 550,
      distanceM: 2000,
    });

    // then
    expect(result!.intervalDurationsSec!.length).toBe(
      result!.intervals!.length
    );
  });

  it('should keep intervalDurationsSec empty when intervals is empty', () => {
    // given — no interval breakdown
    // when
    const result = buildExerciseResult({
      timestamp: 't',
      def: distanceTimeDef,
      variantPatch: {},
      sets: [],
      intervals: [],
      intervalDurationsSec: [],
      durationSec: 1500,
      distanceM: 5000,
    });

    // then
    expect(result!.intervalDurationsSec!.length).toBe(
      result!.intervals!.length
    );
  });
});

describe('buildExerciseResult — variant patch threading', () => {
  it('should thread the patch through the built exercise result', () => {
    // given / when
    const result = buildExerciseResult({
      timestamp: 't',
      def: repsDef,
      variantPatch: buildVariantPatch('', 'weighted'),
      sets: [10],
      intervals: [],
      intervalDurationsSec: [],
      durationSec: null,
      distanceM: null,
    });

    // then
    expect(result?.variantId).toBeNull();
  });
});
