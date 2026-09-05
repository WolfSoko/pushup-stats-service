import type { AchievementId, TrainingPlan } from '@pu-stats/models';
import { deriveAchievements, isPlanCompleted } from '@pu-stats/models';

/**
 * Running counters behind the achievements, stored per user under an
 * Admin-SDK-only path.
 *
 * A cumulative day count cannot be read off the plan document: that doc
 * holds only the *current* plan and is overwritten when the user starts
 * a new one. So the total is carried here, and the current plan's days
 * are tracked separately until the user switches — at which point they
 * are folded into the total.
 */
export interface AchievementProgress {
  /** Plan days from every plan the user has left behind. */
  readonly planDayTotal: number;
  /** Catalog id of the plan `currentPlanDays` refers to. */
  readonly currentPlanId: string | null;
  /** Days completed in the current plan. Never decreases (see below). */
  readonly currentPlanDays: number;
  readonly completedPlanIds: ReadonlyArray<string>;
}

export const EMPTY_PROGRESS: AchievementProgress = {
  planDayTotal: 0,
  currentPlanId: null,
  currentPlanDays: 0,
  completedPlanIds: [],
};

export interface PlanSnapshot {
  readonly planId: string;
  readonly completedDays: ReadonlyArray<number>;
  readonly skippedDays: ReadonlyArray<number>;
}

/**
 * Folds one plan-document write into the stored progress.
 *
 * Two properties matter and are both deliberate:
 *
 * - **Monotonic.** `currentPlanDays` only ever grows. Un-marking a day
 *   is a legitimate correction, but it must not silently revoke a badge
 *   the user already earned and possibly shared.
 * - **Plan switches fold forward.** Starting a new plan banks the old
 *   plan's days into `planDayTotal`, so milestones keep counting across
 *   plans instead of resetting.
 */
export function advanceProgress(
  previous: AchievementProgress,
  snapshot: PlanSnapshot,
  plan: Pick<TrainingPlan, 'days'> | null
): AchievementProgress {
  const switched =
    previous.currentPlanId !== null &&
    previous.currentPlanId !== snapshot.planId;

  const planDayTotal = switched
    ? previous.planDayTotal + previous.currentPlanDays
    : previous.planDayTotal;
  const carried = switched ? 0 : previous.currentPlanDays;

  const currentPlanDays = Math.max(carried, snapshot.completedDays.length);

  const finished =
    plan !== null &&
    isPlanCompleted(plan, snapshot.completedDays, snapshot.skippedDays);
  const completedPlanIds =
    finished && !previous.completedPlanIds.includes(snapshot.planId)
      ? [...previous.completedPlanIds, snapshot.planId]
      : previous.completedPlanIds;

  return {
    planDayTotal,
    currentPlanId: snapshot.planId,
    currentPlanDays,
    completedPlanIds,
  };
}

/**
 * Achievement ids the progress entitles the user to, minus the ones
 * already awarded. Returns only additions — nothing is ever revoked.
 */
export function newlyEarned(
  progress: AchievementProgress,
  alreadyEarned: ReadonlyArray<AchievementId>
): ReadonlyArray<AchievementId> {
  const owned = new Set(alreadyEarned);
  return deriveAchievements({
    completedPlanDays: progress.planDayTotal + progress.currentPlanDays,
    completedPlanIds: progress.completedPlanIds,
  }).filter((id) => !owned.has(id));
}
