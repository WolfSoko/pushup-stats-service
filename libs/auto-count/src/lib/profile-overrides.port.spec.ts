import { PUSHUP_PROFILE } from './exercise-angle-profile';
import { applyOverride } from './profile-overrides.port';

describe('applyOverride', () => {
  it('given no override, when applied, then the base profile is returned unchanged', () => {
    // given / when
    const merged = applyOverride(PUSHUP_PROFILE, null);

    // then
    expect(merged).toBe(PUSHUP_PROFILE);
  });

  it('given a partial override, when applied, then only the named thresholds change', () => {
    // given / when
    const merged = applyOverride(PUSHUP_PROFILE, { downAngleDeg: 80 });

    // then
    expect(merged.downAngleDeg).toBe(80);
    expect(merged.upAngleDeg).toBe(PUSHUP_PROFILE.upAngleDeg);
    expect(merged.tripletLeft).toBe(PUSHUP_PROFILE.tripletLeft);
  });

  it('given an override with a non-finite value, when applied, then that key keeps the default', () => {
    // given — a stored document that lost a value, or an empty form field
    const broken = { upAngleDeg: Number.NaN, downAngleDeg: 85 };

    // when
    const merged = applyOverride(PUSHUP_PROFILE, broken);

    // then
    expect(merged.upAngleDeg).toBe(PUSHUP_PROFILE.upAngleDeg);
    expect(merged.downAngleDeg).toBe(85);
  });

  it('given an override carrying a non-numeric value, when applied, then it is ignored', () => {
    // given
    const broken = { minDwellMs: '300' } as unknown as {
      minDwellMs: number;
    };

    // when
    const merged = applyOverride(PUSHUP_PROFILE, broken);

    // then
    expect(merged.minDwellMs).toBe(PUSHUP_PROFILE.minDwellMs);
  });

  it('given an override, when applied, then the base object is not mutated', () => {
    // given
    const before = PUSHUP_PROFILE.upAngleDeg;

    // when
    applyOverride(PUSHUP_PROFILE, { upAngleDeg: 12 });

    // then
    expect(PUSHUP_PROFILE.upAngleDeg).toBe(before);
  });
});
