import {
  buildCircuitSteps,
  circuitPortions,
  circuitRoundCount,
} from './training-session-circuit.models';
import { PlanExerciseProgress } from './training-plan-exercise.models';
import { TrainingPlanExercise } from './training-plan.models';

function progress(
  overrides: Partial<PlanExerciseProgress> & {
    exercise: TrainingPlanExercise;
    itemIndex: number;
  }
): PlanExerciseProgress {
  return {
    logged: 0,
    fulfilledByEntries: false,
    checkedOff: false,
    done: false,
    ...overrides,
  };
}

const PUSHUPS = { exerciseId: 'pushup', target: 30, sets: [10, 10, 10] };
const PLANK = { exerciseId: 'plank.standard', target: 90, sets: [30, 30, 30] };

describe('circuitRoundCount', () => {
  it('should use the longest set breakdown of the day', () => {
    // given
    const items = [
      progress({ itemIndex: 0, exercise: PUSHUPS }),
      progress({
        itemIndex: 1,
        exercise: { exerciseId: 'legs.squats', target: 32, sets: [8, 8, 8, 8] },
      }),
    ];

    // when / then
    expect(circuitRoundCount(items)).toBe(4);
  });

  it('should fall back to a single round when no exercise prescribes sets', () => {
    // given
    const items = [
      progress({
        itemIndex: 0,
        exercise: { exerciseId: 'pushup', target: 30 },
      }),
    ];

    // when / then
    expect(circuitRoundCount(items)).toBe(1);
  });

  it('should return one round for a day with no exercises', () => {
    // given / when / then
    expect(circuitRoundCount([])).toBe(1);
  });
});

describe('circuitPortions', () => {
  it('should use the prescribed sets as the rounds', () => {
    // given / when
    const portions = circuitPortions(PUSHUPS, 3);

    // then
    expect(portions).toEqual([10, 10, 10]);
  });

  it('should split a target without a set breakdown evenly across the rounds', () => {
    // given / when
    const portions = circuitPortions({ exerciseId: 'pushup', target: 30 }, 3);

    // then
    expect(portions).toEqual([10, 10, 10]);
  });

  it('should give the remainder of an uneven split to the earlier rounds', () => {
    // given / when
    const portions = circuitPortions({ exerciseId: 'pushup', target: 20 }, 3);

    // then
    expect(portions).toEqual([7, 7, 6]);
    expect(portions.reduce((a, b) => a + b, 0)).toBe(20);
  });

  it('should drop rounds that would ask for nothing', () => {
    // given / when
    const portions = circuitPortions({ exerciseId: 'pushup', target: 2 }, 3);

    // then
    expect(portions).toEqual([1, 1]);
  });

  it('should give an unquantified item a single empty round', () => {
    // given / when
    const portions = circuitPortions({ exerciseId: 'pushup', target: 0 }, 3);

    // then
    expect(portions).toEqual([0]);
  });
});

