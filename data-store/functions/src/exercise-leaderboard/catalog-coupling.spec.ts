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

  it('routes every leaderboard-eligible catalog exercise to a ranked value field', () => {
    for (const def of EXERCISE_CATALOG) {
      if (!supportsExerciseLeaderboard(def.measurement)) continue;
      expect(VALUE_FIELDS.has(exerciseValueFieldFor(def.measurement))).toBe(
        true
      );
    }
  });

  it('excludes only weight-measured exercises from leaderboards', () => {
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

  it('derives the value field the same way the client does', () => {
    expect(exerciseValueFieldFor('reps')).toBe('reps');
    expect(exerciseValueFieldFor('time')).toBe('durationSec');
    expect(exerciseValueFieldFor('distance')).toBe('distanceM');
    expect(exerciseValueFieldFor('distance-time')).toBe('distanceM');
    // `weight` is filtered out upstream by supportsExerciseLeaderboard;
    // the fold only keeps the return type total.
    expect(exerciseValueFieldFor('weight')).toBe('reps');
  });
});
