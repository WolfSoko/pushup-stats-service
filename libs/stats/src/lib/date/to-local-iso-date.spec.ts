import { toLocalIsoDate } from './to-local-iso-date';

describe('toLocalIsoDate', () => {
  it('formats a date as YYYY-MM-DD using local time', () => {
    const date = new Date(2024, 2, 5); // March 5, 2024 (local)
    expect(toLocalIsoDate(date)).toBe('2024-03-05');
  });

  it('pads single-digit month and day with zero', () => {
    const date = new Date(2024, 0, 1); // January 1
    expect(toLocalIsoDate(date)).toBe('2024-01-01');
  });
});