describe('buildCircuitSteps', () => {
  it('should walk one set of every exercise per round', () => {
    // given
    const items = [
      progress({ itemIndex: 0, exercise: PUSHUPS }),
      progress({ itemIndex: 1, exercise: PLANK }),
    ];

    // when
    const steps = buildCircuitSteps(items);

    // then
    expect(
      steps.map((s) => [s.itemIndex, s.roundIndex, s.roundTarget])
    ).toEqual([
      [0, 0, 10],
      [1, 0, 30],
      [0, 1, 10],
      [1, 1, 30],
      [0, 2, 10],
      [1, 2, 30],
    ]);
  });

  it('should carry the running total a round closes at', () => {
    // given — round one of each exercise is already logged
    const items = [
      progress({ itemIndex: 0, exercise: PUSHUPS, logged: 10 }),
      progress({ itemIndex: 1, exercise: PLANK, logged: 30 }),
    ];

    // when
    const steps = buildCircuitSteps(items);

    // then
    expect(steps.map((s) => s.target)).toEqual([10, 30, 20, 60, 20, 60]);
    expect(steps.map((s) => s.done)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it('should narrow the step prescription to the rounds walked so far', () => {
    // given
    const items = [progress({ itemIndex: 0, exercise: PUSHUPS, logged: 10 })];

    // when
    const steps = buildCircuitSteps(items);

    // then — no `sets`: a round is one set, and with a duplicated
    // exercise the rounds behind it belong to another item.
    expect(steps[1].exercise).toEqual({ exerciseId: 'pushup', target: 20 });
  });

  it('should not let a skipped round double what the next one asks for', () => {
    // given — nothing logged, so round one was walked past
    const items = [progress({ itemIndex: 0, exercise: PUSHUPS })];

    // when
    const steps = buildCircuitSteps(items);

    // then
    expect(steps[1].target).toBe(10);
    expect(steps[1].roundTarget).toBe(10);
    expect(steps[1].done).toBe(false);
  });
});

describe('buildCircuitSteps with the same exercise named twice', () => {
  // core-4w-v1 prescribes Plank 3×50 s and Side Plank 6×30 s; both
  // resolve to `plank.standard`, so they share one logged pool that
  // `planDayProgress` drains in item order.
  const PLANK_ITEM = {
    exerciseId: 'plank.standard',
    target: 150,
    sets: [50, 50, 50],
  };
  const SIDE_PLANK_ITEM = {
    exerciseId: 'plank.standard',
    variantId: 'side',
    target: 180,
    sets: [30, 30, 30, 30, 30, 30],
  };

  /** The pool as `planDayProgress` hands it out: item order, capped. */
  function pooled(total: number) {
    const first = Math.min(total, PLANK_ITEM.target);
    return [
      progress({ itemIndex: 0, exercise: PLANK_ITEM, logged: first }),
      progress({
        itemIndex: 1,
        exercise: SIDE_PLANK_ITEM,
        logged: Math.min(total - first, SIDE_PLANK_ITEM.target),
      }),
    ];
  }

  it('should credit the second item for a round the first one did not need', () => {
    // given — 50 s of plank done, which is exactly round one of item 0
    const steps = buildCircuitSteps(pooled(50));

    // then
    expect(steps[0].done).toBe(true);
    expect(steps[1].itemIndex).toBe(1);
    expect(steps[1].done).toBe(false);
    expect(steps[1].target).toBe(80);
    expect(steps[1].logged).toBe(50);
  });

  it('should close a round the user just finished instead of re-offering it', () => {
    // given — 50 s plank + 30 s side plank; item 1 still reads 0 logged
    const items = pooled(80);
    expect(items[1].logged).toBe(0);

    // when
    const steps = buildCircuitSteps(items);

    // then
    expect(steps.slice(0, 2).map((s) => s.done)).toEqual([true, true]);
    expect(steps[2].done).toBe(false);
  });

  it('should spend the pool in circuit order across both items', () => {
    // given / when
    const steps = buildCircuitSteps(pooled(160));

    // then — 50+30+50+30 covered, the next round is open
    expect(steps.map((s) => s.done).slice(0, 5)).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('should close every round once the whole day is logged', () => {
    // given / when
    const steps = buildCircuitSteps(pooled(330));

    // then
    expect(steps.every((s) => s.done)).toBe(true);
  });

  it('should keep a hand-ticked item out of the pool the other one draws from', () => {
    // given — item 0 ticked off by hand, nothing actually logged
    const items = [
      progress({
        itemIndex: 0,
        exercise: PLANK_ITEM,
        logged: PLANK_ITEM.target,
        checkedOff: true,
        done: true,
      }),
      progress({ itemIndex: 1, exercise: SIDE_PLANK_ITEM }),
    ];

    // when
    const steps = buildCircuitSteps(items);

    // then — the tick closes item 0's rounds and credits item 1 nothing
    const ticked = steps.filter((s) => s.itemIndex === 0);
    const open = steps.filter((s) => s.itemIndex === 1);
    expect(ticked.every((s) => s.done)).toBe(true);
    expect(open.every((s) => !s.done)).toBe(true);
    expect(open[0].logged).toBe(0);
  });

  it('should flag only the round that closes a plan item as final', () => {
    // given
    const items = [progress({ itemIndex: 0, exercise: PUSHUPS })];

    // when
    const steps = buildCircuitSteps(items);

    // then
    expect(steps.map((s) => s.finalRound)).toEqual([false, false, true]);
  });

  it('should stop offering an exercise once it is prescribed out', () => {
    // given
    const items = [
      progress({ itemIndex: 0, exercise: PUSHUPS }),
      progress({
        itemIndex: 1,
        exercise: { exerciseId: 'legs.squats', target: 16, sets: [8, 8] },
      }),
    ];

    // when
    const steps = buildCircuitSteps(items);

    // then
    expect(
      steps.filter((s) => s.roundIndex === 2).map((s) => s.itemIndex)
    ).toEqual([0]);
    expect(steps.every((s) => s.roundTotal === 3)).toBe(true);
  });

  it('should close the rounds already covered by what is logged', () => {
    // given
    const items = [progress({ itemIndex: 0, exercise: PUSHUPS, logged: 20 })];

    // when
    const steps = buildCircuitSteps(items);

    // then
    expect(steps.map((s) => s.done)).toEqual([true, true, false]);
  });

  it('should close every round of an exercise the user ticked off', () => {
    // given
    const items = [
      progress({
        itemIndex: 0,
        exercise: PUSHUPS,
        logged: 30,
        checkedOff: true,
        done: true,
      }),
    ];

    // when
    const steps = buildCircuitSteps(items);

    // then
    expect(steps.map((s) => s.done)).toEqual([true, true, true]);
  });

  it('should keep an unquantified item to a single step', () => {
    // given
    const items = [
      progress({ itemIndex: 0, exercise: PUSHUPS }),
      progress({
        itemIndex: 1,
        exercise: { exerciseId: 'cardio.burpees', target: 0 },
      }),
    ];

    // when
    const steps = buildCircuitSteps(items);

    // then
    const burpees = steps.filter((s) => s.itemIndex === 1);
    expect(burpees).toHaveLength(1);
    expect(burpees[0].quantified).toBe(false);
    expect(burpees[0].finalRound).toBe(true);
  });

  it('should return an empty list for a day with no exercises', () => {
    // given / when / then
    expect(buildCircuitSteps([])).toEqual([]);
  });
});
