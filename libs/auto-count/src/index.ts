export type {
  ExerciseAngleProfile,
  JointTriplet,
} from './lib/exercise-angle-profile';
export {
  PUSHUP_PROFILE,
  SQUAT_PROFILE,
  PULLUP_PROFILE,
  SITUP_PROFILE,
  listProfiles,
  profileFor,
  supportsProximityCount,
} from './lib/exercise-angle-profile';
export type { PoseSample } from './lib/pose-sample';
export {
  RepStateMachine,
  type RepCountSnapshot,
  type RepPhase,
  type RepProcessResult,
  type RepThresholds,
} from './lib/rep-state-machine';
export {
  BrightnessEnvelope,
  DEFAULT_BRIGHTNESS_ENVELOPE,
  type BrightnessEnvelopeOptions,
  type ProximityPosition,
} from './lib/brightness-envelope';
export {
  FRAME_LUMA_SAMPLER,
  type FrameLumaSampler,
} from './lib/frame-luma-sampler.port';
export {
  PROXIMITY_ANGLE_SPAN_DEG,
  PROXIMITY_REP_COUNTER,
  PROXIMITY_THRESHOLDS,
} from './lib/proximity-rep-counter.service';
export {
  REP_COUNTER,
  type RepCounter,
  type RepCounterStartOptions,
  type FormCheckFrame,
} from './lib/rep-counter.port';
export { angleAtJointDeg, type Point2D } from './lib/joint-angle';
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
export { poseToAngleSample } from './lib/pose-to-sample';
export type { ExerciseHoldProfile } from './lib/exercise-hold-profile';
export {
  PLANK_HOLD_PROFILE,
  HOLLOWHOLD_PROFILE,
  holdProfileFor,
  listHoldProfiles,
} from './lib/exercise-hold-profile';
export {
  HoldStateMachine,
  type HoldPhase,
  type HoldSnapshot,
} from './lib/hold-state-machine';
export {
  HOLD_TIMER,
  type HoldTimer,
  type HoldTimerStartOptions,
  type HoldFormCheckFrame,
} from './lib/hold-timer.port';
export { provideAutoCount } from './lib/provide-auto-count';
