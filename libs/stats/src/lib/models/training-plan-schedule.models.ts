import { TrainingPlan } from './training-plan.models';

/**
 * Calendar math for an active plan: mapping between a plan's
 * `startDate`, a calendar date, and the 1-based day index the user is
 * on. All dates are `YYYY-MM-DD` strings in the user's Berlin-anchored
 * local day (see `@pu-stats/date`).
 */

/**
 * Compute the current 1-based day number of an active plan based on
 * the calendar diff between `startDate` and `today`. Caps at
 * `plan.totalDays`. Returns `null` when the plan hasn't started yet
 * (today < startDate).
 */
export function currentPlanDayIndex(
  plan: Pick<TrainingPlan, 'totalDays'>,
  startDate: string,
  today: string
): number | null {
  const start = parseIsoDate(startDate);
  const now = parseIsoDate(today);
  if (!start || !now) return null;
  const diff = Math.round((now.getTime() - start.getTime()) / 86_400_000);
  if (diff < 0) return null;
  return Math.min(diff + 1, plan.totalDays);
}

/**
 * 1-based day index that `jumpToDay` should re-anchor `startDate` to
 * for a given target day and "today". Returns the ISO date the
 * `UserTrainingPlan.startDate` field should be set to so that
 * `currentPlanDayIndex(plan, result, today) === targetDayIndex`.
 *
 * Returns `null` for an out-of-range target. Does not mutate.
 */
export function startDateForTargetDay(
  totalDays: number,
  targetDayIndex: number,
  today: string
): string | null {
  if (targetDayIndex < 1 || targetDayIndex > totalDays) return null;
  const now = parseIsoDate(today);
  if (!now) return null;
  const start = new Date(now);
  start.setDate(now.getDate() - (targetDayIndex - 1));
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(value: string): Date | null {
  // Accept `YYYY-MM-DD` (Berlin date string). Normalize to local
  // midnight so the day diff is calendar-based, not millisecond-based.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(year, month - 1, day);
  // Reject impossible dates like 2026-02-30 — `Date()` would silently
  // overflow into the next month. Round-trip the components.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}
