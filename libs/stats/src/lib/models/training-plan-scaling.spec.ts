import {
  MAX_PLAN_SCALE,
  MIN_PLAN_SCALE,
  planScaleFactor,
  scaleBreakdown,
  scaleTrainingPlan,
  scaleTrainingPlanDay,
  scaledPlanFor,
} from './training-plan-scaling';
import {
  planTestResultId,
  planBaselineTestDay,
} from './training-plan-test.models';
import {
  TrainingPlan,
  TrainingPlanDay,
  UserTrainingPlan,
} from './training-plan.models';
import { planDayExercises } from './training-plan-exercise.models';
import { TRAINING_PLANS } from './training-plan.catalog';

function day(
  dayIndex: number,
  kind: TrainingPlanDay['kind'],
  targetReps: number,
  extra: Partial<TrainingPlanDay> = {}
): TrainingPlanDay {
  return { dayIndex, kind, targetReps, description: '', ...extra };
}

function plan(days: TrainingPlanDay[], baselineMaxReps?: number): TrainingPlan {
  return {
    id: 'p',
    slug: 'p',
    title: '',
    summary: '',
    level: 'beginner',
    totalDays: days.length,
    ...(baselineMaxReps === undefined ? {} : { baselineMaxReps }),
    days,
  };
}

function userPlan(testResults?: string[]): UserTrainingPlan {
  return {
    userId: 'u',
    planId: 'p',
    startDate: '2026-01-01',
    status: 'active',
    completedDays: [],
    ...(testResults ? { testResults } : {}),
  };
}

/** A plan that opens and closes with a max test, as the real ones do. */
const TESTED_PLAN = plan(
  [
    day(1, 'test', 0),
    day(2, 'main', 60, { sets: [20, 20, 20] }),
    day(3, 'rest', 0),
    day(4, 'light', 30, { sets: [15, 15] }),
    day(5, 'test', 100),
  ],
  20
);

describe('planScaleFactor', () => {
  it('should be 1 when the opening test has no recorded result', () => {
    // given a plan with a baseline but an untaken test
    // when the factor is resolved
    // then nothing scales
    expect(planScaleFactor(TESTED_PLAN, userPlan())).toBe(1);
  });

  it('should be 1 when the user skipped the opening test', () => {
    // given a user who skipped day 1 rather than recording a result
    const skipped: UserTrainingPlan = { ...userPlan(), skippedDays: [1] };

    // when the factor is resolved
    // then the catalog numbers stand
    expect(planScaleFactor(TESTED_PLAN, skipped)).toBe(1);
  });

  it('should be 1 for a plan that names no baseline', () => {
    // given the same days without `baselineMaxReps`
    const noBaseline = plan(TESTED_PLAN.days as TrainingPlanDay[]);

    // when a result exists anyway
    const result = planScaleFactor(
      noBaseline,
      userPlan([planTestResultId(1, 40)])
    );

    // then there is nothing to compare it against
    expect(result).toBe(1);
  });

  it('should be 1 when the plan only closes with a test', () => {
    // given a plan whose single test is its last day
    const closingOnly = plan([day(1, 'main', 30), day(2, 'test', 50)], 20);

    // when a result is recorded for it
    const result = planScaleFactor(
      closingOnly,
      userPlan([planTestResultId(2, 40)])
    );

    // then nothing follows it to rescale
    expect(planBaselineTestDay(closingOnly)).toBeNull();
    expect(result).toBe(1);
  });

  it('should divide the measured result by the plan baseline', () => {
    // given a baseline of 20 and a measured 30
    // when the factor is resolved
    // then the plan runs at 1.5×
    expect(
      planScaleFactor(TESTED_PLAN, userPlan([planTestResultId(1, 30)]))
    ).toBe(1.5);
  });

  it('should clamp a result far below the baseline', () => {
    // given a user who managed 2 reps against a baseline of 20
    const result = planScaleFactor(
      TESTED_PLAN,
      userPlan([planTestResultId(1, 2)])
    );

    // then the factor stops at the floor rather than collapsing the plan
    expect(result).toBe(MIN_PLAN_SCALE);
  });

  it('should clamp a result far above the baseline', () => {
    // given a fat-fingered 500 against a baseline of 20
    const result = planScaleFactor(
      TESTED_PLAN,
      userPlan([planTestResultId(1, 500)])
    );

    // then weeks of unusable targets are avoided
    expect(result).toBe(MAX_PLAN_SCALE);
  });

  it('should read the last entry when a doc carries duplicates for one day', () => {
    // given a hand-edited doc with two results for day 1
    const messy = userPlan([planTestResultId(1, 10), planTestResultId(1, 30)]);

    // when the factor is resolved
    // then it does not depend on array order luck
    expect(planScaleFactor(TESTED_PLAN, messy)).toBe(1.5);
  });
});

