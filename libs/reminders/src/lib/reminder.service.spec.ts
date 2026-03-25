import { isInQuietHours } from './reminder.service';

describe('isInQuietHours', () => {
  // Helper: build a Date in a given timezone at a given local HH:MM
  function _dateAt(timezone: string, isoDate: string, hhmm: string): Date {
    return new Date(`${isoDate}T${hhmm}:00.000+00:00`);
  }

  it('returns false when quietHours is empty', () => {
    const now = new Date('2026-03-23T14:00:00Z');
    expect(isInQuietHours([], 'UTC', now)).toBe(false);
  });

  it('returns true during a simple overnight window (22:00–07:00)', () => {
    // 23:30 UTC should be inside [22:00, 07:00)
    const now = new Date('2026-03-23T23:30:00Z');
    expect(isInQuietHours([{ from: '22:00', to: '07:00' }], 'UTC', now)).toBe(
      true
    );
  });

  it('returns true early morning inside overnight window (01:00 UTC)', () => {
    const now = new Date('2026-03-23T01:00:00Z');
    expect(isInQuietHours([{ from: '22:00', to: '07:00' }], 'UTC', now)).toBe(
      true
    );
  });

  it('returns false outside overnight window (12:00 UTC)', () => {
    const now = new Date('2026-03-23T12:00:00Z');
    expect(isInQuietHours([{ from: '22:00', to: '07:00' }], 'UTC', now)).toBe(
      false
    );
  });

  it('returns false exactly at the end boundary (07:00 UTC)', () => {
    const now = new Date('2026-03-23T07:00:00Z');
    expect(isInQuietHours([{ from: '22:00', to: '07:00' }], 'UTC', now)).toBe(
      false
    );
  });

  it('returns true at exactly the start boundary (22:00 UTC)', () => {
    const now = new Date('2026-03-23T22:00:00Z');
    expect(isInQuietHours([{ from: '22:00', to: '07:00' }], 'UTC', now)).toBe(
      true
    );
  });

  it('returns true during a simple same-day window (12:00–13:00)', () => {
    const now = new Date('2026-03-23T12:30:00Z');
    expect(isInQuietHours([{ from: '12:00', to: '13:00' }], 'UTC', now)).toBe(
      true
    );
  });

  it('returns false before same-day window (11:59 UTC)', () => {
    const now = new Date('2026-03-23T11:59:00Z');
    expect(isInQuietHours([{ from: '12:00', to: '13:00' }], 'UTC', now)).toBe(
      false
    );
  });

  it('returns false after same-day window (13:01 UTC)', () => {
    const now = new Date('2026-03-23T13:01:00Z');
    expect(isInQuietHours([{ from: '12:00', to: '13:00' }], 'UTC', now)).toBe(
      false
    );
  });

  it('returns true when any one of multiple windows matches', () => {
    const now = new Date('2026-03-23T12:30:00Z');
    const quietHours = [
      { from: '22:00', to: '07:00' },
      { from: '12:00', to: '13:00' },
    ];
    expect(isInQuietHours(quietHours, 'UTC', now)).toBe(true);
  });

  it('returns false when none of multiple windows matches', () => {
    const now = new Date('2026-03-23T15:00:00Z');
    const quietHours = [
      { from: '22:00', to: '07:00' },
      { from: '12:00', to: '13:00' },
    ];
    expect(isInQuietHours(quietHours, 'UTC', now)).toBe(false);
  });

  it('uses the provided now parameter instead of current time', () => {
    // We pass a specific now – the result must be deterministic
    const pastNight = new Date('2026-01-01T23:00:00Z');
    expect(
      isInQuietHours([{ from: '22:00', to: '07:00' }], 'UTC', pastNight)
    ).toBe(true);
  });

  it('handles same from and to (always-quiet degenerate case)', () => {
    // from === to – treat as no quiet period (always active)
    const now = new Date('2026-03-23T10:00:00Z');
    expect(isInQuietHours([{ from: '10:00', to: '10:00' }], 'UTC', now)).toBe(
      false
    );
  });
});
