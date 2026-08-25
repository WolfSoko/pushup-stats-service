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

/** Running sums of `portions`, so index `i` is the total through round `i`. */
function cumulative(portions: ReadonlyArray<number>): number[] {
  let sum = 0;
  return portions.map((value) => (sum += value));
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
  const plan = progress.map((item) => {
    const portions = circuitPortions(item.exercise, rounds);
    return { item, portions, totals: cumulative(portions) };
  });
  const steps: SessionStep[] = [];
  for (let round = 0; round < rounds; round++) {
    for (const { item, portions, totals } of plan) {
      if (round >= portions.length) continue;
      const quantified = item.exercise.target > 0;
      const target = totals[round];
      steps.push({
        itemIndex: item.itemIndex,
        exercise: quantified
          ? {
              ...item.exercise,
              target,
              sets: portions.slice(0, round + 1),
            }
          : item.exercise,
        tool: sessionToolFor(item.exercise),
        target,
        logged: item.logged,
        quantified,
        done: item.done || (quantified && item.logged >= target),
        roundIndex: round,
        roundTotal: rounds,
        roundTarget: portions[round],
        finalRound: round === portions.length - 1,
      });
    }
  }
  return steps;
}
