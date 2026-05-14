import type { JointTriplet } from './exercise-angle-profile';
import { POSE_LANDMARK } from './pose-detector.port';

/**
 * Tuning parameters for an isometric-hold detector (plank, hollow hold,
 * wall sit, …). Parallel to {@link ExerciseAngleProfile} but with two
 * debounce thresholds — entering vs leaving the hold — so brief
 * mid-set wobbles don't stop the timer while a real "stand up" does.
 *
 * The angle is read at the same triplet as the rep detector; for a
 * plank that's hip flexion (`shoulder-hip-knee`): ≥ ~160° means the
 * body is straight (in pose) and ≤ ~140° means the hip sagged or the
 * user stood up (out of pose).
 */
export interface ExerciseHoldProfile {
  readonly id: string;
  readonly tripletLeft: JointTriplet;
  readonly tripletRight: JointTriplet;
  /** Angle in degrees at/above which the joint counts as "in pose". */
  readonly inPoseAngleDeg: number;
  /** Angle in degrees at/below which the joint counts as "out of pose". Below `inPoseAngleDeg` for hysteresis. */
  readonly outPoseAngleDeg: number;
  /** Min ms an "in pose" candidate must persist before the timer starts. */
  readonly minHoldMs: number;
  /** Min ms an "out of pose" candidate must persist before the timer pauses. */
  readonly minBreakMs: number;
  /** Per-sample confidence floor; lower samples are dropped. */
  readonly minConfidence: number;
  /**
   * Max ms attributed to a single inter-sample gap. Caps the credit
   * applied when the detector loses tracking for a while, so a dropped
   * camera frame doesn't silently add seconds to the hold time.
   */
  readonly maxFrameGapMs: number;
}

const HIP_TRIPLETS = {
  left: [
    POSE_LANDMARK.LEFT_SHOULDER,
    POSE_LANDMARK.LEFT_HIP,
    POSE_LANDMARK.LEFT_KNEE,
  ] as const,
  right: [
    POSE_LANDMARK.RIGHT_SHOULDER,
    POSE_LANDMARK.RIGHT_HIP,
    POSE_LANDMARK.RIGHT_KNEE,
  ] as const,
} satisfies { left: JointTriplet; right: JointTriplet };

export const PLANK_HOLD_PROFILE: ExerciseHoldProfile = {
  id: 'plank',
  tripletLeft: HIP_TRIPLETS.left,
  tripletRight: HIP_TRIPLETS.right,
  inPoseAngleDeg: 160,
  outPoseAngleDeg: 140,
  minHoldMs: 600,
  minBreakMs: 800,
  minConfidence: 0.4,
  maxFrameGapMs: 700,
};

/**
 * Hollow hold uses the same hip-flexion triplet as plank, but lying
 * supine with arms/legs raised. The shoulder-hip-knee angle stays open
 * (body in a banana shape) — collapsing to flat means the hold is lost.
 */
export const HOLLOWHOLD_PROFILE: ExerciseHoldProfile = {
  id: 'hollowhold',
  tripletLeft: HIP_TRIPLETS.left,
  tripletRight: HIP_TRIPLETS.right,
  inPoseAngleDeg: 150,
  outPoseAngleDeg: 130,
  minHoldMs: 600,
  minBreakMs: 800,
  minConfidence: 0.4,
  maxFrameGapMs: 700,
};

const HOLD_PROFILES: ReadonlyMap<string, ExerciseHoldProfile> = new Map([
  [PLANK_HOLD_PROFILE.id, PLANK_HOLD_PROFILE],
  [HOLLOWHOLD_PROFILE.id, HOLLOWHOLD_PROFILE],
]);

export function holdProfileFor(exerciseId: string): ExerciseHoldProfile | null {
  return HOLD_PROFILES.get(exerciseId) ?? null;
}

export function listHoldProfiles(): ReadonlyArray<ExerciseHoldProfile> {
  return [...HOLD_PROFILES.values()];
}
