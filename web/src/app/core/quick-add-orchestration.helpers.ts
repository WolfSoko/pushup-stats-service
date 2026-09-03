import {
  EXERCISE_CATALOG,
  type ExerciseEntryCreate,
  findExerciseDefinition,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
} from '@pu-stats/models';
import { nowLocalIsoTimestamp } from '@pu-stats/date';
import { createVariantPatch } from '../stats/entries.variant';

import type {
  AutoCountResult,
  ExerciseEntryDialogData,
  ExerciseEntryDialogResult,
  ExerciseTimerExerciseId,
  PushupEntryDialogData,
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from './quick-add-orchestration.models';

/** Pose-detector profile ids `libs/auto-count` ships angle profiles for. */
export type AutoCountProfileId = 'pushup' | 'squat' | 'pullup' | 'situp';

/**
 * Runtime allowlist for the type-only {@link AutoCountProfileId} union, so
 * an unexpected catalog value can't slip through an unchecked cast and open
 * the detector with an invalid profile id.
 */
export function isAutoCountProfile(
  value: string | undefined
): value is AutoCountProfileId {
  return (
    value === 'pushup' ||
    value === 'squat' ||
    value === 'pullup' ||
    value === 'situp'
  );
}

/**
 * Pose profile behind a catalog id, or `null` when the exercise has no
 * joint-angle detector (it may still be proximity-countable).
 */
export function autoCountProfileForCatalogId(
  catalogId: string
): AutoCountProfileId | null {
  if (catalogId === PUSHUP_QUICK_ADD_EXERCISE_ID) return 'pushup';
  const profile = findExerciseDefinition(catalogId)?.autoCountProfileId;
  return isAutoCountProfile(profile) ? profile : null;
}

/**
 * Resolves a hold-timer profile id (defined in `libs/auto-count`) to the
 * catalog `exerciseId` used by `ExerciseFirestoreService`, derived from
 * each catalog entry's `holdTimerProfileId`.
 */
export function catalogIdForHoldTimerProfile(
  profile: ExerciseTimerExerciseId
): string | null {
  // Fail closed (null) rather than emitting a profile string as an id.
  return (
    EXERCISE_CATALOG.find((d) => d.holdTimerProfileId === profile)?.id ?? null
  );
}

/**
 * Runtime allowlist for the type-only `ExerciseTimerExerciseId` union, so an
 * unexpected catalog value can't open the timer with an invalid hold id.
 */
export function isHoldTimerProfile(
  value: string | undefined
): value is ExerciseTimerExerciseId {
  return value === 'plank' || value === 'hollowhold';
}

/**
 * Inverse of {@link catalogIdForHoldTimerProfile}. Returns `null` for catalog
 * ids without a hold-timer profile, so callers fail closed instead of opening
 * the timer on the wrong hold.
 */
export function holdTimerProfileForCatalogId(
  catalogId: string
): ExerciseTimerExerciseId | null {
  const profile = findExerciseDefinition(catalogId)?.holdTimerProfileId;
  return isHoldTimerProfile(profile) ? profile : null;
}

/**
 * Pushup results take the legacy `pushups` path; every other result must
 * name a rep-measured catalog exercise, otherwise `null` so the caller can
 * fail closed instead of saving an id the rules would reject.
 */
export function buildAutoCountPrefill(
  result: AutoCountResult
): TrainingEntryDialogData | null {
  if (result.exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID) {
    return {
      kind: 'pushup',
      timestamp: nowLocalIsoTimestamp(),
      reps: result.reps,
      sets: [result.reps],
      source: 'auto-count',
      type: 'standard',
    } satisfies PushupEntryDialogData;
  }
  const def = findExerciseDefinition(result.exerciseId);
  if (!def || def.measurement !== 'reps') return null;
  return {
    kind: 'exercise',
    timestamp: nowLocalIsoTimestamp(),
    exerciseId: def.id,
    reps: result.reps,
    sets: [result.reps],
  } satisfies ExerciseEntryDialogData;
}

/**
 * Pushup results keep their own dialog-supplied `source`; catalog exercises
 * carry the orchestration `source` attribution instead.
 */
export function buildConfirmedEntryPayload(
  result: TrainingEntryDialogResult,
  exerciseSource: string
): ExerciseEntryCreate {
  if (result.kind === 'pushup') {
    return {
      exerciseId: 'pushup',
      timestamp: result.timestamp,
      reps: result.reps,
      sets: result.sets,
      source: result.source,
      ...createVariantPatch(result),
    };
  }
  return buildExerciseEntryPayload(result, exerciseSource);
}

/**
 * Honours the catalog's measurement discriminator so a switch to a time- or
 * distance-based exercise mid-flow (e.g. plank, run) doesn't drop the required
 * companion fields and trigger `validateExerciseEntry` rejection.
 */
export function buildExerciseEntryPayload(
  result: ExerciseEntryDialogResult,
  source: string
): ExerciseEntryCreate {
  const base: ExerciseEntryCreate = {
    exerciseId: result.exerciseId,
    timestamp: result.timestamp,
    source,
    ...(result.variantId ? { variantId: result.variantId } : {}),
  };
  switch (result.measurement) {
    case 'time':
      return { ...base, durationSec: result.durationSec ?? 0 };
    case 'distance-time':
      return {
        ...base,
        distanceM: result.distanceM ?? 0,
        durationSec: result.durationSec ?? 0,
      };
    default:
      return {
        ...base,
        reps: result.reps,
        ...(result.sets.length > 1 ? { sets: result.sets } : {}),
      };
  }
}
