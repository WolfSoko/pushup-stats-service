import { angleAtElbowDeg } from './elbow-angle';
import type {
  ExerciseAngleProfile,
  JointTriplet,
} from './exercise-angle-profile';
import type { PoseDetectionResult, PoseLandmark } from './pose-detector.port';
import type { PoseSample } from './pose-sample';

interface SideSample {
  readonly angleDeg: number;
  readonly confidence: number;
}

const tripletSample = (
  landmarks: ReadonlyArray<PoseLandmark>,
  [proximalIdx, jointIdx, distalIdx]: JointTriplet
): SideSample | null => {
  const proximal = landmarks[proximalIdx];
  const joint = landmarks[jointIdx];
  const distal = landmarks[distalIdx];
  if (!proximal || !joint || !distal) return null;

  const angleDeg = angleAtElbowDeg(proximal, joint, distal);
  if (Number.isNaN(angleDeg)) return null;

  const confidence = Math.min(
    proximal.visibility ?? 0,
    joint.visibility ?? 0,
    distal.visibility ?? 0
  );
  return { angleDeg, confidence };
};

/**
 * Reduce a pose-detection frame to a `PoseSample` for the rep state
 * machine. Picks the body side (per the active profile's triplets)
 * with the higher triplet visibility — a side-profile pose typically
 * has one limb occluded, and averaging the two would poison the angle.
 *
 * Returns null when no pose was detected or both sides are unreadable;
 * the caller then skips that frame entirely.
 */
export function poseToAngleSample(
  result: PoseDetectionResult,
  profile: ExerciseAngleProfile,
  timestampMs: number
): PoseSample | null {
  const landmarks = result.landmarks[0];
  if (!landmarks) return null;

  const left = tripletSample(landmarks, profile.tripletLeft);
  const right = tripletSample(landmarks, profile.tripletRight);

  const best =
    left && right
      ? left.confidence >= right.confidence
        ? left
        : right
      : (left ?? right);
  if (!best) return null;

  return {
    angleDeg: best.angleDeg,
    confidence: best.confidence,
    timestampMs,
  };
}
