import {
  TrainingPlan,
  TrainingPlanDay,
  UserTrainingPlan,
  planDayByIndex,
  trainingPlanDayExerciseId,
} from './training-plan.models';
import { planDayExercises } from './training-plan-exercise.models';
import { findExerciseDefinition } from './exercise.catalog';
import { MeasurementType } from './exercise.models';

/**
 * The max-test half of the training-plan model: reading and writing what
 * a `test` day measured, and working out which of the day's exercises it
 * measures. The scaling those results drive lives in
 * `training-plan-scaling.ts`.
 *
 * A test day can measure several things at once — Core Foundations opens
 * with a max plank hold, ten pushups and a max hollow hold — so results
 * are keyed by exercise position within the day, not by the day alone.
 */

/** Stable id for one measured value, as persisted in `testResults`. */
export function planTestResultId(
  dayIndex: number,
  itemIndex: number,
  value: number
): string {
  return `${dayIndex}:${itemIndex}:${value}`;
}

/**
 * Inverse of {@link planTestResultId}. Returns null for malformed ids.
 *
 * Two-part ids (`"1:37"`) come from the single-value shape that shipped
 * before test days could measure more than one exercise, and resolve to
 * the day's first field.
 */
export function parsePlanTestResultId(
  id: string
): { dayIndex: number; itemIndex: number; value: number } | null {
  const three = /^(\d+):(\d+):(\d+)$/.exec(id);
  if (three) {
    return {
      dayIndex: Number(three[1]),
      itemIndex: Number(three[2]),
      value: Number(three[3]),
    };
  }
  const two = /^(\d+):(\d+)$/.exec(id);
  if (!two) return null;
  return { dayIndex: Number(two[1]), itemIndex: 0, value: Number(two[2]) };
}

/**
 * Everything the user recorded for one `test` day, keyed by field index.
 *
 * The write path replaces rather than appends, but a legacy or
 * hand-edited doc could still carry two values for one field — last one
 * wins, so a resolved target never depends on array order luck.
 */
export function planTestResults(
  userPlan: Pick<UserTrainingPlan, 'testResults'> | null,
  dayIndex: number
): ReadonlyMap<number, number> {
  const out = new Map<number, number>();
  for (const id of userPlan?.testResults ?? []) {
    const parsed = parsePlanTestResultId(id);
    if (parsed && parsed.dayIndex === dayIndex) {
      out.set(parsed.itemIndex, parsed.value);
    }
  }
  return out;
}

/** One measured value of a `test` day, or null when it wasn't recorded. */
export function planTestResult(
  userPlan: Pick<UserTrainingPlan, 'testResults'> | null,
  dayIndex: number,
  itemIndex: number
): number | null {
  return planTestResults(userPlan, dayIndex).get(itemIndex) ?? null;
}

/** Every `test` day of a plan, in day order. */
export function planTestDays(
  plan: Pick<TrainingPlan, 'days'>
): ReadonlyArray<TrainingPlanDay> {
  return plan.days.filter((d) => d.kind === 'test');
}

/**
 * The plan's opening max test — the one whose results rescale what comes
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

/** One value a `test` day asks the user to record. */
export interface PlanTestField {
  /** Position within the day, and the key the result is stored under. */
  readonly itemIndex: number;
  readonly exerciseId: string;
  readonly variantId?: string;
  /** The day's own recommendation, 0 when it prescribes none. */
  readonly recommended: number;
  /** Drives the unit shown and the entry field a result is written to. */
  readonly measurement: MeasurementType;
  /**
   * False when the day lists no exercises at all ("just go to failure").
   * Such a field has no exercise row to tick, so recording it closes the
   * day directly.
   */
  readonly hasItem: boolean;
}

/** Measurements a max test can be recorded in. */
function isMeasurable(measurement: MeasurementType | null): boolean {
  return measurement === 'reps' || measurement === 'time';
}

/**
 * The values a `test` day asks for — one per measurable exercise it
 * prescribes, in the order the day lists them.
 *
 * A day that prescribes nothing measurable still gets one field: its
 * description asks the user for a baseline, so there has to be somewhere
 * to put it.
 */
export function planTestFields(
  day: TrainingPlanDay
): ReadonlyArray<PlanTestField> {
  const fields: PlanTestField[] = [];
  planDayExercises(day).forEach((exercise, itemIndex) => {
    const measurement =
      findExerciseDefinition(exercise.exerciseId)?.measurement ?? null;
    if (!isMeasurable(measurement)) return;
    fields.push({
      itemIndex,
      exerciseId: exercise.exerciseId,
      ...(exercise.variantId ? { variantId: exercise.variantId } : {}),
      recommended: exercise.target,
      measurement: measurement as MeasurementType,
      hasItem: true,
    });
  });
  if (fields.length > 0) return fields;
  return [
    {
      itemIndex: 0,
      exerciseId: trainingPlanDayExerciseId(day),
      ...(day.variantId ? { variantId: day.variantId } : {}),
      recommended: Math.max(0, day.targetReps),
      measurement: 'reps',
      hasItem: false,
    },
  ];
}

/** Largest result a max test accepts, guarding against a stray keypress. */
export const MAX_TEST_REPS = 2000;
/** Largest hold a max test accepts, in seconds (just under three hours). */
export const MAX_TEST_SECONDS = 10_000;

/** The ceiling a result is checked against, by measurement. */
export function maxTestValue(measurement: MeasurementType): number {
  return measurement === 'time' ? MAX_TEST_SECONDS : MAX_TEST_REPS;
}

/**
 * Whether a value is a usable max-test result: a whole number, at least
 * 1, below the typo guard for its unit.
 */
export function isValidTestResult(
  value: number,
  measurement: MeasurementType = 'reps'
): boolean {
  return (
    Number.isInteger(value) && value >= 1 && value <= maxTestValue(measurement)
  );
}

/** True when `dayIndex` is a `test` day of the plan. */
export function isTestDay(
  plan: Pick<TrainingPlan, 'days'>,
  dayIndex: number
): boolean {
  return planDayByIndex(plan, dayIndex)?.kind === 'test';
}
