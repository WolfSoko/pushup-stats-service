import {
  type ComplexGoalEntry,
  findExerciseDefinition,
  planDayExercises,
  type TrainingPlanDay,
} from '@pu-stats/models';

/** One daily goal derived from a plan day, with the items it covers. */
export interface PlanDayGoal {
  readonly entry: ComplexGoalEntry;
  /** Positions in `planDayExercises(day)` this goal aggregates. */
  readonly itemIndexes: readonly number[];
}

/**
 * Today's plan day expressed as daily goals, so the toolbar pill, its
 * dropdown and the Quick-Add goal submenu list every exercise the day
 * prescribes instead of only its pushup portion.
 *
 * Two rules keep this in step with `planDayProgress`, which decides
 * fulfillment on the plan page:
 *
 * - A pinned `variantId` is dropped: plan fulfillment counts every entry
 *   for the exercise, so carrying the variant into the goal would leave
 *   the toolbar at 0% for a day the plan already considers done.
 * - Items repeating an exercise (Plank and Side Plank both resolve to
 *   `plank.standard`) collapse into one goal with the summed target,
 *   mirroring the shared pool those items draw from — separate rows
 *   would each count the same logged seconds.
 *
 * Exercises missing from the catalog are skipped: without a measurement
 * and unit there is nothing to score or format them against. So are
 * unquantified items (a HIIT round's `target: 0`) — they carry no
 * number a goal could be scored against, and the day's tick-off closes
 * them instead.
 */
export function planDayGoals(day: TrainingPlanDay | null): PlanDayGoal[] {
  if (!day) return [];
  const byExercise = new Map<string, PlanDayGoal>();
  planDayExercises(day).forEach((exercise, itemIndex) => {
    if (exercise.target <= 0) return;
    const def = findExerciseDefinition(exercise.exerciseId);
    if (!def) return;
    const existing = byExercise.get(exercise.exerciseId);
    if (existing) {
      byExercise.set(exercise.exerciseId, {
        entry: {
          ...existing.entry,
          target: existing.entry.target + exercise.target,
        },
        itemIndexes: [...existing.itemIndexes, itemIndex],
      });
      return;
    }
    byExercise.set(exercise.exerciseId, {
      entry: {
        id: `plan-today:${exercise.exerciseId}`,
        exerciseId: exercise.exerciseId,
        target: exercise.target,
        measurement: def.measurement,
        unit: def.unit,
      },
      itemIndexes: [itemIndex],
    });
  });
  return [...byExercise.values()];
}
