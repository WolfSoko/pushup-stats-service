import {
  COMPANION_BOUNDS,
  ExerciseDefinition,
  MeasurementType,
} from '@pu-stats/models';
import {
  ExerciseEntryDialogResult,
  PushupEntryDialogResult,
} from './training-entry-dialog.models';

export function appendListEntry(list: ReadonlyArray<number>): number[] {
  const last = list[list.length - 1] ?? 0;
  return [...list, last > 0 ? last : 0];
}

// Never leaves the list empty: a removed sole entry collapses back to `[0]`.
export function removeListEntry(
  list: ReadonlyArray<number>,
  index: number
): number[] {
  const next = list.filter((_, i) => i !== index);
  return next.length === 0 ? [0] : next;
}

export function clampListValue(value: string, max = Infinity): number {
  const parsed = Number(value);
  const finite = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  return Math.min(finite, max);
}

/** Caps pushup reps at the same shared per-entry ceiling (500). */
export const PUSHUP_REPS_MAX = COMPANION_BOUNDS.reps.max;

export function normalizeSource(value: string): string {
  const v = (value || '').trim();
  if (!v) return 'web';
  if (v === 'wa') return 'whatsapp';
  return v;
}

export function pushupOverCap(totalReps: number): boolean {
  return totalReps > PUSHUP_REPS_MAX;
}

export interface BuildPushupInput {
  timestamp: string;
  sets: ReadonlyArray<number>;
  type: string;
  source: string;
}

export function canSubmitPushup(totalReps: number): boolean {
  return totalReps > 0 && !pushupOverCap(totalReps);
}

export function buildPushupResult(
  input: BuildPushupInput
): PushupEntryDialogResult | null {
  const validSets = input.sets.filter((s) => s > 0);
  const reps = validSets.reduce((sum, s) => sum + s, 0);
  if (reps <= 0) return null;
  return {
    kind: 'pushup',
    timestamp: input.timestamp,
    reps,
    sets: validSets,
    source: input.source,
    type: input.type,
  };
}

export type OverCapKind = 'distance' | 'duration' | 'value' | null;

export function exerciseOverCapKind(args: {
  measurement: MeasurementType | null;
  max: number;
  distanceM: number | null;
  durationSec: number | null;
  totalReps: number;
}): OverCapKind {
  const { measurement, max, distanceM, durationSec, totalReps } = args;
  if (measurement === 'distance-time') {
    if (distanceM !== null && distanceM > max) return 'distance';
    if (durationSec !== null && durationSec > COMPANION_BOUNDS.durationSec.max)
      return 'duration';
    return null;
  }
  if (measurement === 'time') {
    return durationSec !== null && durationSec > max ? 'value' : null;
  }
  // `distance` is dead in today's catalog but kept consistent with
  // buildExerciseResult's distance branch for a future distance-only exercise.
  if (measurement === 'distance') {
    return distanceM !== null && distanceM > max ? 'distance' : null;
  }
  return totalReps > max ? 'value' : null;
}

export function canSubmitExercise(args: {
  def: ExerciseDefinition | null;
  distanceM: number | null;
  durationSec: number | null;
  totalReps: number;
  overCap: boolean;
}): boolean {
  const { def, distanceM, durationSec, totalReps, overCap } = args;
  if (!def) return false;
  if (def.measurement === 'distance-time') {
    return (
      distanceM !== null &&
      distanceM >= def.min &&
      durationSec !== null &&
      durationSec > 0 &&
      !overCap
    );
  }
  if (def.measurement === 'time') {
    return (
      durationSec !== null &&
      durationSec > 0 &&
      durationSec >= def.min &&
      !overCap
    );
  }
  if (def.measurement === 'distance') {
    return distanceM !== null && distanceM >= def.min && !overCap;
  }
  return totalReps >= def.min && !overCap;
}

export interface BuildExerciseInput {
  timestamp: string;
  def: ExerciseDefinition;
  variantPatch: { variantId?: string | null };
  sets: ReadonlyArray<number>;
  intervals: ReadonlyArray<number>;
  durationSec: number | null;
  distanceM: number | null;
}

export function buildVariantPatch(
  currentVariantId: string,
  initialVariantId: string
): { variantId?: string | null } {
  const variantId = currentVariantId.trim();
  return variantId === initialVariantId
    ? {}
    : variantId
      ? { variantId }
      : initialVariantId
        ? { variantId: null }
        : {};
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
      distanceM,
      durationSec,
    };
  }

  if (measurement === 'distance') {
    // Dead today (no pure-`distance` catalog exercise), kept in lockstep with
    // the data model so a future distance-only exercise emits `intervals`.
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
  };
}
