import { ExerciseDefinition } from '@pu-stats/models';
import { ExerciseEntryDialogResult } from './training-entry-dialog.models';

export interface BuildExerciseInput {
  timestamp: string;
  def: ExerciseDefinition;
  variantPatch: { variantId?: string | null };
  sets: ReadonlyArray<number>;
  intervals: ReadonlyArray<number>;
  intervalDurationsSec: ReadonlyArray<number>;
  durationSec: number | null;
  distanceM: number | null;
}

/**
 * Keeps `intervalDurationsSec` index-aligned with the filtered `intervals`
 * (dropping a split time wherever its interval was empty), then drops the
 * whole array to `[]` if every surviving split is `0` — the "no splits
 * entered" clear sentinel, same convention as `intervals` itself.
 */
function alignedIntervalDurations(
  intervals: ReadonlyArray<number>,
  durations: ReadonlyArray<number>
): number[] {
  const aligned = intervals
    .map((v, i) => (v > 0 ? (durations[i] ?? 0) : null))
    .filter((v): v is number => v !== null);
  return aligned.some((v) => v > 0) ? aligned : [];
}

export function buildExerciseResult(
  input: BuildExerciseInput
): ExerciseEntryDialogResult | null {
  const { def, variantPatch, durationSec, distanceM } = input;
  const measurement = def.measurement;
  const validIntervals = input.intervals.filter((s) => s > 0);

  if (measurement === 'time') {
    if (durationSec === null || durationSec <= 0) return null;
    return {
      kind: 'exercise',
      exerciseId: def.id,
      measurement,
      ...variantPatch,
      timestamp: input.timestamp,
      reps: 0,
      sets: [],
      intervals: validIntervals,
      intervalDurationsSec: [],
      durationSec,
    };
  }

  if (measurement === 'distance-time') {
    if (
      distanceM === null ||
      distanceM <= 0 ||
      durationSec === null ||
      durationSec <= 0
    )
      return null;
    return {
      kind: 'exercise',
      exerciseId: def.id,
      measurement,
      ...variantPatch,
      timestamp: input.timestamp,
      reps: 0,
      sets: [],
      intervals: validIntervals,
      intervalDurationsSec: alignedIntervalDurations(
        input.intervals,
        input.intervalDurationsSec
      ),
      distanceM,
      durationSec,
    };
  }

  if (measurement === 'distance') {
    // Dead today (no pure-`distance` catalog exercise), kept in lockstep with
    // the data model so a future distance-only exercise emits `intervals`.
    // No split-time companion for this branch — that's `distance-time`
    // only (see `validateExerciseEntry`).
    if (distanceM === null || distanceM <= 0) return null;
    return {
      kind: 'exercise',
      exerciseId: def.id,
      measurement,
      ...variantPatch,
      timestamp: input.timestamp,
      reps: 0,
      sets: [],
      intervals: validIntervals,
      intervalDurationsSec: [],
      distanceM,
    };
  }

  const validSets = input.sets.filter((s) => s > 0);
  const reps = validSets.reduce((sum, s) => sum + s, 0);
  if (reps <= 0) return null;
  return {
    kind: 'exercise',
    exerciseId: def.id,
    measurement,
    ...variantPatch,
    timestamp: input.timestamp,
    reps,
    sets: validSets,
    intervals: [],
    intervalDurationsSec: [],
  };
}
