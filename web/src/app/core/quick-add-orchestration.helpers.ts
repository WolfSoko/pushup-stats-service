import {
  EXERCISE_CATALOG,
  type ExerciseEntryCreate,
  findExerciseDefinition,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
} from '@pu-stats/models';
import { nowLocalIsoTimestamp } from '@pu-stats/date';

import type {
  AutoCountExerciseId,
  AutoCountResult,
  ExerciseEntryDialogData,
  ExerciseEntryDialogResult,
  ExerciseTimerExerciseId,
  PushupEntryDialogData,
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from './quick-add-orchestration.models';

/**
 * Resolves an auto-count pose-detector profile id to the catalog
 * `exerciseId` used by the training-entry dialog and
 * `ExerciseFirestoreService`. Derived from each catalog entry's
 * `autoCountProfileId`, so the profile↔catalog mapping has a single
 * source (the catalog) instead of a hardcoded id list duplicated here.
 * `'pushup'` is special: it has no catalog entry (it lives in the legacy
 * `pushups` collection), so it maps to the `PUSHUP_QUICK_ADD_EXERCISE_ID`
 * sentinel.
 */
export function catalogIdForAutoCountProfile(
  profile: AutoCountExerciseId
): string | null {
  if (profile === 'pushup') return PUSHUP_QUICK_ADD_EXERCISE_ID;
  // Fail closed (null) on a profile with no catalog entry rather than
  // emitting the raw profile string as an exerciseId — a non-catalog id
  // would only fail later at save time. Callers guard before persisting.
  return (
    EXERCISE_CATALOG.find((d) => d.autoCountProfileId === profile)?.id ?? null
  );
}

/**
 * Runtime allowlist for the `AutoCountExerciseId` union (type-only in the
 * dialog component) — validates a catalog `autoCountProfileId` string before
 * it is treated as a detector profile, so an unexpected catalog value can't
 * slip through an unchecked cast and open the dialog with an invalid id.
 */
export function isAutoCountProfile(
  value: string | undefined
): value is AutoCountExerciseId {
  return (
    value === 'pushup' ||
    value === 'squat' ||
    value === 'pullup' ||
    value === 'situp'
  );
}

/**
 * Inverse of {@link catalogIdForAutoCountProfile} — resolves a catalog
 * exerciseId (or the `'pushup'` sentinel) to the auto-count profile the
 * camera dialog understands, reading `autoCountProfileId` straight off the
 * catalog. Returns `null` for catalog ids without a valid detector profile
 * so the dashboard fails closed instead of opening the wrong detector.
 */
export function autoCountProfileForCatalogId(
  catalogId: string
): AutoCountExerciseId | null {
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
  // Same fail-closed contract as catalogIdForAutoCountProfile.
  return (
    EXERCISE_CATALOG.find((d) => d.holdTimerProfileId === profile)?.id ?? null
  );
}

/**
 * Builds the training-entry dialog prefill from an auto-count result.
 * Pushup results go to the legacy `pushups` path; catalog exercises resolve
 * their profile to a catalog id, returning `null` when no valid catalog id
 * exists so the caller can fail closed.
 */
export function buildAutoCountPrefill(
  result: AutoCountResult
): TrainingEntryDialogData | null {
  if (result.exerciseId === 'pushup') {
    return {
      kind: 'pushup',
      timestamp: nowLocalIsoTimestamp(),
      reps: result.reps,
      sets: [result.reps],
      source: 'auto-count',
      type: 'standard',
    } satisfies PushupEntryDialogData;
  }
  const exerciseId = catalogIdForAutoCountProfile(result.exerciseId);
  if (!exerciseId) return null;
  return {
    kind: 'exercise',
    timestamp: nowLocalIsoTimestamp(),
    exerciseId,
    reps: result.reps,
    sets: [result.reps],
  } satisfies ExerciseEntryDialogData;
}

/**
 * Map a confirmed `TrainingEntryDialogResult` to its `ExerciseEntryCreate`
 * payload. Pushup results keep their own dialog-supplied `source`; every
 * other result is treated as a catalog exercise and carries the orchestration
 * `source` attribution.
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
    };
  }
  return buildExerciseEntryPayload(result, exerciseSource);
}

/**
 * Map an exercise-mode `TrainingEntryDialogResult` to the
 * `ExerciseEntryCreate` payload shape, honouring the catalog's
 * measurement discriminator so a switch to a time- or distance-based
 * exercise mid-flow (e.g. plank, run) doesn't drop the required
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
