import { toBerlinIsoDate } from './to-berlin-iso-date';

describe('toBerlinIsoDate', () => {
  it('returns Berlin date for a UTC midnight timestamp', () => {
    // 2026-04-06T00:17:00Z — in Berlin (UTC+2 in April) this is 2026-04-06 02:17
    const date = new Date('2026-04-06T00:17:00Z');
    expect(toBerlinIsoDate(date)).toBe('2026-04-06');
  });

  it('keeps same Berlin date when UTC evening maps to same day in Berlin', () => {
    // 2026-04-05T20:50:00Z — in Berlin (UTC+2) this is 2026-04-05 22:50 (same day)
    const date = new Date('2026-04-05T20:50:00Z');
    expect(toBerlinIsoDate(date)).toBe('2026-04-05');
  });

  it('returns next Berlin date when UTC is before midnight but Berlin is after', () => {
    // 2026-04-05T23:00:00Z — in Berlin (UTC+2) this is 2026-04-06 01:00
    const date = new Date('2026-04-05T23:00:00Z');
    expect(toBerlinIsoDate(date)).toBe('2026-04-06');
  });

  it('handles winter time (CET = UTC+1)', () => {
    // 2026-01-15T23:30:00Z — in Berlin (UTC+1) this is 2026-01-16 00:30
    const date = new Date('2026-01-15T23:30:00Z');
    expect(toBerlinIsoDate(date)).toBe('2026-01-16');
  });

  it('pads single-digit month and day', () => {
    const date = new Date('2026-01-01T10:00:00Z');
    expect(toBerlinIsoDate(date)).toBe('2026-01-01');
  });
});
