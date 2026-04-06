import { appendLocalOffset } from './append-local-offset';

describe('appendLocalOffset', () => {
  it('appends local timezone offset to a datetime-local string', () => {
    const result = appendLocalOffset('2026-04-05T22:50');
    // Should end with an offset like +02:00 or +01:00 depending on the test runner's TZ
    expect(result).toMatch(/^2026-04-05T22:50[+-]\d{2}:\d{2}$/);
  });

  it('does not double-append if offset is already present', () => {
    expect(appendLocalOffset('2026-04-05T22:50+02:00')).toBe(
      '2026-04-05T22:50+02:00'
    );
  });

  it('does not append to UTC timestamps (Z)', () => {
    expect(appendLocalOffset('2026-04-05T22:50:00Z')).toBe(
      '2026-04-05T22:50:00Z'
    );
  });

  it('returns empty string for empty input', () => {
    expect(appendLocalOffset('')).toBe('');
  });

  it('handles timestamps with seconds', () => {
    const result = appendLocalOffset('2026-04-05T22:50:30');
    expect(result).toMatch(/^2026-04-05T22:50:30[+-]\d{2}:\d{2}$/);
  });
});
