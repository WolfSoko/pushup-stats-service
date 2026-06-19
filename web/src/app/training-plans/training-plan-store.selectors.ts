import {
  findExerciseDefinition,
  trainingPlanDayExerciseId,
  TrainingPlanDay,
  UserTrainingPlan,
} from '@pu-stats/models';

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

/**
 * Whether a plan day can be honored off the `exerciseEntries` reps mirror.
 * Pushup short-circuits to true; other exercises must be reps-measured in
 * the catalog. Mirrors the guards in `logPlanDay` and the auto-mark effect.
 */
export function isRepsMeasuredPlanDay(day: TrainingPlanDay): boolean {
  const exerciseId = trainingPlanDayExerciseId(day);
  if (exerciseId === 'pushup') return true;
  const def = findExerciseDefinition(exerciseId);
  return !!def && def.measurement === 'reps';
}
