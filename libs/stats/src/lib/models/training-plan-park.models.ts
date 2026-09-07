import { TrainingPlan, UserTrainingPlan } from './training-plan.models';
import { startDateForTargetDay } from './training-plan-schedule.models';

/**
 * Parking a plan's progress when the user switches away from it.
 *
 * Only one plan is active at a time, and activating another replaces the
 * user's plan document wholesale. Without somewhere to put it, everything
 * the previous plan accumulated — completed days, skips, per-exercise
 * ticks, measured max tests — is gone the moment the user tries something
 * else. A parked record keeps it, so a switch is reversible.
 *
 * Parked records live at `userTrainingPlans/{userId}/history/{planId}`,
 * one per plan, and are consumed (deleted) when that plan is resumed.
 */

/** A plan's progress, set aside while the user trains something else. */
export interface ParkedTrainingPlan {
  planId: string;
  /**
   * The 1-based plan day the user was on when they left. Resuming
   * re-anchors `startDate` so today maps to this day again — the pause
   * itself should not read as a fortnight of missed training.
   */
  dayIndex: number;
  completedDays: number[];
  skippedDays?: number[];
  completedItems?: string[];
  testResults?: string[];
  /** ISO timestamp of the switch that parked this. */
  parkedAt: string;
}

/**
 * Whether a plan has anything worth keeping. A plan the user activated
 * and immediately switched away from has nothing to park, and asking them
 * about it would be a dialog with no stakes.
 */
export function planHasProgress(
  userPlan: Pick<
    UserTrainingPlan,
    'completedDays' | 'skippedDays' | 'completedItems' | 'testResults'
  > | null
): boolean {
  if (!userPlan) return false;
  return (
    userPlan.completedDays.length > 0 ||
    (userPlan.skippedDays?.length ?? 0) > 0 ||
    (userPlan.completedItems?.length ?? 0) > 0 ||
    (userPlan.testResults?.length ?? 0) > 0
  );
}

/** The record to write when switching away from `userPlan`. */
export function parkedFrom(
  userPlan: UserTrainingPlan,
  dayIndex: number,
  now: Date = new Date()
): ParkedTrainingPlan {
  return {
    planId: userPlan.planId,
    dayIndex: Math.max(1, dayIndex),
    completedDays: [...userPlan.completedDays],
    ...(userPlan.skippedDays?.length
      ? { skippedDays: [...userPlan.skippedDays] }
      : {}),
    ...(userPlan.completedItems?.length
      ? { completedItems: [...userPlan.completedItems] }
      : {}),
    ...(userPlan.testResults?.length
      ? { testResults: [...userPlan.testResults] }
      : {}),
    parkedAt: now.toISOString(),
  };
}

/**
 * The plan document that resumes a parked record, with `startDate`
 * re-anchored so today is the day the user left off. Falls back to a
 * plain start when the parked day no longer fits the plan (a retired or
 * re-versioned catalog entry).
 */
export function resumedPlanFrom(
  parked: ParkedTrainingPlan,
  plan: Pick<TrainingPlan, 'id' | 'totalDays'>,
  today: string
): Omit<UserTrainingPlan, 'userId'> {
  const startDate =
    startDateForTargetDay(plan.totalDays, parked.dayIndex, today) ?? today;
  return {
    planId: plan.id,
    startDate,
    status: 'active',
    completedDays: [...parked.completedDays],
    skippedDays: [...(parked.skippedDays ?? [])],
    completedItems: [...(parked.completedItems ?? [])],
    testResults: [...(parked.testResults ?? [])],
  };
}
