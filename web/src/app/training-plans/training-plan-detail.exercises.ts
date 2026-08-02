import {
  findExerciseDefinition,
  formatExerciseValue,
  planDayByIndex,
  planDayProgress,
  PlanExerciseProgress,
  TrainingPlan,
} from '@pu-stats/models';
import {
  exerciseDisplayName,
  variantDisplayName,
} from '../stats/i18n/exercise-display-names';
import { DayExerciseRow } from './training-plan-detail.models';

/**
 * Maps a day's per-exercise fulfillment onto the row view-model the
 * detail template binds. Every value is pre-formatted in the exercise's
 * own unit (reps, `m:ss` holds, meters), so the template stays free of
 * measurement branching.
 */
export function buildExerciseRows(
  progress: ReadonlyArray<PlanExerciseProgress>
): DayExerciseRow[] {
  return progress.map((item) => {
    const { exercise } = item;
    const def = findExerciseDefinition(exercise.exerciseId);
    const unit = def?.unit ?? 'reps';
    const variant = def?.variants?.find((v) => v.id === exercise.variantId);
    const base = exerciseDisplayName(exercise.exerciseId);
    const quantified = exercise.target > 0;
    return {
      itemIndex: item.itemIndex,
      name: variant ? `${base} · ${variantDisplayName(variant)}` : base,
      target: quantified ? formatExerciseValue(exercise.target, unit) : '',
      logged: quantified ? formatExerciseValue(item.logged, unit) : '',
      sets:
        exercise.sets && exercise.sets.length > 1
          ? exercise.sets.map((v) => formatExerciseValue(v, unit)).join(' · ')
          : '',
      percent: quantified
        ? Math.min(100, Math.round((item.logged / exercise.target) * 100))
        : 0,
      quantified,
      done: item.done,
      auto: item.fulfilledByEntries,
    };
  });
}

/**
 * Marks every exercise of a day as done. Used for days the user closed
 * as a whole ("nur abhaken", or a completion that predates per-exercise
 * tracking) — leaving the list open under a finished day would read as
 * unfinished work.
 */
export function asCompletedRows(
  rows: ReadonlyArray<DayExerciseRow>
): DayExerciseRow[] {
  return rows.map((row) => ({ ...row, done: true }));
}

/**
 * Zero-progress fulfillment for a plan the user hasn't started. Lets the
 * detail page render the same exercise list for a preview as for an
 * active plan, without a second code path in the template.
 */
export function previewDayProgress(
  plan: TrainingPlan,
  dayIndex: number
): ReadonlyArray<PlanExerciseProgress> {
  const day = planDayByIndex(plan, dayIndex);
  if (!day) return [];
  return planDayProgress(day, dayIndex, {
    entries: [],
    dateIso: '',
    completedItems: [],
  });
}
