/**
 * Tuning parameters for the joint-angle rep detector. One profile per
 * exercise, e.g. elbow angle for pushups, knee angle for squats. The
 * detector itself stays exercise-agnostic — adding a new exercise is a
 * data change here, not a code change in the state machine.
 */
export interface ExerciseAngleProfile {
  /** Catalog id from `EXERCISE_CATEGORIES` / `PUSHUP_TYPES`, e.g. `'pushup'`. */
  readonly id: string;
  /** Angle in degrees at/above which the joint counts as fully extended ("up"). */
  readonly upAngleDeg: number;
  /** Angle in degrees at/below which the joint counts as fully flexed ("down"). */
  readonly downAngleDeg: number;
  /** Min ms a candidate phase must persist before it is committed. Filters noise. */
  readonly minDwellMs: number;
  /** Per-sample confidence floor; samples below this are dropped entirely. */
  readonly minConfidence: number;
}

export const PUSHUP_PROFILE: ExerciseAngleProfile = {
  id: 'pushup',
  upAngleDeg: 150,
  downAngleDeg: 90,
  minDwellMs: 200,
  minConfidence: 0.6,
};
