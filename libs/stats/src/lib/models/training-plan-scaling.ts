import {
  TrainingPlan,
  TrainingPlanDay,
  TrainingPlanExercise,
  UserTrainingPlan,
  trainingPlanDayExerciseId,
} from './training-plan.models';
import {
  planBaselineTestDay,
  planTestResult,
} from './training-plan-test.models';

/**
 * Rescaling a curated plan to the user's measured starting strength.
 *
 * A plan that opens with a max test is written for one particular
 * baseline (`TrainingPlan.baselineMaxReps`). Someone who tests at half
 * that baseline is handed a plan they cannot finish; someone at double
 * it is handed one that never challenges them. Once the opening test has
 * a result, every later day is scaled by the ratio between the two.
 *
 * Skipping the test leaves the factor at exactly 1, and a factor of 1
 * returns the catalog object itself — so the untested path is not merely
 * numerically unchanged, it is the very same object the catalog exports.
 */

/**
 * Bounds on the scale factor. A plan is a progression, not a pure
 * multiple of a single number: past roughly ±2× the structure it was
 * written around (set counts, rest intervals, weekly ramp) stops making
 * sense, and an unbounded factor would turn one fat-fingered test result
 * into weeks of unusable targets.
 */
export const MIN_PLAN_SCALE = 0.5;
export const MAX_PLAN_SCALE = 2;

/** Factor resolution for the memo cache — 1 % steps are finer than any
 *  rounded rep target can resolve. */
const FACTOR_PRECISION = 100;

/**
 * How far the user's opening test sits from the baseline the plan was
 * written for. Exactly 1 — meaning "leave the catalog alone" — whenever
 * the plan has no opening test, names no baseline, or the user hasn't
 * recorded a result.
 */
export function planScaleFactor(
  plan: Pick<TrainingPlan, 'days' | 'baselineMaxReps'> | null,
  userPlan: Pick<UserTrainingPlan, 'testResults'> | null
): number {
  if (!plan) return 1;
  const baseline = plan.baselineMaxReps ?? 0;
  if (baseline <= 0) return 1;
  const testDay = planBaselineTestDay(plan);
  if (!testDay) return 1;
  const measured = planTestResult(userPlan, testDay.dayIndex);
  if (measured === null || measured <= 0) return 1;
  const raw = measured / baseline;
  const clamped = Math.min(MAX_PLAN_SCALE, Math.max(MIN_PLAN_SCALE, raw));
  return Math.round(clamped * FACTOR_PRECISION) / FACTOR_PRECISION;
}

/** Scales one target, keeping "unquantified" (`<= 0`) targets unquantified. */
function scaleValue(value: number, factor: number): number {
  if (value <= 0) return value;
  return Math.max(1, Math.round(value * factor));
}

/**
 * Redistributes a set breakdown onto a new total, preserving each set's
 * share of the original. The remainder left by rounding is pushed onto
 * the largest sets, so the result still sums to `total` — the invariant
 * the catalog guard tests hold the hand-written plans to.
 */
export function scaleBreakdown(
  sets: ReadonlyArray<number>,
  total: number
): number[] {
  const original = sets.reduce((sum, s) => sum + s, 0);
  if (original <= 0 || total <= 0 || sets.length === 0) return [...sets];
  const out = sets.map((s) => Math.max(1, Math.round((s / original) * total)));
  let drift = total - out.reduce((sum, s) => sum + s, 0);
  // Order by size so the correction lands on the heaviest sets, where a
  // rep either way is least noticeable.
  const order = out
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value || a.index - b.index)
    .map((e) => e.index);
  let cursor = 0;
  // `guard` bounds the walk for the one case that cannot be satisfied:
  // a total below `sets.length`, where every set is already at its
  // floor of 1 and no further reduction is possible.
  let guard = out.length * Math.abs(drift) + out.length;
  while (drift !== 0 && guard-- > 0) {
    const index = order[cursor % order.length];
    cursor++;
    if (drift > 0) {
      out[index]++;
      drift--;
    } else if (out[index] > 1) {
      out[index]--;
      drift++;
    }
  }
  return out;
}

