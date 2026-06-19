import {
  computeStreakFromEntries,
  currentIsoWeekKey,
  currentMonthKey,
  daysBetween,
  goalPercent,
  type RepEntry,
  sortedUniqueDates,
  sumRepsInMonth,
  sumRepsInWeek,
} from './dashboard-math';

function row(timestamp: string, reps: number): RepEntry {
  return { timestamp, reps };
}

describe('sortedUniqueDates', () => {
  it('should dedupe to day granularity and sort ascending', () => {
    // given
    const rows = [
      row('2026-06-03T10:00:00', 5),
      row('2026-06-01T08:00:00', 5),
      row('2026-06-01T20:00:00', 5),
    ];
    // when / then
    expect(sortedUniqueDates(rows)).toEqual(['2026-06-01', '2026-06-03']);
  });
});

describe('daysBetween', () => {
  it('should count whole calendar days, ignoring time of day', () => {
    // given / when / then
    expect(daysBetween('2026-06-01', '2026-06-02')).toBe(1);
    expect(daysBetween('2026-06-01', '2026-06-01')).toBe(0);
    expect(daysBetween('2026-06-02', '2026-06-01')).toBe(-1);
  });
});

describe('computeStreakFromEntries', () => {
  it('should return 0 for no rows', () => {
    expect(computeStreakFromEntries([], '2026-06-15')).toBe(0);
  });

  it('should count consecutive days ending today', () => {
    // given three consecutive days ending on "today"
    const rows = [
      row('2026-06-13T10:00:00', 10),
      row('2026-06-14T10:00:00', 10),
      row('2026-06-15T10:00:00', 10),
    ];
    // when / then
    expect(computeStreakFromEntries(rows, '2026-06-15')).toBe(3);
  });

  it('should still count when the last entry was yesterday', () => {
    // given last entry one day before today
    const rows = [
      row('2026-06-13T10:00:00', 10),
      row('2026-06-14T10:00:00', 10),
    ];
    // when / then
    expect(computeStreakFromEntries(rows, '2026-06-15')).toBe(2);
  });

  it('should return 0 when the last entry is older than yesterday', () => {
    // given a stale last entry (>1 day gap to today)
    const rows = [row('2026-06-10T10:00:00', 10)];
    // when / then
    expect(computeStreakFromEntries(rows, '2026-06-15')).toBe(0);
  });
});

describe('sumRepsInWeek', () => {
  it('should sum only entries within the ISO week (Mon–Sun) of today', () => {
    // given 2026-06-15 is a Monday; its week is 2026-06-15..06-21
    const rows = [
      row('2026-06-14T10:00:00', 100), // previous Sunday — excluded
      row('2026-06-15T10:00:00', 10),
      row('2026-06-21T10:00:00', 20), // Sunday — included
      row('2026-06-22T10:00:00', 100), // next Monday — excluded
    ];
    // when / then
    expect(sumRepsInWeek(rows, '2026-06-15')).toBe(30);
  });
});

describe('sumRepsInMonth', () => {
  it('should sum only entries in the same calendar month as today', () => {
    // given
    const rows = [
      row('2026-05-31T10:00:00', 100),
      row('2026-06-01T10:00:00', 10),
      row('2026-06-30T10:00:00', 20),
      row('2026-07-01T10:00:00', 100),
    ];
    // when / then
    expect(sumRepsInMonth(rows, '2026-06-15')).toBe(30);
  });
});

describe('goalPercent', () => {
  it('should return a capped 0–100 integer and 0 for a falsy goal', () => {
    // given / when / then
    expect(goalPercent(5, 10)).toBe(50);
    expect(goalPercent(15, 10)).toBe(100);
    expect(goalPercent(1, 3)).toBe(33);
    expect(goalPercent(5, 0)).toBe(0);
  });
});

describe('currentIsoWeekKey / currentMonthKey', () => {
  it('should produce well-formed period keys for the current date', () => {
    // given / when / then
    expect(currentIsoWeekKey()).toMatch(/^\d{4}-W\d{2}$/);
    expect(currentMonthKey()).toMatch(/^\d{4}-\d{2}$/);
  });
});
