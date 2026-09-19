import { InjectionToken } from '@angular/core';

import type { ExerciseAngleProfile } from './exercise-angle-profile';
import type { ExerciseHoldProfile } from './exercise-hold-profile';

/**
 * The tunable half of an {@link ExerciseAngleProfile}. The joint
 * triplets are deliberately not overridable: which joint an exercise is
 * measured at is a property of the exercise, not a threshold to be
 * dialled in, and letting it drift would silently change what the
 * counter means by "a rep".
 */
export type AngleProfileOverride = Partial<
  Pick<
    ExerciseAngleProfile,
    | 'upAngleDeg'
    | 'downAngleDeg'
    | 'minDwellMs'
    | 'minConfidence'
    | 'maxFrameGapMs'
  >
>;

/** The tunable half of an {@link ExerciseHoldProfile}. */
export type HoldProfileOverride = Partial<
  Pick<
    ExerciseHoldProfile,
    | 'inPoseAngleDeg'
    | 'outPoseAngleDeg'
    | 'minHoldMs'
    | 'minBreakMs'
    | 'minConfidence'
    | 'maxFrameGapMs'
  >
>;

/**
 * Supplies per-exercise threshold overrides on top of the catalog
 * defaults, so the values can be dialled in against a live camera
 * instead of by editing constants and redeploying.
 *
 * Both counters inject this **optionally** — with no provider they run
 * on the catalog defaults exactly as before.
 */
export interface ProfileOverrideSource {
  angleOverrideFor(exerciseId: string): AngleProfileOverride | null;
  holdOverrideFor(exerciseId: string): HoldProfileOverride | null;
}

export const PROFILE_OVERRIDES = new InjectionToken<ProfileOverrideSource>(
  'PROFILE_OVERRIDES'
);

/**
 * Merges an override onto a profile, ignoring keys whose value is not
 * a finite number — a half-filled form or a malformed stored document
 * must never knock a threshold out to `NaN`, which would make every
 * comparison in the state machine false and stop counting silently.
 */
export function applyOverride<T extends object>(
  base: T,
  override: NoInfer<Partial<T>> | null | undefined
): T {
  if (!override) return base;
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    (merged as Record<string, unknown>)[key] = value;
  }
  return merged;
}
