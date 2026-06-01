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

  it('should route every leaderboard-eligible catalog exercise to a ranked value field', () => {
    // given each catalog exercise
    for (const def of EXERCISE_CATALOG) {
      if (!supportsExerciseLeaderboard(def.measurement)) continue;
      // when
      const field = exerciseValueFieldFor(def.measurement);
      // then
      expect(VALUE_FIELDS.has(field)).toBe(true);
    }
  });

  it('should exclude only weight-measured exercises from leaderboards', () => {
    // given
    const measurements: MeasurementType[] = [
      'reps',
      'time',
      'distance',
      'distance-time',
      'weight',
    ];
    // when / then
    for (const m of measurements) {
      expect(supportsExerciseLeaderboard(m)).toBe(m !== 'weight');
    }
  });

  it('should derive the value field the same way the client does', () => {
    // given each measurement type / when mapped / then it matches the client
    // routing. `weight` is filtered out upstream by
    // supportsExerciseLeaderboard; the fold only keeps the return type total.
    expect(exerciseValueFieldFor('reps')).toBe('reps');
    expect(exerciseValueFieldFor('time')).toBe('durationSec');
    expect(exerciseValueFieldFor('distance')).toBe('distanceM');
    expect(exerciseValueFieldFor('distance-time')).toBe('distanceM');
    expect(exerciseValueFieldFor('weight')).toBe('reps');
  });
});
