import { daysBetween } from './days-between';

describe('daysBetween', () => {
  it('counts whole calendar days forward', () => {
    expect(daysBetween('2026-06-01', '2026-06-02')).toBe(1);
    expect(daysBetween('2026-06-01', '2026-06-08')).toBe(7);
  });

  it('returns 0 for the same day and negative when b is before a', () => {
    expect(daysBetween('2026-06-01', '2026-06-01')).toBe(0);
    expect(daysBetween('2026-06-02', '2026-06-01')).toBe(-1);
  });

  it('rounds across a DST transition to a whole day', () => {
    // Europe/Berlin springs forward on 2026-03-29 (a 23h day); the count
    // must still be exactly 1.
    expect(daysBetween('2026-03-29', '2026-03-30')).toBe(1);
  });
});
