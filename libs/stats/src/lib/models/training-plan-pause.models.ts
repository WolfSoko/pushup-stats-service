import type { TrainingPlan, UserTrainingPlan } from './training-plan.models';
import { startDateForTargetDay } from './training-plan-schedule.models';

/**
 * Pausing a running plan — for a holiday, an injury, or a week where
 * training simply isn't happening.
 *
 * A plan's current day is derived from `startDate` plus the calendar diff,
 * so doing nothing for two weeks does not pause a plan: it burns fourteen
 * days of it. Pausing freezes the day the user was on
 * (`pausedDayIndex`) and resuming re-anchors `startDate` so that day is
 * today again. The break costs no plan days, and because `startDate` is
 * left alone *during* the break, every completed day keeps pointing at the
 * date it actually happened on.
 *
 * A paused plan is not an active plan: `status` alone gates goal takeover,
 * auto-marking and day writes, so the break stops those without any
 * consumer needing to know about pausing.
 */

/** Whether the plan document is on hold. */
export function isPausedPlan(
  userPlan: Pick<UserTrainingPlan, 'status'> | null | undefined
): boolean {
  return userPlan?.status === 'paused';
}

/**
 * The day a paused plan is frozen on, or `null` when it isn't paused (or
 * carries no usable frozen day — a hand-edited or out-of-range value).
 * Consumers read the plan's current day through this so a paused plan
 * shows the day the user left off rather than one the break ran past.
 */
export function pausedPlanDayIndex(
  userPlan: Pick<UserTrainingPlan, 'status' | 'pausedDayIndex'> | null,
  totalDays: number
): number | null {
  if (!isPausedPlan(userPlan)) return null;
  const frozen = userPlan?.pausedDayIndex;
  if (typeof frozen !== 'number' || !Number.isInteger(frozen)) return null;
  if (frozen < 1 || frozen > totalDays) return null;
  return frozen;
}

/** The patch that puts a plan on hold at `dayIndex`. */
export function pausedPlanPatch(
  dayIndex: number,
  now: Date = new Date()
): Required<Pick<UserTrainingPlan, 'status' | 'pausedAt' | 'pausedDayIndex'>> {
  return {
    status: 'paused',
    pausedAt: now.toISOString(),
    pausedDayIndex: Math.max(1, dayIndex),
  };
}

/**
 * The `startDate` a resumed plan needs so today maps to the day it was
 * paused on. `null` when there is nothing to re-anchor to — a plan without
 * a usable frozen day resumes on its original schedule rather than being
 * re-anchored to a guess.
 */
export function resumeStartDate(
  userPlan: Pick<UserTrainingPlan, 'status' | 'pausedDayIndex'> | null,
  plan: Pick<TrainingPlan, 'totalDays'> | null,
  today: string
): string | null {
  if (!plan) return null;
  const frozen = pausedPlanDayIndex(userPlan, plan.totalDays);
  if (frozen === null) return null;
  return startDateForTargetDay(plan.totalDays, frozen, today);
}
