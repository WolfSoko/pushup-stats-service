import {
  TrainingPlan,
  TrainingPlanDay,
  TrainingPlanExercise,
  UserTrainingPlan,
  trainingPlanDayExerciseId,
} from './training-plan.models';
import {
  planBaselineTestDay,
  planTestFields,
  planTestResults,
} from './training-plan-test.models';

/**
 * Rescaling a curated plan to the strength the user actually brought.
 *
 * A plan that opens with a max test is written for one particular set of
 * baselines (`TrainingPlan.baselineMax`). Someone testing at half of them
 * is handed a plan they cannot finish; someone at double is handed one
 * that never challenges them.
 *
 * A test can measure several things — Core Foundations opens with a plank
 * hold, pushups and a hollow hold — and each measured exercise scales its
 * own prescriptions across the plan. Exercises the test never measured
 * keep the numbers the plan prescribes: a max of ten push-ups says nothing
 * about how long someone holds a hollow hold, and moving it anyway made
 * the day contradict its own description ("3×20 s" next to items of 10 s)
 * and shrank even the mobility blocks.
 *
 * Skipping the test leaves every factor at 1, and that case returns the
 * catalog object itself — the untouched path is not merely numerically
 * unchanged, it is the very same object the catalog exports.
 */

/**
 * Bounds on any single factor. A plan is a progression, not a pure
 * multiple of one number: past roughly ±2× the structure it was written
 * around (set counts, rest intervals, weekly ramp) stops making sense,
 * and an unbounded factor would turn one fat-fingered result into weeks
 * of unusable targets.
 */
export const MIN_PLAN_SCALE = 0.5;
export const MAX_PLAN_SCALE = 2;

/** The exercise `targetReps` and the dashboard goal are about. */
const PRIMARY_EXERCISE = 'pushup';

/** Factor resolution — 1 % steps are finer than any rounded target can
 *  resolve, and keep the memo cache keyed on stable numbers. */
const FACTOR_PRECISION = 100;

/**
 * How far the user's opening test moved each exercise from the baseline
 * the plan was written for.
 */
export interface PlanScaleFactors {
  /** The push-up factor — what `targetReps` is measured in. */
  readonly primary: number;
  readonly byExercise: ReadonlyMap<string, number>;
}

/** Nothing measured: the plan stands exactly as published. */
export const NO_PLAN_SCALING: PlanScaleFactors = {
  primary: 1,
  byExercise: new Map(),
};

function clampFactor(measured: number, reference: number): number {
  const clamped = Math.min(
    MAX_PLAN_SCALE,
    Math.max(MIN_PLAN_SCALE, measured / reference)
  );
  return Math.round(clamped * FACTOR_PRECISION) / FACTOR_PRECISION;
}

/** True when no factor would change anything. */
export function isNeutralScaling(factors: PlanScaleFactors): boolean {
  return (
    factors.primary === 1 &&
    Array.from(factors.byExercise.values()).every((f) => f === 1)
  );
}

/**
 * The factors the user's opening test puts in force. Neutral whenever the
 * plan has no opening test, names no baselines, or the user recorded
 * nothing — which is also what skipping the test leaves behind.
 */
export function planScaleFactors(
  plan: Pick<TrainingPlan, 'days' | 'baselineMax'> | null,
  userPlan: Pick<UserTrainingPlan, 'testResults'> | null
): PlanScaleFactors {
  const baselines = plan?.baselineMax;
  if (!plan || !baselines) return NO_PLAN_SCALING;
  const testDay = planBaselineTestDay(plan);
  if (!testDay) return NO_PLAN_SCALING;
  const results = planTestResults(userPlan, testDay.dayIndex);
  if (results.size === 0) return NO_PLAN_SCALING;

  const byExercise = new Map<string, number>();
  for (const field of planTestFields(testDay)) {
    const measured = results.get(field.itemIndex) ?? 0;
    const reference = baselines[field.exerciseId] ?? 0;
    if (measured <= 0 || reference <= 0) continue;
    byExercise.set(field.exerciseId, clampFactor(measured, reference));
  }
  if (byExercise.size === 0) return NO_PLAN_SCALING;
  return { primary: byExercise.get(PRIMARY_EXERCISE) ?? 1, byExercise };
}

