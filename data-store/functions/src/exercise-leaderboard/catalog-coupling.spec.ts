import { describe, it, expect } from '@jest/globals';
import { EXERCISE_CATALOG, type MeasurementType } from '@pu-stats/models';

import {
  exerciseValueFieldFor,
  supportsExerciseLeaderboard,
  type ExerciseValueField,
} from './logic';

/**
 * Locks the server leaderboard's measurement → value-field routing to the
 * catalog. `exerciseValueFieldFor` derives from `measurementValueField()`
 * in `@pu-stats/models`, so a new `MeasurementType` the ranker doesn't
 * understand surfaces here (and at compile time via the exhaustive switch
 * in the model helper) instead of silently dropping every entry of the
 * new kind from the per-exercise leaderboards.
 */
describe('exercise leaderboard ⇄ catalog measurement coupling', () => {
  const VALUE_FIELDS: ReadonlySet<ExerciseValueField> = new Set([
    'reps',
    'durationSec',
    'distanceM',
  ]);

  it('Given a leaderboard-eligible catalog exercise, When exerciseValueFieldFor maps its measurement, Then the value field is one the ranker caps', () => {
    for (const def of EXERCISE_CATALOG) {
      if (!supportsExerciseLeaderboard(def.measurement)) continue;
      expect(VALUE_FIELDS.has(exerciseValueFieldFor(def.measurement))).toBe(
        true
      );
    }
  });

  it('Given each measurement type, When supportsExerciseLeaderboard is checked, Then only weight is excluded', () => {
    const measurements: MeasurementType[] = [
      'reps',
      'time',
      'distance',
      'distance-time',
      'weight',
    ];
    for (const m of measurements) {
      expect(supportsExerciseLeaderboard(m)).toBe(m !== 'weight');
    }
  });

  it('Given each measurement type, When exerciseValueFieldFor maps it, Then it matches the client value-field routing', () => {
    expect(exerciseValueFieldFor('reps')).toBe('reps');
    expect(exerciseValueFieldFor('time')).toBe('durationSec');
    expect(exerciseValueFieldFor('distance')).toBe('distanceM');
    expect(exerciseValueFieldFor('distance-time')).toBe('distanceM');
    // `weight` is filtered out upstream by supportsExerciseLeaderboard;
    // the fold only keeps the return type total.
    expect(exerciseValueFieldFor('weight')).toBe('reps');
  });
});
