import { type UnifiedEntry, unifiedEntryPrimaryValue } from '@pu-stats/models';
import type { TrendPoint } from './analysis.types';

export const TREND_WEEKS = 8;
export const TREND_MONTHS = 6;

export function isoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export function isoWeekYear(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  return d.getUTCFullYear();
}

export function daysBetween(a: string, b: string): number {
  const ad = new Date(`${a}T00:00:00`).getTime();
  const bd = new Date(`${b}T00:00:00`).getTime();
  return Math.round((bd - ad) / 86_400_000);
}

export function sortedUniqueDates(
  rows: ReadonlyArray<{ timestamp: string }>
): string[] {
  return [...new Set(rows.map((x) => x.timestamp.slice(0, 10)))].sort((a, b) =>
    a.localeCompare(b)
  );
}

/** Monday of the ISO week containing the given date (local time, midnight). */
export function startOfIsoWeek(date: Date): Date {
  const day = date.getDay() || 7;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - (day - 1)
  );
}

/** First day of the calendar month containing the given date. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Longest run of consecutive days with at least one entry. */
export function computeLongestStreak(
  rows: ReadonlyArray<{ timestamp: string }>
): number {
  const dates = sortedUniqueDates(rows);
  if (!dates.length) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    if (daysBetween(dates[i - 1], dates[i]) === 1) current += 1;
    else current = 1;
    best = Math.max(best, current);
  }
  return best;
}

/** Consecutive-day streak ending at the most recent logged day. */
export function computeCurrentStreak(
  rows: ReadonlyArray<{ timestamp: string }>
): number {
  const dates = sortedUniqueDates(rows);
  if (!dates.length) return 0;
  let streak = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    if (daysBetween(dates[i - 1], dates[i]) === 1) streak += 1;
    else break;
  }
  return streak;
}

function rollUpTrend(
  rows: ReadonlyArray<UnifiedEntry>,
  buckets: Map<
    string,
    { total: number; entryCount: number; setsCount: number }
  >,
  keyOf: (date: Date) => string
): TrendPoint[] {
  for (const row of rows) {
    const entry = buckets.get(keyOf(new Date(row.timestamp)));
    if (!entry) continue;
    entry.total += unifiedEntryPrimaryValue(row);
    entry.entryCount += 1;
    entry.setsCount += row.sets?.length ?? 0;
  }
  return [...buckets.entries()]
    .reverse()
    .map(([label, { total, entryCount, setsCount }]) => ({
      label,
      total,
      avgSetsPerEntry: entryCount
        ? Math.round((setsCount / entryCount) * 10) / 10
        : undefined,
    }));
}

const weekKey = (date: Date): string =>
  `${isoWeekYear(date)}-W${String(isoWeek(date)).padStart(2, '0')}`;

const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/**
 * Pre-seeds {@link TREND_WEEKS} ISO weeks ending at `monday` so a sparse
 * history still produces a fixed-length trend with explicit zero rows;
 * otherwise users would silently see fewer than 8 buckets.
 */
export function buildWeekTrend(
  rows: ReadonlyArray<UnifiedEntry>,
  monday: Date
): TrendPoint[] {
  const byWeek = new Map<
    string,
    { total: number; entryCount: number; setsCount: number }
  >();
  for (let i = TREND_WEEKS - 1; i >= 0; i--) {
    const d = new Date(monday);
    d.setDate(monday.getDate() - i * 7);
    byWeek.set(weekKey(d), { total: 0, entryCount: 0, setsCount: 0 });
  }
  return rollUpTrend(rows, byWeek, weekKey);
}

/** Pre-seeds {@link TREND_MONTHS} calendar months ending at `monthStart`. */
export function buildMonthTrend(
  rows: ReadonlyArray<UnifiedEntry>,
  monthStart: Date
): TrendPoint[] {
  const byMonth = new Map<
    string,
    { total: number; entryCount: number; setsCount: number }
  >();
  for (let i = TREND_MONTHS - 1; i >= 0; i--) {
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth() - i, 1);
    byMonth.set(monthKey(d), { total: 0, entryCount: 0, setsCount: 0 });
  }
  return rollUpTrend(rows, byMonth, monthKey);
}