describe('scaleBreakdown', () => {
  it('should keep the sets summing to the new total', () => {
    // given a 3-set breakdown rescaled to 90
    const out = scaleBreakdown([20, 20, 20], 90);

    // then the parts still add up to the whole
    expect(out.reduce((a, b) => a + b, 0)).toBe(90);
  });

  it('should preserve the descending shape of a breakdown', () => {
    // given a descending breakdown
    const out = scaleBreakdown([15, 12, 10], 74);

    // then it stays descending and sums correctly
    expect(out.reduce((a, b) => a + b, 0)).toBe(74);
    expect(out[0]).toBeGreaterThanOrEqual(out[1]);
    expect(out[1]).toBeGreaterThanOrEqual(out[2]);
  });

  it('should never drop a set below one rep', () => {
    // given a total smaller than the number of sets
    const out = scaleBreakdown([10, 10, 10], 2);

    // then every set survives as a real set
    expect(out.every((s) => s >= 1)).toBe(true);
  });

  it('should terminate on a total of zero', () => {
    // given nothing to distribute
    // then the input is handed back untouched
    expect(scaleBreakdown([10, 10], 0)).toEqual([10, 10]);
  });
});

describe('scaleTrainingPlanDay', () => {
  it('should leave rest days alone', () => {
    // given a rest day
    const rest = day(3, 'rest', 0);

    // then it is returned as-is
    expect(scaleTrainingPlanDay(rest, 1.5)).toBe(rest);
  });

  it('should leave test days alone', () => {
    // given a max test — an all-out effort, not a movable target
    const test = day(5, 'test', 100);

    // then its recommendation does not move with the factor
    expect(scaleTrainingPlanDay(test, 1.5)).toBe(test);
  });

  it('should scale targetReps and its set breakdown together', () => {
    // given a main day of 3×20
    const main = day(2, 'main', 60, { sets: [20, 20, 20] });

    // when the plan runs at 1.5×
    const scaled = scaleTrainingPlanDay(main, 1.5);

    // then both the total and the breakdown move, and still agree
    expect(scaled.targetReps).toBe(90);
    expect(scaled.sets).toEqual([30, 30, 30]);
    expect(scaled.sets?.reduce((a, b) => a + b, 0)).toBe(scaled.targetReps);
  });

  it('should scale time-measured exercises alongside the reps', () => {
    // given a circuit day pairing pushups with holds
    const circuit = day(2, 'main', 30, {
      exercises: [
        { exerciseId: 'pushup', target: 30, sets: [10, 10, 10] },
        { exerciseId: 'plank.standard', target: 90, sets: [30, 30, 30] },
      ],
    });

    // when the plan runs at 1.5×
    const scaled = scaleTrainingPlanDay(circuit, 1.5);

    // then the holds move with everything else
    expect(scaled.exercises?.[0].target).toBe(45);
    expect(scaled.exercises?.[1].target).toBe(135);
  });

  it('should keep the pushup items mirroring targetReps', () => {
    // given a day that names the headline exercise twice
    const split = day(2, 'main', 40, {
      exercises: [
        { exerciseId: 'pushup', target: 25 },
        { exerciseId: 'pushup', target: 15 },
        { exerciseId: 'legs.squats', target: 50 },
      ],
    });

    // when it is scaled by an awkward factor
    const scaled = scaleTrainingPlanDay(split, 1.35);

    // then the dashboard pill and the exercise list still agree
    const pushupTotal = (scaled.exercises ?? [])
      .filter((e) => e.exerciseId === 'pushup')
      .reduce((sum, e) => sum + e.target, 0);
    expect(pushupTotal).toBe(scaled.targetReps);
  });

  it('should leave unquantified exercises unquantified', () => {
    // given a checkoff day whose round count the plan deliberately omits
    const hiit = day(2, 'main', 0, {
      completion: 'checkoff',
      exercises: [{ exerciseId: 'cardio.burpees', target: 0 }],
    });

    // when it is scaled
    const scaled = scaleTrainingPlanDay(hiit, 2);

    // then a target is not invented for it
    expect(scaled.exercises?.[0].target).toBe(0);
  });

  it('should keep item sets summing to their own item target', () => {
    // given an item with a breakdown
    const d = day(2, 'main', 30, {
      exercises: [{ exerciseId: 'pushup', target: 30, sets: [12, 10, 8] }],
    });

    // when scaled by a factor that rounds awkwardly
    const scaled = scaleTrainingPlanDay(d, 1.17);

    // then the invariant the catalog guard enforces still holds
    const item = scaled.exercises?.[0];
    expect(item?.sets?.reduce((a, b) => a + b, 0)).toBe(item?.target);
  });
});

