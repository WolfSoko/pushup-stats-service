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

  it('returns "year" for a leap-year full range', () => {
    // 2024 is a leap year — Feb has 29 days, but year start/end are unaffected
    expect(inferRangeMode('2024-01-01', '2024-12-31')).toBe('year');
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
