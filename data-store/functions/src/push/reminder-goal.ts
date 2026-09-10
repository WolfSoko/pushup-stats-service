import {
  currentPlanDayIndex,
  dailyReminderGoal,
  measurementValueField,
  planDayByIndex,
  planDayExercises,
  planDayProgress,
  planExerciseMeasurement,
  planReminderGoal,
  scaledPlanFor,
  sumRepsTarget,
  TRAINING_PLANS,
  type ComplexGoalEntry,
  type PlanExerciseEntryLike,
  type ReminderGoalState,
  type TrainingPlanDay,
  type UserTrainingPlan,
} from '@pu-stats/models';

/**
 * Which goal a push reminder is about, derived from Firestore data without
 * touching Firestore — the reads live in `reminder-goal-read.ts`.
 *
 * The dispatcher has no live entry stream, so progress comes from the
 * per-exercise day aggregates (`userStats/{uid}/perExercise/{id}.dailyReps`)
 * rather than from individual entries.
 */

/** What today's plan day prescribes, or `null` when it prescribes nothing. */
export function reminderPlanDay(
  userPlan: Partial<UserTrainingPlan> | undefined,
  today: string
): { dayIndex: number; day: TrainingPlanDay } | null {
  if (!userPlan || userPlan.status !== 'active') return null;
  if (!userPlan.planId || !userPlan.startDate) return null;
  const catalog = TRAINING_PLANS.find((p) => p.id === userPlan.planId);
  if (!catalog) return null;
  // Honour the opening max test: the user's reminder has to quote the same
  // numbers the plan page shows them.
  const plan = scaledPlanFor(catalog, { testResults: userPlan.testResults });
  if (!plan) return null;
  const dayIndex = currentPlanDayIndex(plan, userPlan.startDate, today);
  if (dayIndex === null) return null;
  const day = planDayByIndex(plan, dayIndex);
  if (!day || planDayExercises(day).length === 0) return null;
  return { dayIndex, day };
}

/** Exercise ids whose day totals a plan day's progress needs. */
export function reminderGoalExerciseIds(day: TrainingPlanDay): string[] {
  return [...new Set(planDayExercises(day).map((e) => e.exerciseId))];
}

/**
 * Day aggregates rendered as the entry list `planDayProgress` consumes —
 * one entry per exercise carrying its whole day total in the field that
 * matches the exercise's measurement.
 *
 * Unlike the app, this cannot honour `dayActivatedAt`: the aggregate has no
 * per-entry timestamps left to filter on. A plan activated earlier today
 * therefore counts reps logged before the activation, which can only make
 * the reminder pause sooner than the plan page would.
 */
function totalsAsEntries(
  day: TrainingPlanDay,
  totals: ReadonlyMap<string, number>,
  today: string
): PlanExerciseEntryLike[] {
  const entries: PlanExerciseEntryLike[] = [];
  for (const exerciseId of reminderGoalExerciseIds(day)) {
    const value = totals.get(exerciseId);
    if (!value) continue;
    const measurement = planExerciseMeasurement({ exerciseId });
    if (!measurement) continue;
    const field = measurementValueField(measurement);
    if (field === 'weightKg') continue;
    entries.push({
      exerciseId,
      timestamp: `${today}T12:00:00Z`,
      [field]: value,
    });
  }
  return entries;
}

/** Goal state for a plan day, or `null` when nothing is measurable. */
export function planGoalFromTotals(
  day: TrainingPlanDay,
  dayIndex: number,
  completedItems: ReadonlyArray<string> | undefined,
  totals: ReadonlyMap<string, number>,
  today: string
): ReminderGoalState | null {
  const progress = planDayProgress(day, dayIndex, {
    entries: totalsAsEntries(day, totals, today),
    dateIso: today,
    completedItems: completedItems ?? [],
  });
  return planReminderGoal(progress, dayIndex);
}

/**
 * The user's daily pushup goal, resolved the way `UserConfigStore` does:
 * the rep-sum of the complex daily goals when there are any, otherwise the
 * legacy single number. `0` means none configured.
 */
export function configuredDailyGoal(
  userConfigData: Record<string, unknown> | undefined
): number {
  const goals = userConfigData?.['goals'] as
    { daily?: ComplexGoalEntry[] } | undefined;
  const daily = goals?.daily;
  const sum = Array.isArray(daily) ? sumRepsTarget(daily) : 0;
  if (sum > 0) return sum;
  const legacy = Number(userConfigData?.['dailyGoal'] ?? 0);
  return Number.isFinite(legacy) && legacy > 0 ? Math.trunc(legacy) : 0;
}

/** Goal state for the configured daily goal, or `null` when there is none. */
export function dailyGoalFromTotals(
  userConfigData: Record<string, unknown> | undefined,
  pushupsToday: number
): ReminderGoalState | null {
  return dailyReminderGoal(pushupsToday, configuredDailyGoal(userConfigData));
}
