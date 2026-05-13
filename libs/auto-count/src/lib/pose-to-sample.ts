import { angleAtElbowDeg } from './elbow-angle';
import {
  POSE_LANDMARK,
  type PoseDetectionResult,
  type PoseLandmark,
} from './pose-detector.port';
import type { PoseSample } from './pose-sample';

interface SideSample {
  readonly angleDeg: number;
  readonly confidence: number;
}

const sideSample = (
  landmarks: ReadonlyArray<PoseLandmark>,
  shoulderIdx: number,
  elbowIdx: number,
  wristIdx: number
): SideSample | null => {
  const shoulder = landmarks[shoulderIdx];
  const elbow = landmarks[elbowIdx];
  const wrist = landmarks[wristIdx];
  if (!shoulder || !elbow || !wrist) return null;

  const angleDeg = angleAtElbowDeg(shoulder, elbow, wrist);
  if (Number.isNaN(angleDeg)) return null;

  const confidence = Math.min(
    shoulder.visibility ?? 0,
    elbow.visibility ?? 0,
    wrist.visibility ?? 0
  );
  return { angleDeg, confidence };
};

/**
 * Reduce a pose-detection frame to a `PoseSample` for the rep state
 * machine. Picks the body side (left or right arm) with the higher
 * triplet visibility — a side-profile pushup typically has one arm
 * occluded, and averaging the two would poison the angle.
 *
 * Returns null when no pose was detected or both arms are unreadable;
 * the caller then skips that frame entirely.
 */
export function poseToElbowSample(
  result: PoseDetectionResult,
  timestampMs: number
): PoseSample | null {
  const landmarks = result.landmarks[0];
  if (!landmarks) return null;

  const left = sideSample(
    landmarks,
    POSE_LANDMARK.LEFT_SHOULDER,
    POSE_LANDMARK.LEFT_ELBOW,
    POSE_LANDMARK.LEFT_WRIST
  );
  const right = sideSample(
    landmarks,
    POSE_LANDMARK.RIGHT_SHOULDER,
    POSE_LANDMARK.RIGHT_ELBOW,
    POSE_LANDMARK.RIGHT_WRIST
  );

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
