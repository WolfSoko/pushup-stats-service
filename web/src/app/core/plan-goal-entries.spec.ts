import type { TrainingPlanDay } from '@pu-stats/models';

import { planDayGoals } from './plan-goal-entries';

describe('planDayGoals', () => {
  const day = (overrides: Partial<TrainingPlanDay>): TrainingPlanDay => ({
    dayIndex: 1,
    kind: 'main',
    targetReps: 60,
    description: 'Tag 1',
    ...overrides,
  });

  it('should return no goals without a day', () => {
    // given / when
    const goals = planDayGoals(null);

    // then
    expect(goals).toEqual([]);
  });

  it('should return no goals for a rest day', () => {
    // given
    const restDay = day({ kind: 'rest', targetReps: 0 });

    // when
    const goals = planDayGoals(restDay);

    // then
    expect(goals).toEqual([]);
  });

  it('should derive a single pushup goal for a day without an exercise list', () => {
    // given / when
    const goals = planDayGoals(day({}));

    // then
    expect(goals).toEqual([
      {
        entry: {
          id: 'plan-today:pushup',
          exerciseId: 'pushup',
          target: 60,
          measurement: 'reps',
          unit: 'reps',
        },
        itemIndexes: [0],
      },
    ]);
  });

  it('should list every exercise of a multi-exercise day with its own measurement and unit', () => {
    // given
    const circuit = day({
      targetReps: 40,
      exercises: [
        { exerciseId: 'pushup', target: 40 },
        { exerciseId: 'legs.squats', target: 50 },
        { exerciseId: 'plank.standard', target: 120 },
      ],
    });

    // when
    const goals = planDayGoals(circuit);

    // then
    expect(goals.map((g) => g.entry)).toEqual([
      {
        id: 'plan-today:pushup',
        exerciseId: 'pushup',
        target: 40,
        measurement: 'reps',
        unit: 'reps',
      },
      {
        id: 'plan-today:legs.squats',
        exerciseId: 'legs.squats',
        target: 50,
        measurement: 'reps',
        unit: 'reps',
      },
      {
        id: 'plan-today:plank.standard',
        exerciseId: 'plank.standard',
        target: 120,
        measurement: 'time',
        unit: 's',
      },
    ]);
    expect(goals.map((g) => g.itemIndexes)).toEqual([[0], [1], [2]]);
  });

  it('should collapse repeated exercises into one goal with the summed target', () => {
    // given
    const planks = day({
      targetReps: 0,
      exercises: [
        { exerciseId: 'plank.standard', target: 150 },
        { exerciseId: 'plank.standard', variantId: 'side', target: 180 },
      ],
    });

    // when
    const goals = planDayGoals(planks);

    // then
    expect(goals).toHaveLength(1);
    expect(goals[0].entry.target).toBe(330);
    expect(goals[0].itemIndexes).toEqual([0, 1]);
  });

  it('should drop a pinned variant so plan fulfillment and goal progress agree', () => {
    // given
    const withVariant = day({
      exercises: [{ exerciseId: 'pushup', variantId: 'decline', target: 30 }],
    });

    // when
    const goals = planDayGoals(withVariant);

    // then
    expect(goals[0].entry.variantId).toBeUndefined();
  });

  it('should skip unquantified exercises and those missing from the catalog', () => {
    // given
    const mixed = day({
      exercises: [
        { exerciseId: 'legs.squats', target: 0 },
        { exerciseId: 'not.in.catalog', target: 20 },
        { exerciseId: 'pushup', target: 25 },
      ],
    });

    // when
    const goals = planDayGoals(mixed);

    // then
    expect(goals.map((g) => g.entry.exerciseId)).toEqual(['pushup']);
    // Item indexes stay anchored to the day's list, skips included.
    expect(goals[0].itemIndexes).toEqual([2]);
  });
});
