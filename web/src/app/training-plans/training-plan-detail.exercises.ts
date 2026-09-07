import {
  findExerciseDefinition,
  formatExerciseValue,
  maxTestValue,
  planDayByIndex,
  planDayProgress,
  PlanExerciseProgress,
  planTestFields,
  type PlanScaleFactors,
  TrainingPlan,
  TrainingPlanDay,
} from '@pu-stats/models';
import {
  exerciseDisplayName,
  variantDisplayName,
} from '../stats/i18n/exercise-display-names';
import { DayExerciseRow, DayTestField } from './training-plan-detail.models';

const REPS_UNIT = $localize`:@@trainingPlans.reps:Wdh.`;
const SECONDS_UNIT = $localize`:@@trainingPlans.test.seconds:s`;

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

/**
 * Maps a `test` day's fields onto the rows the result form binds — one
 * per measurable exercise the day prescribes, each in its own unit.
 *
 * `percent` is null for an exercise the plan defines no baseline for: its
 * value is worth recording (it is the user's before/after figure) but
 * there is nothing to scale it against.
 */
export function buildTestFieldRows(
  day: TrainingPlanDay,
  results: ReadonlyMap<number, number>,
  factors: PlanScaleFactors,
  baselines: Readonly<Record<string, number>> | undefined
): DayTestField[] {
  return planTestFields(day).map((field) => {
    const def = findExerciseDefinition(field.exerciseId);
    const unit = def?.unit ?? 'reps';
    const variant = def?.variants?.find((v) => v.id === field.variantId);
    const base = exerciseDisplayName(field.exerciseId);
    const scalable = (baselines?.[field.exerciseId] ?? 0) > 0;
    const factor = factors.byExercise.get(field.exerciseId);
    return {
      itemIndex: field.itemIndex,
      name: variant ? `${base} · ${variantDisplayName(variant)}` : base,
      result: results.get(field.itemIndex) ?? null,
      recommended:
        field.recommended > 0
          ? formatExerciseValue(field.recommended, unit)
          : '',
      unit: field.measurement === 'time' ? SECONDS_UNIT : REPS_UNIT,
      isTime: field.measurement === 'time',
      max: maxTestValue(field.measurement),
      percent: scalable ? Math.round((factor ?? 1) * 100) : null,
    };
  });
}
