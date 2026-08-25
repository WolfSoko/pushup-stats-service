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
      steps.map((s) => [s.itemIndex, s.roundIndex, s.roundTarget, s.target])
    ).toEqual([
      [0, 0, 10, 10],
      [1, 0, 30, 30],
      [0, 1, 10, 20],
      [1, 1, 30, 60],
      [0, 2, 10, 30],
      [1, 2, 30, 90],
    ]);
  });

  it('should narrow the step prescription to the rounds walked so far', () => {
    // given
    const items = [progress({ itemIndex: 0, exercise: PUSHUPS })];

    // when
    const steps = buildCircuitSteps(items);

    // then
    expect(steps[1].exercise).toEqual({
      exerciseId: 'pushup',
      target: 20,
      sets: [10, 10],
    });
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
