import { sortedUniqueDates } from './sorted-unique-dates';

describe('sortedUniqueDates', () => {
  it('dedupes to day granularity and sorts ascending', () => {
    const rows = [
      { timestamp: '2026-06-03T10:00:00' },
      { timestamp: '2026-06-01T08:00:00' },
      { timestamp: '2026-06-01T20:00:00' },
    ];
    expect(sortedUniqueDates(rows)).toEqual(['2026-06-01', '2026-06-03']);
  });

  it('returns an empty array for no rows', () => {
    expect(sortedUniqueDates([])).toEqual([]);
  });
});
