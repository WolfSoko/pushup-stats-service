import {
  DEFAULT_REMINDER_TIMEZONE,
  isInQuietHours,
} from './reminder-config.models';

describe('reminder-config quiet hours', () => {
  it('should expose Europe/Berlin as the canonical default timezone', () => {
    // then
    expect(DEFAULT_REMINDER_TIMEZONE).toBe('Europe/Berlin');
  });

  it('should return false when there are no quiet-hours windows', () => {
    // given
    const now = new Date('2026-03-23T14:00:00Z');

    // when / then
    expect(isInQuietHours([], 'UTC', now)).toBe(false);
  });

  it('should treat an overnight window as crossing midnight', () => {
    // given
    const insideNight = new Date('2026-03-23T23:30:00Z');
    const insideMorning = new Date('2026-03-23T01:00:00Z');
    const outside = new Date('2026-03-23T12:00:00Z');
    const window = [{ from: '22:00', to: '07:00' }];

    // then
    expect(isInQuietHours(window, 'UTC', insideNight)).toBe(true);
    expect(isInQuietHours(window, 'UTC', insideMorning)).toBe(true);
    expect(isInQuietHours(window, 'UTC', outside)).toBe(false);
  });

  it('should treat a same-day window as the half-open range [from, to)', () => {
    // given
    const window = [{ from: '12:00', to: '13:00' }];

    // then
    expect(
      isInQuietHours(window, 'UTC', new Date('2026-03-23T12:30:00Z'))
    ).toBe(true);
    expect(
      isInQuietHours(window, 'UTC', new Date('2026-03-23T13:00:00Z'))
    ).toBe(false);
    expect(
      isInQuietHours(window, 'UTC', new Date('2026-03-23T11:59:00Z'))
    ).toBe(false);
  });

  it('should treat a window where from equals to as disabled', () => {
    // given
    const now = new Date('2026-03-23T10:00:00Z');

    // then
    expect(isInQuietHours([{ from: '10:00', to: '10:00' }], 'UTC', now)).toBe(
      false
    );
  });

  it('should parse non-zero-padded "H:MM" boundaries numerically', () => {
    // given — 07:30 UTC, window 7:00–8:00 (intentionally not zero-padded)
    const now = new Date('2026-03-23T07:30:00Z');

    // then
    expect(isInQuietHours([{ from: '7:00', to: '8:00' }], 'UTC', now)).toBe(
      true
    );
  });

  it('should default a missing/empty timezone to Europe/Berlin', () => {
    // given — 08:30 UTC is 09:30 in Berlin (winter, UTC+1); the window only
    // matches when evaluated against Berlin, proving the default zone.
    const now = new Date('2026-01-15T08:30:00Z');
    const window = [{ from: '09:00', to: '10:00' }];

    // then
    expect(isInQuietHours(window, undefined, now)).toBe(true);
    expect(isInQuietHours(window, '', now)).toBe(true);
    expect(isInQuietHours(window, 'UTC', now)).toBe(false);
  });
});
