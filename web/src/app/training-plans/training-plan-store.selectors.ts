import { TrainingPlanDay, UserTrainingPlan } from '@pu-stats/models';

/** Whether a 1-based day index is in the plan's completed set. */
export function isDayDone(
  plan: UserTrainingPlan | null,
  dayIndex: number | null
): boolean {
  if (!plan || dayIndex === null) return false;
  return plan.completedDays.includes(dayIndex);
}

/** Whether a 1-based day index is in the plan's skipped set. */
export function isDaySkipped(
  plan: UserTrainingPlan | null,
  dayIndex: number | null
): boolean {
  if (!plan || dayIndex === null) return false;
  return (plan.skippedDays ?? []).includes(dayIndex);
}

/** Target reps for a day, 0 when there is no day. */
export function dayTarget(day: TrainingPlanDay | null): number {
  return day?.targetReps ?? 0;
}
