import {
  PULLUP_PROFILE,
  PUSHUP_PROFILE,
  SITUP_PROFILE,
  SQUAT_PROFILE,
  listProfiles,
  profileFor,
} from './exercise-angle-profile';
import { POSE_LANDMARK } from './pose-detector.port';

describe('profileFor', () => {
  it.each([
    ['pushup', PUSHUP_PROFILE],
    ['squat', SQUAT_PROFILE],
    ['pullup', PULLUP_PROFILE],
    ['situp', SITUP_PROFILE],
  ])('returns the %s profile by id', (id, profile) => {
    expect(profileFor(id)).toBe(profile);
  });

  it('returns null for unknown ids', () => {
    expect(profileFor('not-a-real-exercise')).toBeNull();
  });
});

describe('listProfiles', () => {
  it('exposes every registered profile', () => {
    expect(
      listProfiles()
        .map((p) => p.id)
        .sort()
    ).toEqual(['pullup', 'pushup', 'situp', 'squat'].sort());
  });
});

describe('exercise profiles — joint triplets', () => {
  it('pushup profile uses the elbow triplet on both sides', () => {
    expect(PUSHUP_PROFILE.tripletLeft).toEqual([
      POSE_LANDMARK.LEFT_SHOULDER,
      POSE_LANDMARK.LEFT_ELBOW,
      POSE_LANDMARK.LEFT_WRIST,
    ]);
    expect(PUSHUP_PROFILE.tripletRight).toEqual([
      POSE_LANDMARK.RIGHT_SHOULDER,
      POSE_LANDMARK.RIGHT_ELBOW,
      POSE_LANDMARK.RIGHT_WRIST,
    ]);
  });

  it('squat profile uses the knee triplet on both sides', () => {
    expect(SQUAT_PROFILE.tripletLeft).toEqual([
      POSE_LANDMARK.LEFT_HIP,
      POSE_LANDMARK.LEFT_KNEE,
      POSE_LANDMARK.LEFT_ANKLE,
    ]);
    expect(SQUAT_PROFILE.tripletRight).toEqual([
      POSE_LANDMARK.RIGHT_HIP,
      POSE_LANDMARK.RIGHT_KNEE,
      POSE_LANDMARK.RIGHT_ANKLE,
    ]);
  });

  it('situp profile uses the hip triplet on both sides', () => {
    expect(SITUP_PROFILE.tripletLeft).toEqual([
      POSE_LANDMARK.LEFT_SHOULDER,
      POSE_LANDMARK.LEFT_HIP,
      POSE_LANDMARK.LEFT_KNEE,
    ]);
    expect(SITUP_PROFILE.tripletRight).toEqual([
      POSE_LANDMARK.RIGHT_SHOULDER,
      POSE_LANDMARK.RIGHT_HIP,
      POSE_LANDMARK.RIGHT_KNEE,
    ]);
  });

  it.each([
    ['pushup', PUSHUP_PROFILE],
    ['squat', SQUAT_PROFILE],
    ['pullup', PULLUP_PROFILE],
    ['situp', SITUP_PROFILE],
  ])('%s profile has up > down threshold', (_id, profile) => {
    expect(profile.upAngleDeg).toBeGreaterThan(profile.downAngleDeg);
  });
});
