import {
  HOLLOWHOLD_PROFILE,
  PLANK_HOLD_PROFILE,
  holdProfileFor,
  listHoldProfiles,
} from './exercise-hold-profile';

describe('exercise-hold-profile', () => {
  it('given the plank id, when looked up, then returns the plank profile', () => {
    expect(holdProfileFor('plank')).toBe(PLANK_HOLD_PROFILE);
  });

  it('given the hollow-hold id, when looked up, then returns the hollow-hold profile', () => {
    expect(holdProfileFor('hollowhold')).toBe(HOLLOWHOLD_PROFILE);
  });

  it('given an unknown id, when looked up, then returns null', () => {
    expect(holdProfileFor('totally-unknown')).toBeNull();
  });

  it('given listHoldProfiles, when called, then returns at least plank and hollow hold', () => {
    const ids = listHoldProfiles().map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['plank', 'hollowhold']));
  });

  it('given any profile, when inspected, then outPoseAngleDeg is strictly less than inPoseAngleDeg (hysteresis)', () => {
    for (const profile of listHoldProfiles()) {
      expect(profile.outPoseAngleDeg).toBeLessThan(profile.inPoseAngleDeg);
    }
  });
});
