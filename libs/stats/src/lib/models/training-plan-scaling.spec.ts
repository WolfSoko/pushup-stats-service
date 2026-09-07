import {
  isNeutralScaling,
  MAX_PLAN_SCALE,
  MIN_PLAN_SCALE,
  NO_PLAN_SCALING,
  planScaleFactors,
  scaleBreakdown,
  scaleTrainingPlan,
  scaleTrainingPlanDay,
  scaledPlanFor,
  type PlanScaleFactors,
} from './training-plan-scaling';
import {
  planBaselineTestDay,
  planTestResultId,
} from './training-plan-test.models';
import {
  TrainingPlan,
  TrainingPlanDay,
  UserTrainingPlan,
} from './training-plan.models';
import { planDayExercises } from './training-plan-exercise.models';
import { findPlanBySlug, TRAINING_PLANS } from './training-plan.catalog';

function day(
  dayIndex: number,
  kind: TrainingPlanDay['kind'],
  targetReps: number,
  extra: Partial<TrainingPlanDay> = {}
): TrainingPlanDay {
  return { dayIndex, kind, targetReps, description: '', ...extra };
}

function plan(
  days: TrainingPlanDay[],
  baselineMax?: Record<string, number>
): TrainingPlan {
  return {
    id: 'p',
    slug: 'p',
    title: '',
    summary: '',
    level: 'beginner',
    totalDays: days.length,
    ...(baselineMax ? { baselineMax } : {}),
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

function factors(byExercise: Record<string, number>): PlanScaleFactors {
  const map = new Map(Object.entries(byExercise));
  return { primary: map.get('pushup') ?? 1, byExercise: map };
}

/**
 * A plan whose opening test measures three things, like Core Foundations:
 * a plank hold, pushups and a hollow hold.
 */
const MULTI_PLAN = plan(
  [
    day(1, 'test', 10, {
      exercises: [
        { exerciseId: 'plank.standard', target: 30 },
        { exerciseId: 'pushup', target: 10 },
        { exerciseId: 'core.hollowhold', target: 20 },
      ],
    }),
    day(2, 'main', 20, {
      sets: [10, 10],
      exercises: [
        { exerciseId: 'pushup', target: 20, sets: [10, 10] },
        { exerciseId: 'plank.standard', target: 90, sets: [30, 30, 30] },
        { exerciseId: 'core.hollowhold', target: 60, sets: [20, 20, 20] },
        { exerciseId: 'core.deadbug', target: 20 },
      ],
    }),
    day(3, 'rest', 0),
    day(4, 'test', 30),
  ],
  { pushup: 10, 'plank.standard': 30, 'core.hollowhold': 20 }
);

/** Results: pushups ×1.5, plank ×2, hollow ×1. */
const MULTI_RESULTS = [
  planTestResultId(1, 0, 60),
  planTestResultId(1, 1, 15),
  planTestResultId(1, 2, 20),
];

describe('planScaleFactors', () => {
  it('should be neutral when the opening test has no recorded values', () => {
    expect(planScaleFactors(MULTI_PLAN, userPlan())).toBe(NO_PLAN_SCALING);
  });

  it('should be neutral when the user skipped the opening test', () => {
    // given a user who skipped day 1 rather than recording anything
    const skipped: UserTrainingPlan = { ...userPlan(), skippedDays: [1] };

    // then the catalog numbers stand
    expect(isNeutralScaling(planScaleFactors(MULTI_PLAN, skipped))).toBe(true);
  });

  it('should be neutral for a plan that names no baselines', () => {
    // given the same days without `baselineMax`
    const noBaseline = plan(MULTI_PLAN.days as TrainingPlanDay[]);

    // then there is nothing to compare the values against
    expect(
      isNeutralScaling(planScaleFactors(noBaseline, userPlan(MULTI_RESULTS)))
    ).toBe(true);
  });

  it('should be neutral when the plan only closes with a test', () => {
    // given a plan whose single test is its last day
    const closingOnly = plan([day(1, 'main', 30), day(2, 'test', 50)], {
      pushup: 20,
    });

    // then nothing follows it to rescale
    expect(planBaselineTestDay(closingOnly)).toBeNull();
    expect(
      isNeutralScaling(
        planScaleFactors(closingOnly, userPlan([planTestResultId(2, 0, 40)]))
      )
    ).toBe(true);
  });

  it('should derive one factor per measured exercise', () => {
    // given a test measuring three things against three references
    const result = planScaleFactors(MULTI_PLAN, userPlan(MULTI_RESULTS));

    // then each exercise gets its own ratio
    expect(result.byExercise.get('pushup')).toBe(1.5);
    expect(result.byExercise.get('plank.standard')).toBe(2);
    expect(result.byExercise.get('core.hollowhold')).toBe(1);
    // and the pushup factor stands in for everything unmeasured
    expect(result.primary).toBe(1.5);
  });

  it('should ignore a field the user left blank', () => {
    // given only the plank recorded
    const result = planScaleFactors(
      MULTI_PLAN,
      userPlan([planTestResultId(1, 0, 60)])
    );

    // then the untaken measurements do not invent a factor
    expect(result.byExercise.get('plank.standard')).toBe(2);
    expect(result.byExercise.has('pushup')).toBe(false);
    // and unmeasured exercises stay at the catalog numbers
    expect(result.primary).toBe(1);
  });

  it('should ignore a measured exercise the plan names no baseline for', () => {
    // given a test measuring pushups, but a plan that only references planks
    const p = plan(MULTI_PLAN.days as TrainingPlanDay[], {
      'plank.standard': 30,
    });

    // when everything is recorded
    const result = planScaleFactors(p, userPlan(MULTI_RESULTS));

    // then only the referenced exercise scales
    expect(result.byExercise.get('plank.standard')).toBe(2);
    expect(result.byExercise.has('pushup')).toBe(false);
  });

  it('should clamp a value far below its baseline', () => {
    const result = planScaleFactors(
      MULTI_PLAN,
      userPlan([planTestResultId(1, 1, 1)])
    );
    expect(result.byExercise.get('pushup')).toBe(MIN_PLAN_SCALE);
  });

  it('should clamp a value far above its baseline', () => {
    // given a fat-fingered 500 against a baseline of 10
    const result = planScaleFactors(
      MULTI_PLAN,
      userPlan([planTestResultId(1, 1, 500)])
    );

    // then weeks of unusable targets are avoided
    expect(result.byExercise.get('pushup')).toBe(MAX_PLAN_SCALE);
  });

  it('should read a legacy single-value doc as the first field', () => {
    // given a doc written before test days could measure several things
    const result = planScaleFactors(MULTI_PLAN, userPlan(['1:60']));

    // then it still resolves — onto the day's first field, the plank
    expect(result.byExercise.get('plank.standard')).toBe(2);
  });
});

describe('scaleBreakdown', () => {
  it('should keep the sets summing to the new total', () => {
    expect(scaleBreakdown([20, 20, 20], 90).reduce((a, b) => a + b, 0)).toBe(
      90
    );
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
    expect(scaleBreakdown([10, 10, 10], 2).every((s) => s >= 1)).toBe(true);
  });

  it('should terminate on a total of zero', () => {
    expect(scaleBreakdown([10, 10], 0)).toEqual([10, 10]);
  });
});

describe('scaleTrainingPlanDay', () => {
  const f = factors({
    pushup: 1.5,
    'plank.standard': 2,
    'core.hollowhold': 1,
  });

  it('should leave rest days alone', () => {
    const rest = day(3, 'rest', 0);
    expect(scaleTrainingPlanDay(rest, f)).toBe(rest);
  });

  it('should leave test days alone', () => {
    // given a max test — an all-out effort, not a movable target
    const test = day(4, 'test', 100);
    expect(scaleTrainingPlanDay(test, f)).toBe(test);
  });

  it('should scale each exercise by its own measured factor', () => {
    // given a circuit day whose exercises the test measured differently
    const scaled = scaleTrainingPlanDay(MULTI_PLAN.days[1], f);
    const byId = new Map(
      (scaled.exercises ?? []).map((e) => [e.exerciseId, e])
    );

    // then each moves by its own ratio, not by one shared number
    expect(byId.get('pushup')?.target).toBe(30);
    expect(byId.get('plank.standard')?.target).toBe(180);
    expect(byId.get('core.hollowhold')?.target).toBe(60);
  });

  it('should move an unmeasured exercise with the pushup factor', () => {
    // given Dead Bug, which the opening test never measured
    const scaled = scaleTrainingPlanDay(MULTI_PLAN.days[1], f);
    const deadbug = (scaled.exercises ?? []).find(
      (e) => e.exerciseId === 'core.deadbug'
    );

    // then the plan does not end up half-adjusted
    expect(deadbug?.target).toBe(30);
  });

  it('should scale targetReps with the headline exercise', () => {
    // given the day's pushup portion at ×1.5
    const scaled = scaleTrainingPlanDay(MULTI_PLAN.days[1], f);

    // then the dashboard pill and the exercise list agree
    expect(scaled.targetReps).toBe(30);
    expect(scaled.sets).toEqual([15, 15]);
    const pushupTotal = (scaled.exercises ?? [])
      .filter((e) => e.exerciseId === 'pushup')
      .reduce((sum, e) => sum + e.target, 0);
    expect(pushupTotal).toBe(scaled.targetReps);
  });

  it('should keep the pushup items mirroring targetReps under odd factors', () => {
    // given a day that names the headline exercise twice
    const split = day(2, 'main', 40, {
      exercises: [
        { exerciseId: 'pushup', target: 25 },
        { exerciseId: 'pushup', target: 15 },
        { exerciseId: 'legs.squats', target: 50 },
      ],
    });

    // when scaled by a factor that rounds awkwardly
    const scaled = scaleTrainingPlanDay(split, factors({ pushup: 1.35 }));

    // then the two numbers the user sees still agree
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

    // then a target is not invented for it
    expect(
      scaleTrainingPlanDay(hiit, factors({ pushup: 2 })).exercises?.[0].target
    ).toBe(0);
  });

  it('should keep item sets summing to their own item target', () => {
    // given an item with a breakdown
    const d = day(2, 'main', 30, {
      exercises: [{ exerciseId: 'pushup', target: 30, sets: [12, 10, 8] }],
    });

    // when scaled by a factor that rounds awkwardly
    const item = scaleTrainingPlanDay(d, factors({ pushup: 1.17 }))
      .exercises?.[0];

    // then the invariant the catalog guard enforces still holds
    expect(item?.sets?.reduce((a, b) => a + b, 0)).toBe(item?.target);
  });
});

describe('scaleTrainingPlan', () => {
  it('should return the catalog object itself under neutral scaling', () => {
    // given an untested plan
    // then the untouched path is identity, not a rebuilt copy
    expect(scaleTrainingPlan(MULTI_PLAN, NO_PLAN_SCALING)).toBe(MULTI_PLAN);
    expect(scaleTrainingPlan(MULTI_PLAN, factors({ pushup: 1 }))).toBe(
      MULTI_PLAN
    );
  });

  it('should hand back the same object for a repeated factor set', () => {
    // given one scaled plan
    const first = scaleTrainingPlan(MULTI_PLAN, factors({ pushup: 1.5 }));

    // when the same factors are requested again, built independently
    const second = scaleTrainingPlan(MULTI_PLAN, factors({ pushup: 1.5 }));

    // then downstream computed signals are not invalidated for nothing
    expect(second).toBe(first);
  });

  it('should keep derived exercise items in step with the scaled day', () => {
    // given a plan scaled up
    const scaled = scaleTrainingPlan(MULTI_PLAN, factors({ pushup: 1.5 }));

    // then the item the UI renders carries the scaled target
    expect(planDayExercises(scaled.days[1])[0].target).toBe(30);
  });
});

describe('scaledPlanFor', () => {
  it('should leave the plan untouched for a user who skipped the test', () => {
    // given no recorded values
    // then they train the catalog plan, object identity included
    expect(scaledPlanFor(MULTI_PLAN, userPlan())).toBe(MULTI_PLAN);
  });

  it('should apply every measured baseline end to end', () => {
    // given the three-value baseline recorded
    const scaled = scaledPlanFor(MULTI_PLAN, userPlan(MULTI_RESULTS));
    const byId = new Map(
      (scaled?.days[1].exercises ?? []).map((e) => [e.exerciseId, e])
    );

    // then each exercise sits on its own factor, and the closing test
    // still asks for everything the user has
    expect(byId.get('pushup')?.target).toBe(30);
    expect(byId.get('plank.standard')?.target).toBe(180);
    expect(byId.get('core.hollowhold')?.target).toBe(60);
    expect(scaled?.days[3].targetReps).toBe(30);
  });

  it('should return null without a plan', () => {
    expect(scaledPlanFor(null, userPlan())).toBeNull();
  });
});

describe('scaling the shipped catalog', () => {
  const scalable = TRAINING_PLANS.filter((p) => p.baselineMax);

  it('should only name baselines on plans that open with a test', () => {
    for (const p of scalable) {
      expect(planBaselineTestDay(p)).not.toBeNull();
    }
    expect(scalable.length).toBeGreaterThan(0);
  });

  it('should scale Core Foundations plank work off the plank baseline', () => {
    // given a user who doubles the plank hold but matches the pushups
    const core = findPlanBySlug('core-4w') as TrainingPlan;
    const scaled = scaledPlanFor(
      core,
      userPlan([planTestResultId(1, 0, 60), planTestResultId(1, 1, 10)])
    ) as TrainingPlan;

    // when a later plank prescription is compared
    const before = core.days[1].exercises?.find(
      (e) => e.exerciseId === 'plank.standard'
    );
    const after = scaled.days[1].exercises?.find(
      (e) => e.exerciseId === 'plank.standard'
    );

    // then the plank moved and the pushups did not
    expect(after?.target).toBe((before?.target ?? 0) * 2);
    expect(scaled.days[1].targetReps).toBe(core.days[1].targetReps);
  });

  it('should hold the catalog invariants after scaling', () => {
    // given every scalable plan pushed to both clamp bounds
    const probes: PlanScaleFactors[] = [
      factors({ pushup: MIN_PLAN_SCALE }),
      factors({ pushup: 1.37, 'plank.standard': 0.8 }),
      factors({ pushup: MAX_PLAN_SCALE, 'core.hollowhold': 1.5 }),
    ];
    for (const p of scalable) {
      for (const probe of probes) {
        for (const d of scaleTrainingPlan(p, probe).days) {
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
          if (d.exercises) {
            const pushupTotal = d.exercises
              .filter((e) => e.exerciseId === 'pushup')
              .reduce((sum, e) => sum + e.target, 0);
            expect(pushupTotal).toBe(d.targetReps);
          }
        }
      }
    }
  });
});
