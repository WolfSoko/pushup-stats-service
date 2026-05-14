export type { ExerciseAngleProfile } from './lib/exercise-angle-profile';
export { PUSHUP_PROFILE, profileFor } from './lib/exercise-angle-profile';
export type { PoseSample } from './lib/pose-sample';
export {
  RepStateMachine,
  type RepCountSnapshot,
  type RepPhase,
  type RepProcessResult,
} from './lib/rep-state-machine';
export {
  REP_COUNTER,
  type RepCounter,
  type RepCounterStartOptions,
} from './lib/rep-counter.port';
export { angleAtElbowDeg, type Point2D } from './lib/elbow-angle';
export {
  POSE_DETECTOR_FACTORY,
  POSE_LANDMARK,
  type PoseDetectionResult,
  type PoseDetector,
  type PoseLandmark,
} from './lib/pose-detector.port';
export {
  POSE_FRAME_SOURCE,
  type FrameTick,
  type PoseFrameSource,
} from './lib/pose-frame-source.port';
export { poseToElbowSample } from './lib/pose-to-sample';
export { PoseRepCounterService } from './lib/pose-rep-counter.service';
