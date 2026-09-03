import { POSE_LANDMARK } from './pose-detector.port';

/**
 * `[proximal, joint, distal]` landmark indices for one body side. The
 * angle is measured at `joint` between the segment to `proximal` and
 * the segment to `distal` — e.g. for an elbow, `[shoulder, elbow,
 * wrist]`.
 */
export type JointTriplet = readonly [number, number, number];

/**
 * Tuning parameters for the joint-angle rep detector. One profile per
 * exercise. The detector itself is exercise-agnostic — adding a new
 * exercise is a data change here, not a code change in the state
 * machine. Both body sides are declared so the per-frame mapper can
 * pick the more-confident one (a side-profile pose typically has one
 * limb occluded, and averaging the two would poison the angle).
 */
export interface ExerciseAngleProfile {
  /** Catalog id, e.g. `'pushup'`, `'squat'`. */
  readonly id: string;
  /** Joint triplet on the user's left side. */
  readonly tripletLeft: JointTriplet;
  /** Joint triplet on the user's right side. */
  readonly tripletRight: JointTriplet;
  /** Angle in degrees at/above which the joint counts as fully extended ("up"). */
  readonly upAngleDeg: number;
  /** Angle in degrees at/below which the joint counts as fully flexed ("down"). */
  readonly downAngleDeg: number;
  /** Min ms a candidate phase must persist before it is committed. Filters noise. */
  readonly minDwellMs: number;
  /** Per-sample confidence floor; samples below this are dropped entirely. */
  readonly minConfidence: number;
  /**
   * Max ms between two consecutive in-zone samples before the candidate
   * is considered stale and reset.
   */
  readonly maxFrameGapMs: number;
}

const ELBOW_TRIPLETS = {
  left: [
    POSE_LANDMARK.LEFT_SHOULDER,
    POSE_LANDMARK.LEFT_ELBOW,
    POSE_LANDMARK.LEFT_WRIST,
  ] as const,
  right: [
    POSE_LANDMARK.RIGHT_SHOULDER,
    POSE_LANDMARK.RIGHT_ELBOW,
    POSE_LANDMARK.RIGHT_WRIST,
  ] as const,
} satisfies { left: JointTriplet; right: JointTriplet };

const KNEE_TRIPLETS = {
  left: [
    POSE_LANDMARK.LEFT_HIP,
    POSE_LANDMARK.LEFT_KNEE,
    POSE_LANDMARK.LEFT_ANKLE,
  ] as const,
  right: [
    POSE_LANDMARK.RIGHT_HIP,
    POSE_LANDMARK.RIGHT_KNEE,
    POSE_LANDMARK.RIGHT_ANKLE,
  ] as const,
} satisfies { left: JointTriplet; right: JointTriplet };

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

export const PUSHUP_PROFILE: ExerciseAngleProfile = {
  id: 'pushup',
  tripletLeft: ELBOW_TRIPLETS.left,
  tripletRight: ELBOW_TRIPLETS.right,
  upAngleDeg: 150,
  downAngleDeg: 90,
  minDwellMs: 200,
  minConfidence: 0.6,
  maxFrameGapMs: 500,
};

export const SQUAT_PROFILE: ExerciseAngleProfile = {
  id: 'squat',
  tripletLeft: KNEE_TRIPLETS.left,
  tripletRight: KNEE_TRIPLETS.right,
  upAngleDeg: 160,
  downAngleDeg: 100,
  minDwellMs: 250,
  minConfidence: 0.5,
  maxFrameGapMs: 600,
};

export const PULLUP_PROFILE: ExerciseAngleProfile = {
  id: 'pullup',
  tripletLeft: ELBOW_TRIPLETS.left,
  tripletRight: ELBOW_TRIPLETS.right,
  upAngleDeg: 160,
  downAngleDeg: 80,
  minDwellMs: 250,
  minConfidence: 0.5,
  maxFrameGapMs: 600,
};

/**
 * Sit-up rep. The "up" zone is the **lying-flat** start position and
 * the "down" zone is the curled-up peak. Naming matches every other
 * profile: "up" = high-angle (hip extended), "down" = low-angle (hip
 * flexed). The shared `RepStateMachine` then counts `down → up`
 * cycles uniformly.
 *
 * Threshold tuning is more permissive than the other profiles because
 * the standard sit-up form keeps the knees bent at ~90° throughout
 * (feet flat on the floor), so the shoulder-hip-knee angle in the
 * lying-flat position is closer to ~110-140° than 180° — the previous
 * 160° / 90° pair caused the "up" zone to be unreachable, which made
 * the counter silently drop reps. The lower `minConfidence` reflects
 * the harder camera framing of a lying user (selfie cam looking down
 * the body, partial body crop) compared to a standing pushup/squat.
 */
export const SITUP_PROFILE: ExerciseAngleProfile = {
  id: 'situp',
  tripletLeft: HIP_TRIPLETS.left,
  tripletRight: HIP_TRIPLETS.right,
  upAngleDeg: 130,
  downAngleDeg: 60,
  minDwellMs: 200,
  minConfidence: 0.4,
  maxFrameGapMs: 700,
};

const PROFILES: ReadonlyMap<string, ExerciseAngleProfile> = new Map([
  [PUSHUP_PROFILE.id, PUSHUP_PROFILE],
  [SQUAT_PROFILE.id, SQUAT_PROFILE],
  [PULLUP_PROFILE.id, PULLUP_PROFILE],
  [SITUP_PROFILE.id, SITUP_PROFILE],
]);

export function profileFor(exerciseId: string): ExerciseAngleProfile | null {
  return PROFILES.get(exerciseId) ?? null;
}

export function listProfiles(): ReadonlyArray<ExerciseAngleProfile> {
  return [...PROFILES.values()];
}