/**
 * Scales a day's exercise list. Rep-counted items belonging to the day's
 * headline exercise are scaled as one breakdown so their sum still
 * mirrors `targetReps` — the dashboard goal pill reads that field, and a
 * structured day whose pushup items drifted away from it would show the
 * user two different numbers for the same work.
 */
function scaleExercises(
  exercises: ReadonlyArray<TrainingPlanExercise>,
  factor: number,
  headlineId: string,
  scaledTargetReps: number
): TrainingPlanExercise[] {
  // Unquantified items (`target === 0`, only legal on checkoff days) stay
  // out of the breakdown: giving them a share would both invent a target
  // the plan deliberately left open and starve the quantified ones.
  const headlineIndexes = exercises
    .map((e, i) => (e.exerciseId === headlineId && e.target > 0 ? i : -1))
    .filter((i) => i >= 0);
  const headlineTargets = headlineIndexes.map((i) => exercises[i].target);
  const scaledHeadline = scaleBreakdown(headlineTargets, scaledTargetReps);
  const byIndex = new Map(
    headlineIndexes.map((planIndex, n) => [planIndex, scaledHeadline[n]])
  );

  return exercises.map((exercise, index) => {
    const target = byIndex.get(index) ?? scaleValue(exercise.target, factor);
    return {
      ...exercise,
      target,
      ...(exercise.sets ? { sets: scaleBreakdown(exercise.sets, target) } : {}),
    };
  });
}

/**
 * Scales one day. Rest days have nothing to scale, and `test` days are
 * left alone by design: a max test asks for everything the user has, so
 * a prescribed number is a reference point, not a target to move.
 */
export function scaleTrainingPlanDay(
  day: TrainingPlanDay,
  factor: number
): TrainingPlanDay {
  if (factor === 1 || day.kind === 'rest' || day.kind === 'test') return day;
  const targetReps = scaleValue(day.targetReps, factor);
  return {
    ...day,
    targetReps,
    ...(day.sets ? { sets: scaleBreakdown(day.sets, targetReps) } : {}),
    ...(day.exercises
      ? {
          exercises: scaleExercises(
            day.exercises,
            factor,
            trainingPlanDayExerciseId(day),
            targetReps
          ),
        }
      : {}),
  };
}

// Scaled plans are memoised per catalog entry and factor. `activeCatalog`
// is a computed signal feeding `planDayExercises`' own per-day WeakMap
// cache and a tree of downstream computeds; handing them a freshly built
// plan on every recomputation would invalidate all of it for numbers that
// did not change.
const scaledPlans = new WeakMap<TrainingPlan, Map<number, TrainingPlan>>();

/**
 * The plan as this user should train it. Returns the catalog object
 * unchanged at factor 1, so an untested or skipped opening test keeps
 * referential identity with the catalog all the way down.
 */
export function scaleTrainingPlan(
  plan: TrainingPlan,
  factor: number
): TrainingPlan {
  if (factor === 1) return plan;
  const cached = scaledPlans.get(plan);
  const hit = cached?.get(factor);
  if (hit) return hit;
  const scaled: TrainingPlan = {
    ...plan,
    days: plan.days.map((day) => scaleTrainingPlanDay(day, factor)),
  };
  const bucket = cached ?? new Map<number, TrainingPlan>();
  bucket.set(factor, scaled);
  scaledPlans.set(plan, bucket);
  return scaled;
}

/** The plan as this user should train it, given their recorded tests. */
export function scaledPlanFor(
  plan: TrainingPlan | null,
  userPlan: Pick<UserTrainingPlan, 'testResults'> | null
): TrainingPlan | null {
  if (!plan) return null;
  return scaleTrainingPlan(plan, planScaleFactor(plan, userPlan));
}
