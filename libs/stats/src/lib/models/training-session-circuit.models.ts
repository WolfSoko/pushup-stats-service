import { TrainingPlanExercise } from './training-plan.models';
import { PlanExerciseProgress } from './training-plan-exercise.models';
import { SessionStep, sessionToolFor } from './training-session.models';

/**
 * Circuit ordering ("Zirkeltraining") of a plan day: one set of every
 * exercise, then round two, and so on — instead of finishing an exercise
 * before the next one starts.
 *
 * A circuit is a re-ordering only. The prescription, the entries it
 * produces and the day's fulfillment are the same as in sequential mode;
 * every round of an exercise carries the cumulative target it closes at,
 * so `logged` — a per-day pool the plan store already computes — decides
 * which rounds are done without the session tracking anything itself.
 */

/**
 * How many rounds the circuit walks: the longest set breakdown of the
 * day, at least one. A day whose exercises prescribe no sets has nothing
 * to circle and collapses to a single round.
 */
export function circuitRoundCount(
  progress: ReadonlyArray<PlanExerciseProgress>
): number {
  return progress.reduce(
    (max, item) => Math.max(max, item.exercise.sets?.length ?? 0),
    1
  );
}

/**
 * Split a target into `parts` portions that still sum to it, the larger
 * ones first. Portions that would come out empty are dropped — a round
 * asking for nothing is not a step.
 */
function splitEvenly(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  let remainder = total - base * parts;
  const portions: number[] = [];
  for (let i = 0; i < parts; i++) {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    if (base + extra > 0) portions.push(base + extra);
  }
  return portions;
}

/**
 * What one plan item contributes to each round, summing to its target.
 *
 * A prescribed set breakdown is used as-is, which is what makes the
 * circuit honest: 3×10 stays 3×10, just spread across the rounds. An
 * exercise the plan quantifies only as a total is split evenly instead —
 * doing all of it in round one would defeat the circuit — and an
 * unquantified item (a HIIT block) appears once and is ticked off.
 */
export function circuitPortions(
  exercise: TrainingPlanExercise,
  rounds: number
): ReadonlyArray<number> {
  if (exercise.target <= 0) return [0];
  const sets = exercise.sets ?? [];
  if (sets.length > 0) return sets;
  return splitEvenly(exercise.target, Math.max(1, rounds));
}

/**
 * Everything logged for one exercise on the day, recovered from the
 * per-item shares `planDayProgress` handed out.
 *
 * A day may name the same exercise twice (Plank and Side Plank both
 * resolve to `plank.standard`) and `planDayProgress` draws one pool down
 * in *item* order. A circuit visits those items in *round* order, so
 * reading a step's coverage off its own item would show the second item
 * at zero until the first is fully covered — the round the user just
 * finished would be offered again. Re-pooling and re-spending in circuit
 * order fixes that; hand-ticked items are credited in full and draw
 * nothing, exactly as in `planDayProgress`.
 */
function loggedPool(
  progress: ReadonlyArray<PlanExerciseProgress>
): Map<string, number> {
  const pool = new Map<string, number>();
  for (const item of progress) {
    if (item.checkedOff) continue;
    const id = item.exercise.exerciseId;
    pool.set(id, (pool.get(id) ?? 0) + item.logged);
  }
  return pool;
}

/**
 * The prescription a circuit step captures against.
 *
 * `sets` is dropped: a step asks for one round, and with a duplicated
 * exercise the rounds behind it belong to a different plan item (and
 * variant). A bare target keeps the entry payload consistent — the full
 * amount as one set, or the remainder as one set.
 */
function withoutSets(
  exercise: TrainingPlanExercise,
  target: number
): TrainingPlanExercise {
  const { sets: _sets, ...rest } = exercise;
  return { ...rest, target };
}

/** Where one step stands: what it asks for, and what is already covered. */
interface StepCoverage {
  target: number;
  logged: number;
  done: boolean;
}

/**
 * Spend one round's portion out of its exercise's pool.
 *
 * `target` is the running total the step closes at, but never more than
 * one round beyond what is already logged: skipping a round must not
 * leave the next one demanding both. That cap can only apply while the
 * step is open, so it never changes whether a step counts as done.
 */
function stepCoverage(args: {
  item: PlanExerciseProgress;
  quantified: boolean;
  roundTarget: number;
  pool: Map<string, number>;
  spent: Map<string, number>;
}): StepCoverage {
  const { item, quantified, roundTarget, pool, spent } = args;
  if (!quantified) return { target: 0, logged: 0, done: item.done };
  // A hand-ticked item is credited in full and stays out of the pool, so
  // its rounds close without swallowing what a duplicate item needs.
  if (item.checkedOff) {
    return { target: roundTarget, logged: roundTarget, done: true };
  }
  const id = item.exercise.exerciseId;
  const through = (spent.get(id) ?? 0) + roundTarget;
  spent.set(id, through);
  const logged = Math.min(pool.get(id) ?? 0, through);
  return {
    target: Math.min(through, logged + roundTarget),
    logged,
    done: logged >= through,
  };
}

/**
 * The day's exercises as circuit steps: round by round, and inside a
 * round in prescription order. An exercise with fewer portions than the
 * circuit has rounds simply stops appearing once it is prescribed out.
 */
export function buildCircuitSteps(
  progress: ReadonlyArray<PlanExerciseProgress>
): ReadonlyArray<SessionStep> {
  const rounds = circuitRoundCount(progress);
  const plan = progress.map((item) => ({
    item,
    portions: circuitPortions(item.exercise, rounds),
  }));
  const pool = loggedPool(progress);
  /** What the steps visited so far have asked of each exercise. */
  const spent = new Map<string, number>();
  const steps: SessionStep[] = [];
  for (let round = 0; round < rounds; round++) {
    for (const { item, portions } of plan) {
      if (round >= portions.length) continue;
      const quantified = item.exercise.target > 0;
      const roundTarget = portions[round];
      const shared = stepCoverage({
        item,
        quantified,
        roundTarget,
        pool,
        spent,
      });
      steps.push({
        itemIndex: item.itemIndex,
        exercise: quantified
          ? withoutSets(item.exercise, shared.target)
          : item.exercise,
        tool: sessionToolFor(item.exercise),
        target: shared.target,
        logged: shared.logged,
        quantified,
        done: shared.done,
        roundIndex: round,
        roundTotal: rounds,
        roundTarget,
        finalRound: round === portions.length - 1,
      });
    }
  }
  return steps;
}