/** Scales one target, keeping "unquantified" (`<= 0`) targets unquantified. */
function scaleValue(value: number, factor: number): number {
  if (value <= 0 || factor === 1) return value;
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
  // a total below `sets.length`, where every set is already at its floor
  // of 1 and no further reduction is possible.
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
 * What the test says about this exercise. Nothing measured it means
 * nothing to say: the prescription stands.
 */
function factorFor(factors: PlanScaleFactors, exerciseId: string): number {
  const measured = factors.byExercise.get(exerciseId);
  if (measured !== undefined) return measured;
  return exerciseId === PRIMARY_EXERCISE ? factors.primary : 1;
}

/**
 * Scales a day's exercise list. Items belonging to the day's headline
 * exercise are scaled as one breakdown so their sum still mirrors
 * `targetReps` — the dashboard goal pill reads that field, and a
 * structured day whose pushup items drifted away from it would show the
 * user two different numbers for the same work.
 */
function scaleExercises(
  exercises: ReadonlyArray<TrainingPlanExercise>,
  factors: PlanScaleFactors,
  headlineId: string,
  scaledTargetReps: number
): TrainingPlanExercise[] {
  // Unquantified items (`target === 0`, only legal on checkoff days) stay
  // out of the breakdown: giving them a share would both invent a target
  // the plan deliberately left open and starve the quantified ones.
  const headlineIndexes = exercises
    .map((e, i) => (e.exerciseId === headlineId && e.target > 0 ? i : -1))
    .filter((i) => i >= 0);
  const scaledHeadline = scaleBreakdown(
    headlineIndexes.map((i) => exercises[i].target),
    scaledTargetReps
  );
  const byIndex = new Map(
    headlineIndexes.map((planIndex, n) => [planIndex, scaledHeadline[n]])
  );

  return exercises.map((exercise, index) => {
    const target =
      byIndex.get(index) ??
      scaleValue(exercise.target, factorFor(factors, exercise.exerciseId));
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
  factors: PlanScaleFactors
): TrainingPlanDay {
  if (day.kind === 'rest' || day.kind === 'test') return day;
  if (isNeutralScaling(factors)) return day;
  const headlineId = trainingPlanDayExerciseId(day);
  const targetReps = scaleValue(day.targetReps, factorFor(factors, headlineId));
  return {
    ...day,
    targetReps,
    ...(day.sets ? { sets: scaleBreakdown(day.sets, targetReps) } : {}),
    ...(day.exercises
      ? {
          exercises: scaleExercises(
            day.exercises,
            factors,
            headlineId,
            targetReps
          ),
        }
      : {}),
  };
}

/** Cache key for one factor set — stable across map insertion order. */
function factorKey(factors: PlanScaleFactors): string {
  return Array.from(factors.byExercise.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, f]) => `${id}=${f}`)
    .join('|');
}

// Scaled plans are memoised per catalog entry and factor set.
// `activeCatalog` is a computed signal feeding `planDayExercises`' own
// per-day WeakMap cache and a tree of downstream computeds; handing them a
// freshly built plan on every recomputation would invalidate all of it for
// numbers that did not change.
const scaledPlans = new WeakMap<TrainingPlan, Map<string, TrainingPlan>>();

/**
 * The plan as this user should train it. Returns the catalog object
 * unchanged under neutral scaling, so an untested or skipped opening test
 * keeps referential identity with the catalog all the way down.
 */
export function scaleTrainingPlan(
  plan: TrainingPlan,
  factors: PlanScaleFactors
): TrainingPlan {
  if (isNeutralScaling(factors)) return plan;
  const key = factorKey(factors);
  const cached = scaledPlans.get(plan);
  const hit = cached?.get(key);
  if (hit) return hit;
  const scaled: TrainingPlan = {
    ...plan,
    days: plan.days.map((day) => scaleTrainingPlanDay(day, factors)),
  };
  const bucket = cached ?? new Map<string, TrainingPlan>();
  bucket.set(key, scaled);
  scaledPlans.set(plan, bucket);
  return scaled;
}

/** The plan as this user should train it, given their recorded tests. */
export function scaledPlanFor(
  plan: TrainingPlan | null,
  userPlan: Pick<UserTrainingPlan, 'testResults'> | null
): TrainingPlan | null {
  if (!plan) return null;
  return scaleTrainingPlan(plan, planScaleFactors(plan, userPlan));
}
