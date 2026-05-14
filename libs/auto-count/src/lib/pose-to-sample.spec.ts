import {
  PULLUP_PROFILE,
  PUSHUP_PROFILE,
  SITUP_PROFILE,
  SQUAT_PROFILE,
} from './exercise-angle-profile';
import { POSE_LANDMARK, type PoseLandmark } from './pose-detector.port';
import { poseToAngleSample } from './pose-to-sample';

const makeLandmarks = (
  overrides: Partial<Record<number, PoseLandmark>> = {}
): ReadonlyArray<PoseLandmark> => {
  const arr: PoseLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    arr[i] = { x: 0, y: 0, visibility: 0 };
  }
  for (const [idx, lm] of Object.entries(overrides)) {
    if (lm) arr[Number(idx)] = lm;
  }
  return arr;
};

const STRAIGHT_LEFT_ARM = makeLandmarks({
  [POSE_LANDMARK.LEFT_SHOULDER]: { x: 0, y: 0, visibility: 0.9 },
  [POSE_LANDMARK.LEFT_ELBOW]: { x: 1, y: 0, visibility: 0.9 },
  [POSE_LANDMARK.LEFT_WRIST]: { x: 2, y: 0, visibility: 0.9 },
});

const STRAIGHT_LEFT_LEG = makeLandmarks({
  [POSE_LANDMARK.LEFT_HIP]: { x: 0, y: 0, visibility: 0.9 },
  [POSE_LANDMARK.LEFT_KNEE]: { x: 1, y: 0, visibility: 0.9 },
  [POSE_LANDMARK.LEFT_ANKLE]: { x: 2, y: 0, visibility: 0.9 },
});

const STRAIGHT_LEFT_HIP = makeLandmarks({
  [POSE_LANDMARK.LEFT_SHOULDER]: { x: 0, y: 0, visibility: 0.9 },
  [POSE_LANDMARK.LEFT_HIP]: { x: 1, y: 0, visibility: 0.9 },
  [POSE_LANDMARK.LEFT_KNEE]: { x: 2, y: 0, visibility: 0.9 },
});

describe('poseToAngleSample', () => {
  it('given a pushup profile and a fully-extended left arm, when mapped, then angle is 180 and confidence is min visibility', () => {
    const sample = poseToAngleSample(
      { landmarks: [STRAIGHT_LEFT_ARM] },
      PUSHUP_PROFILE,
      100
    );
    expect(sample).not.toBeNull();
    expect(sample?.angleDeg).toBeCloseTo(180, 5);
    expect(sample?.confidence).toBeCloseTo(0.9, 5);
    expect(sample?.timestampMs).toBe(100);
  });

  it('given a squat profile and a fully-extended left leg, when mapped, then angle is 180', () => {
    const sample = poseToAngleSample(
      { landmarks: [STRAIGHT_LEFT_LEG] },
      SQUAT_PROFILE,
      0
    );
    expect(sample?.angleDeg).toBeCloseTo(180, 5);
  });

  it('given a situp profile and an extended hip line, when mapped, then angle is 180', () => {
    const sample = poseToAngleSample(
      { landmarks: [STRAIGHT_LEFT_HIP] },
      SITUP_PROFILE,
      0
    );
    expect(sample?.angleDeg).toBeCloseTo(180, 5);
  });

  it('given a pullup profile (same triplet as pushup), when mapped against straight arm, then angle is 180', () => {
    const sample = poseToAngleSample(
      { landmarks: [STRAIGHT_LEFT_ARM] },
      PULLUP_PROFILE,
      0
    );
    expect(sample?.angleDeg).toBeCloseTo(180, 5);
  });

  it('given both arms detected, when one side is more visible, then that side is selected', () => {
    const landmarks = makeLandmarks({
      [POSE_LANDMARK.LEFT_SHOULDER]: { x: 0, y: 0, visibility: 0.2 },
      [POSE_LANDMARK.LEFT_ELBOW]: { x: 1, y: 0, visibility: 0.2 },
      [POSE_LANDMARK.LEFT_WRIST]: { x: 1, y: 1, visibility: 0.2 },
      [POSE_LANDMARK.RIGHT_SHOULDER]: { x: 0, y: 0, visibility: 0.95 },
      [POSE_LANDMARK.RIGHT_ELBOW]: { x: 1, y: 0, visibility: 0.95 },
      [POSE_LANDMARK.RIGHT_WRIST]: { x: 2, y: 0, visibility: 0.95 },
    });
    const sample = poseToAngleSample(
      { landmarks: [landmarks] },
      PUSHUP_PROFILE,
      0
    );
    expect(sample?.angleDeg).toBeCloseTo(180, 5);
    expect(sample?.confidence).toBeCloseTo(0.95, 5);
  });

  it('given no poses detected, when mapped, then sample is null', () => {
    expect(poseToAngleSample({ landmarks: [] }, PUSHUP_PROFILE, 0)).toBeNull();
  });

  it('given a degenerate triplet (wrist on elbow), when mapped, then sample is null', () => {
    const degenerate = makeLandmarks({
      [POSE_LANDMARK.LEFT_SHOULDER]: { x: 0, y: 0, visibility: 0.9 },
      [POSE_LANDMARK.LEFT_ELBOW]: { x: 1, y: 0, visibility: 0.9 },
      [POSE_LANDMARK.LEFT_WRIST]: { x: 1, y: 0, visibility: 0.9 },
    });
    expect(
      poseToAngleSample({ landmarks: [degenerate] }, PUSHUP_PROFILE, 0)
    ).toBeNull();
  });

  it('given missing visibility on a landmark, when mapped, then confidence is 0', () => {
    const noVis = makeLandmarks({
      [POSE_LANDMARK.LEFT_SHOULDER]: { x: 0, y: 0 },
      [POSE_LANDMARK.LEFT_ELBOW]: { x: 1, y: 0, visibility: 0.9 },
      [POSE_LANDMARK.LEFT_WRIST]: { x: 2, y: 0, visibility: 0.9 },
    });
    const sample = poseToAngleSample({ landmarks: [noVis] }, PUSHUP_PROFILE, 0);
    expect(sample?.confidence).toBe(0);
  });
});
