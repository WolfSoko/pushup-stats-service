import type { TrainingPlanDay } from '@pu-stats/models';

import { planDayGoalEntries } from './plan-goal-entries';

describe('planDayGoalEntries', () => {
  const day = (overrides: Partial<TrainingPlanDay>): TrainingPlanDay => ({
    dayIndex: 1,
    kind: 'main',
    targetReps: 60,
    description: 'Tag 1',
    ...overrides,
  });

  it('should return no entries without a day', () => {
    // given / when
    const entries = planDayGoalEntries(null);

    // then
    expect(entries).toEqual([]);
  });

  it('should return no entries for a rest day', () => {
    // given
    const restDay = day({ kind: 'rest', targetReps: 0 });

    // when
    const entries = planDayGoalEntries(restDay);

    // then
    expect(entries).toEqual([]);
  });

  it('should derive a single pushup goal for a day without an exercise list', () => {
    // given / when
    const entries = planDayGoalEntries(day({}));

    // then
    expect(entries).toEqual([
      {
        id: 'plan-today:pushup',
        exerciseId: 'pushup',
        target: 60,
        measurement: 'reps',
        unit: 'reps',
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
    const entries = planDayGoalEntries(circuit);

    // then
    expect(entries).toEqual([
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
    const entries = planDayGoalEntries(planks);

    // then
    expect(entries).toHaveLength(1);
    expect(entries[0].target).toBe(330);
  });

  it('should drop a pinned variant so plan fulfillment and goal progress agree', () => {
    // given
    const withVariant = day({
      exercises: [{ exerciseId: 'pushup', variantId: 'decline', target: 30 }],
    });

    // when
    const entries = planDayGoalEntries(withVariant);

    // then
    expect(entries[0].variantId).toBeUndefined();
  });

  it('should skip exercises without a target or catalog definition', () => {
    // given
    const mixed = day({
      exercises: [
        { exerciseId: 'legs.squats', target: 0 },
        { exerciseId: 'not.in.catalog', target: 20 },
        { exerciseId: 'pushup', target: 25 },
      ],
    });

    // when
    const entries = planDayGoalEntries(mixed);

    // then
    expect(entries.map((e) => e.exerciseId)).toEqual(['pushup']);
  });
});
