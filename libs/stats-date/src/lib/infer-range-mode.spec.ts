import { inferRangeMode } from './infer-range-mode';

describe('inferRangeMode', () => {
  it('returns "day" when from and to are the same date', () => {
    expect(inferRangeMode('2024-03-15', '2024-03-15')).toBe('day');
  });

  it('returns "week" for a 7-day range starting on Monday', () => {
    // 2024-03-11 is a Monday
    expect(inferRangeMode('2024-03-11', '2024-03-17')).toBe('week');
  });

  it('returns "month" for a full calendar month', () => {
    expect(inferRangeMode('2024-03-01', '2024-03-31')).toBe('month');
  });

  it('returns "year" for a full calendar year', () => {
    expect(inferRangeMode('2024-01-01', '2024-12-31')).toBe('year');
  });

  it('returns "month" for a full leap-year February (29 days)', () => {
    // Guards against off-by-one in lastDayOfMonth for Feb in a leap year.
    expect(inferRangeMode('2024-02-01', '2024-02-29')).toBe('month');
  });

  it('does not classify cross-year ranges as "year"', () => {
    expect(inferRangeMode('2024-01-01', '2025-12-31')).toBe('custom');
  });

  it('returns "custom" for an arbitrary range', () => {
    expect(inferRangeMode('2024-03-05', '2024-03-20')).toBe('custom');
  });

  it('returns "week" (default) for empty input', () => {
    expect(inferRangeMode('', '')).toBe('week');
  });
});