describe('scaleTrainingPlan', () => {
  it('should return the catalog object itself at factor 1', () => {
    // given an untested plan
    // when it is "scaled" by 1
    // then the untouched path is identity, not a rebuilt copy
    expect(scaleTrainingPlan(TESTED_PLAN, 1)).toBe(TESTED_PLAN);
  });

  it('should hand back the same object for a repeated factor', () => {
    // given one scaled plan
    const first = scaleTrainingPlan(TESTED_PLAN, 1.5);

    // when it is requested again
    const second = scaleTrainingPlan(TESTED_PLAN, 1.5);

    // then downstream computed signals are not invalidated for nothing
    expect(second).toBe(first);
  });

  it('should keep derived exercise items in step with the scaled day', () => {
    // given a plan scaled up
    const scaled = scaleTrainingPlan(TESTED_PLAN, 1.5);

    // when the day's exercise list is derived
    const items = planDayExercises(scaled.days[1]);

    // then the item the UI renders carries the scaled target
    expect(items[0].target).toBe(90);
  });
});

describe('scaledPlanFor', () => {
  it('should leave the plan untouched for a user who skipped the test', () => {
    // given no recorded result
    // when the plan is resolved for that user
    // then they train the catalog plan, object identity included
    expect(scaledPlanFor(TESTED_PLAN, userPlan())).toBe(TESTED_PLAN);
  });

  it('should apply the measured baseline end to end', () => {
    // given a user who tested at 10 against a baseline of 20
    const scaled = scaledPlanFor(
      TESTED_PLAN,
      userPlan([planTestResultId(1, 10)])
    );

    // then the plan halves, and its closing test still asks for everything
    expect(scaled?.days[1].targetReps).toBe(30);
    expect(scaled?.days[3].targetReps).toBe(15);
    expect(scaled?.days[4].targetReps).toBe(100);
  });

  it('should return null without a plan', () => {
    expect(scaledPlanFor(null, userPlan())).toBeNull();
  });
});

describe('scaling the shipped catalog', () => {
  const scalable = TRAINING_PLANS.filter((p) => p.baselineMaxReps);

  it('should only name a baseline on plans that open with a test', () => {
    // given every plan carrying `baselineMaxReps`
    for (const p of scalable) {
      // then each has an opening test whose result can drive it
      expect(planBaselineTestDay(p)).not.toBeNull();
    }
    expect(scalable.length).toBeGreaterThan(0);
  });

  it('should hold the catalog invariants after scaling', () => {
    // given every scalable plan pushed to both clamp bounds
    for (const p of scalable) {
      for (const factor of [MIN_PLAN_SCALE, 1.37, MAX_PLAN_SCALE]) {
        for (const d of scaleTrainingPlan(p, factor).days) {
          // then rest days stay empty and sets keep summing to their total
          if (d.kind === 'rest') expect(d.targetReps).toBe(0);
          if (d.sets && d.kind !== 'test') {
            expect(d.sets.reduce((a, b) => a + b, 0)).toBe(d.targetReps);
          }
          for (const item of d.exercises ?? []) {
            if (item.sets) {
              expect(item.sets.reduce((a, b) => a + b, 0)).toBe(item.target);
            }
          }
          const pushupTotal = (d.exercises ?? [])
            .filter((e) => e.exerciseId === 'pushup')
            .reduce((sum, e) => sum + e.target, 0);
          if (d.exercises) expect(pushupTotal).toBe(d.targetReps);
        }
      }
    }
  });
});
