import type { UnifiedEntry } from '@pu-stats/models';
import {
  buildMonthTrend,
  buildWeekTrend,
  computeCurrentStreak,
  computeLongestStreak,
  daysBetween,
  isoWeek,
  isoWeekYear,
  sortedUniqueDates,
  startOfIsoWeek,
  startOfMonth,
  TREND_MONTHS,
  TREND_WEEKS,
} from './trend-math';

function repEntry(
  timestamp: string,
  reps: number,
  sets?: number[]
): UnifiedEntry {
  return {
    kind: 'exercise',
    _id: `${timestamp}-${reps}`,
    timestamp,
    reps,
    exerciseId: 'pushup',
    source: 'test',
    ...(sets ? { sets } : {}),
  };
}

describe('daysBetween', () => {
  it('should count whole calendar days between two ISO dates', () => {
    // given / when / then
    expect(daysBetween('2026-01-01', '2026-01-02')).toBe(1);
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
    expect(daysBetween('2026-03-01', '2026-02-28')).toBe(-1);
  });
});

describe('sortedUniqueDates', () => {
  it('should dedupe to day granularity and sort ascending', () => {
    // given
    const rows = [
      { timestamp: '2026-01-03T10:00:00' },
      { timestamp: '2026-01-01T08:00:00' },
      { timestamp: '2026-01-01T20:00:00' },
    ];
    // when
    const dates = sortedUniqueDates(rows);
    // then
    expect(dates).toEqual(['2026-01-01', '2026-01-03']);
  });
});

describe('isoWeek / isoWeekYear', () => {
  it('should place the 2026-01-01 Thursday in ISO week 1 of 2026', () => {
    // given
    const date = new Date(2026, 0, 1);
    // then
    expect(isoWeek(date)).toBe(1);
    expect(isoWeekYear(date)).toBe(2026);
  });
});

describe('startOfIsoWeek / startOfMonth', () => {
  it('should return the Monday of the ISO week', () => {
    // given a Wednesday
    const wed = new Date(2026, 5, 17);
    // when
    const monday = startOfIsoWeek(wed);
    // then
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(15);
  });

  it('should return the first day of the month', () => {
    expect(startOfMonth(new Date(2026, 5, 17)).getDate()).toBe(1);
  });
});

describe('computeLongestStreak / computeCurrentStreak', () => {
  it('should return 0 for no entries', () => {
    expect(computeLongestStreak([])).toBe(0);
    expect(computeCurrentStreak([])).toBe(0);
  });

  it('should measure the longest consecutive-day run', () => {
    // given three consecutive days then a gap then two days
    const rows = [
      repEntry('2026-01-01T10:00:00', 5),
      repEntry('2026-01-02T10:00:00', 5),
      repEntry('2026-01-03T10:00:00', 5),
      repEntry('2026-01-10T10:00:00', 5),
      repEntry('2026-01-11T10:00:00', 5),
    ];
    // then
    expect(computeLongestStreak(rows)).toBe(3);
    // current streak only counts the most recent run
    expect(computeCurrentStreak(rows)).toBe(2);
  });
});

describe('buildWeekTrend', () => {
  it('should always emit TREND_WEEKS buckets with seeded zeros', () => {
    // given an empty history
    const monday = startOfIsoWeek(new Date(2026, 5, 15));
    // when
    const trend = buildWeekTrend([], monday);
    // then
    expect(trend).toHaveLength(TREND_WEEKS);
    expect(trend.every((p) => p.total === 0)).toBe(true);
  });

  it('should sum primary value and average sets into the matching week', () => {
    // given two entries in the current week
    const monday = startOfIsoWeek(new Date(2026, 5, 15));
    const inWeek = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}T10:00:00`;
    const rows = [repEntry(inWeek, 30, [10, 20]), repEntry(inWeek, 10, [10])];
    // when — trends are emitted newest-first, so the current week leads
    const trend = buildWeekTrend(rows, monday);
    const current = trend[0];
    // then
    expect(current.total).toBe(40);
    expect(current.avgSetsPerEntry).toBe(1.5);
  });
});

describe('buildMonthTrend', () => {
  it('should always emit TREND_MONTHS buckets', () => {
    const trend = buildMonthTrend([], startOfMonth(new Date(2026, 5, 1)));
    expect(trend).toHaveLength(TREND_MONTHS);
  });
});
