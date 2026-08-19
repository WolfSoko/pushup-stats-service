import {
  type ComplexGoalEntry,
  findExerciseDefinition,
  planDayExercises,
  type TrainingPlanDay,
} from '@pu-stats/models';

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
 * and unit there is nothing to score or format them against.
 */
export function planDayGoalEntries(
  day: TrainingPlanDay | null
): ComplexGoalEntry[] {
  if (!day) return [];
  const byExercise = new Map<string, ComplexGoalEntry>();
  for (const exercise of planDayExercises(day)) {
    if (exercise.target <= 0) continue;
    const def = findExerciseDefinition(exercise.exerciseId);
    if (!def) continue;
    const existing = byExercise.get(exercise.exerciseId);
    if (existing) {
      byExercise.set(exercise.exerciseId, {
        ...existing,
        target: existing.target + exercise.target,
      });
      continue;
    }
    byExercise.set(exercise.exerciseId, {
      id: `plan-today:${exercise.exerciseId}`,
      exerciseId: exercise.exerciseId,
      target: exercise.target,
      measurement: def.measurement,
      unit: def.unit,
    });
  }
  return [...byExercise.values()];
}
