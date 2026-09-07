import {
  TrainingPlan,
  TrainingPlanDay,
  TrainingPlanExercise,
  UserTrainingPlan,
  planDayByIndex,
  trainingPlanDayExerciseId,
} from './training-plan.models';
import { planDayExercises } from './training-plan-exercise.models';
import { findExerciseDefinition } from './exercise.catalog';

/**
 * The max-test half of the training-plan model: reading and writing the
 * result of a `test` day, and locating which exercise of that day the
 * measured value belongs to. The scaling those results drive lives in
 * `training-plan-scaling.ts`.
 */

/** Stable id for one `test` day's result, as persisted in `testResults`. */
export function planTestResultId(dayIndex: number, reps: number): string {
  return `${dayIndex}:${reps}`;
}

/** Inverse of {@link planTestResultId}. Returns null for malformed ids. */
export function parsePlanTestResultId(
  id: string
): { dayIndex: number; reps: number } | null {
  const match = /^(\d+):(\d+)$/.exec(id);
  if (!match) return null;
  return { dayIndex: Number(match[1]), reps: Number(match[2]) };
}

/**
 * The result the user recorded for a `test` day, or null when they
 * haven't taken it.
 *
 * The write path replaces rather than appends, but a legacy or
 * hand-edited doc could still carry two entries for one day — last one
 * wins, so a resolved target never depends on array order.
 */
export function planTestResult(
  userPlan: Pick<UserTrainingPlan, 'testResults'> | null,
  dayIndex: number
): number | null {
  let found: number | null = null;
  for (const id of userPlan?.testResults ?? []) {
    const parsed = parsePlanTestResultId(id);
    if (parsed && parsed.dayIndex === dayIndex) found = parsed.reps;
  }
  return found;
}

/** Every `test` day of a plan, in day order. */
export function planTestDays(
  plan: Pick<TrainingPlan, 'days'>
): ReadonlyArray<TrainingPlanDay> {
  return plan.days.filter((d) => d.kind === 'test');
}

/**
 * The plan's opening max test — the one whose result rescales what comes
 * after it. Null when the plan's only test is its closing one: nothing
 * follows that, so there is nothing to rescale.
 */
export function planBaselineTestDay(
  plan: Pick<TrainingPlan, 'days'>
): TrainingPlanDay | null {
  const lastDayIndex = plan.days.reduce(
    (max, d) => Math.max(max, d.dayIndex),
    0
  );
  return planTestDays(plan).find((d) => d.dayIndex < lastDayIndex) ?? null;
}

/**
 * The plan's closing max test, for the before/after comparison. Null when
 * the plan opens with a test but never closes with one.
 */
export function planFinalTestDay(
  plan: Pick<TrainingPlan, 'days'>
): TrainingPlanDay | null {
  const tests = planTestDays(plan);
  const last = tests[tests.length - 1];
  if (!last) return null;
  return last === planBaselineTestDay(plan) ? null : last;
}

/** Which exercise of a `test` day the measured maximum is recorded against. */
export interface PlanTestExercise {
  readonly exerciseId: string;
  readonly variantId?: string;
  /**
   * Position in the day's exercise list, or null when the day prescribes
   * nothing measurable ("just go to failure", `targetReps: 0`). A null
   * index has no row to tick, so recording the result closes the day
   * directly instead.
   */
  readonly itemIndex: number | null;
  /** The day's own recommendation, 0 when it prescribes none. */
  readonly recommended: number;
}

function isRepsMeasured(exercise: TrainingPlanExercise): boolean {
  return findExerciseDefinition(exercise.exerciseId)?.measurement === 'reps';
}

/**
 * The exercise a `test` day measures. Multi-exercise tests (Full Body's
 * "max pushups · 50 squats · 1 min plank") pair the max attempt with
 * ordinary prescribed work, so the maximum is recorded against the first
 * rep-counted item and the rest stay normal check-off rows.
 */
export function planTestExercise(day: TrainingPlanDay): PlanTestExercise {
  const items = planDayExercises(day);
  const itemIndex = items.findIndex(isRepsMeasured);
  const item = itemIndex >= 0 ? items[itemIndex] : null;
  if (!item) {
    return {
      exerciseId: trainingPlanDayExerciseId(day),
      ...(day.variantId ? { variantId: day.variantId } : {}),
      itemIndex: null,
      recommended: Math.max(0, day.targetReps),
    };
  }
  return {
    exerciseId: item.exerciseId,
    ...(item.variantId ? { variantId: item.variantId } : {}),
    itemIndex,
    recommended: item.target,
  };
}

/** Largest result a max test accepts, guarding against a stray keypress. */
export const MAX_TEST_REPS = 2000;

/**
 * Whether a value is a usable max-test result: a whole number of reps,
 * at least 1, below the typo guard.
 */
export function isValidTestResult(reps: number): boolean {
  return Number.isInteger(reps) && reps >= 1 && reps <= MAX_TEST_REPS;
}

/** True when `dayIndex` is a `test` day of the plan. */
export function isTestDay(
  plan: Pick<TrainingPlan, 'days'>,
  dayIndex: number
): boolean {
  return planDayByIndex(plan, dayIndex)?.kind === 'test';
}
