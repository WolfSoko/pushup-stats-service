import {
  daysBetween,
  sortedUniqueDates,
  toBerlinIsoDate,
  toLocalIsoDate,
} from '@pu-stats/date';

export interface RepEntry {
  timestamp: string;
  reps: number;
}

/** ISO-week key (`YYYY-Www`) for today, in the Berlin timezone used by
 *  the server-side period-key aggregation. */
export function currentIsoWeekKey(): string {
  const berlinDate = toBerlinIsoDate(new Date());
  const [y, m, day] = berlinDate.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setHours(0, 0, 0, 0);
  const weekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() + 3 - weekday);
  const isoYear = d.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  firstThursday.setHours(0, 0, 0, 0);
  const ftDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() + 3 - ftDay);
  const week =
    1 +
    Math.round(
      (d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** `YYYY-MM` month key for today, in the Berlin timezone. */
export function currentMonthKey(): string {
  return toBerlinIsoDate(new Date()).slice(0, 7);
}

/**
 * Client-side fallback streak: consecutive logged days ending at the most
 * recent entry, but only when that entry is today or yesterday (`diff`
 * 0/1). Used when the precomputed server stats aren't available yet.
 */
export function computeStreakFromEntries(
  rows: ReadonlyArray<RepEntry>,
  today: string
): number {
  const dates = sortedUniqueDates(rows);
  if (!dates.length) return 0;
  const lastDate = dates[dates.length - 1];
  const diff = daysBetween(lastDate, today);
  if (diff > 1 || diff < 0) return 0;
  let streak = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    if (daysBetween(dates[i - 1], dates[i]) === 1) streak += 1;
    else break;
  }
  return streak;
}

/** Sum of reps logged in the ISO week (Mon–Sun) containing `today`. */
export function sumRepsInWeek(
  rows: ReadonlyArray<RepEntry>,
  today: string
): number {
  const [by, bm, bd] = today.split('-').map(Number);
  const todayDate = new Date(by, bm - 1, bd);
  const dayOfWeek = (todayDate.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() - dayOfWeek);
  const mondayStr = toLocalIsoDate(monday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const sundayStr = toLocalIsoDate(sunday);

  return rows
    .filter((entry) => {
      const day = entry.timestamp.slice(0, 10);
      return day >= mondayStr && day <= sundayStr;
    })
    .reduce((sum, entry) => sum + entry.reps, 0);
}

/** Sum of reps logged in the calendar month containing `today`. */
export function sumRepsInMonth(
  rows: ReadonlyArray<RepEntry>,
  today: string
): number {
  const prefix = today.slice(0, 7);
  return rows
    .filter((entry) => entry.timestamp.startsWith(prefix))
    .reduce((sum, entry) => sum + entry.reps, 0);
}

/** Capped 0–100 integer progress percentage; 0 when the goal is falsy. */
export function goalPercent(value: number, goal: number): number {
  return goal ? Math.min(100, Math.round((value / goal) * 100)) : 0;
}
