import type { JointTriplet } from './exercise-angle-profile';
import { POSE_LANDMARK, type PoseLandmark } from './pose-detector.port';

/**
 * Everything a renderer needs to draw the detected pose on top of the
 * camera frame: the full landmark set plus the triplet the active
 * profile measured this frame's angle at, so the overlay can highlight
 * the joint the counter is actually watching instead of guessing.
 *
 * Coordinates stay normalized in `[0, 1]` relative to the *source*
 * frame — mapping them onto a styled `<video>` box (object-fit, mirror)
 * is the renderer's job.
 */
export interface PoseSkeleton {
  readonly landmarks: ReadonlyArray<PoseLandmark>;
  readonly triplet: JointTriplet;
}

/**
 * Landmark index pairs drawn as bones. Limited to the torso and the
 * four limbs — the counter only ever reasons about those, and drawing
 * face/hand/foot detail would clutter a preview that is mostly viewed
 * from across the room.
 */
export const POSE_BONES: ReadonlyArray<readonly [number, number]> = [
  [POSE_LANDMARK.LEFT_SHOULDER, POSE_LANDMARK.RIGHT_SHOULDER],
  [POSE_LANDMARK.LEFT_SHOULDER, POSE_LANDMARK.LEFT_ELBOW],
  [POSE_LANDMARK.LEFT_ELBOW, POSE_LANDMARK.LEFT_WRIST],
  [POSE_LANDMARK.RIGHT_SHOULDER, POSE_LANDMARK.RIGHT_ELBOW],
  [POSE_LANDMARK.RIGHT_ELBOW, POSE_LANDMARK.RIGHT_WRIST],
  [POSE_LANDMARK.LEFT_SHOULDER, POSE_LANDMARK.LEFT_HIP],
  [POSE_LANDMARK.RIGHT_SHOULDER, POSE_LANDMARK.RIGHT_HIP],
  [POSE_LANDMARK.LEFT_HIP, POSE_LANDMARK.RIGHT_HIP],
  [POSE_LANDMARK.LEFT_HIP, POSE_LANDMARK.LEFT_KNEE],
  [POSE_LANDMARK.LEFT_KNEE, POSE_LANDMARK.LEFT_ANKLE],
  [POSE_LANDMARK.RIGHT_HIP, POSE_LANDMARK.RIGHT_KNEE],
  [POSE_LANDMARK.RIGHT_KNEE, POSE_LANDMARK.RIGHT_ANKLE],
];
