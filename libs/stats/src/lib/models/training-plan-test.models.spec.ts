import {
  isTestDay,
  isValidTestResult,
  MAX_TEST_REPS,
  MAX_TEST_SECONDS,
  parsePlanTestResultId,
  planBaselineTestDay,
  planFinalTestDay,
  planTestFields,
  planTestResult,
  planTestResultId,
  planTestResults,
} from './training-plan-test.models';
import { TrainingPlan, TrainingPlanDay } from './training-plan.models';
import { findPlanBySlug, TRAINING_PLANS } from './training-plan.catalog';

function day(
  dayIndex: number,
  kind: TrainingPlanDay['kind'],
  targetReps: number,
  extra: Partial<TrainingPlanDay> = {}
): TrainingPlanDay {
  return { dayIndex, kind, targetReps, description: '', ...extra };
}

function plan(days: TrainingPlanDay[]): TrainingPlan {
  return {
    id: 'p',
    slug: 'p',
    title: '',
    summary: '',
    level: 'beginner',
    totalDays: days.length,
    days,
  };
}

describe('planTestResultId / parsePlanTestResultId', () => {
  it('should round-trip a day, a field and a value', () => {
    // given an id for the second field of day 1
    const id = planTestResultId(1, 2, 37);

    // when it is parsed back
    // then nothing is lost
    expect(parsePlanTestResultId(id)).toEqual({
      dayIndex: 1,
      itemIndex: 2,
      value: 37,
    });
  });

  it('should read a legacy single-value id as the day first field', () => {
    // given the two-part shape that shipped before test days could
    // measure more than one exercise
    // then it still resolves, rather than being dropped as malformed
    expect(parsePlanTestResultId('1:37')).toEqual({
      dayIndex: 1,
      itemIndex: 0,
      value: 37,
    });
  });

  it('should reject a malformed id', () => {
    expect(parsePlanTestResultId('1:')).toBeNull();
    expect(parsePlanTestResultId('x:3')).toBeNull();
    expect(parsePlanTestResultId('1:2:3:4')).toBeNull();
  });
});

describe('planTestResults', () => {
  it('should return nothing for a day with no recorded values', () => {
    expect(planTestResults({ testResults: [] }, 1).size).toBe(0);
    expect(planTestResults(null, 1).size).toBe(0);
  });

  it('should collect every field of the requested day', () => {
    // given a three-value baseline and a separate closing test
    const doc = {
      testResults: [
        planTestResultId(1, 0, 45),
        planTestResultId(1, 1, 12),
        planTestResultId(1, 2, 30),
        planTestResultId(28, 1, 25),
      ],
    };

    // when the opening test's values are read
    const results = planTestResults(doc, 1);

    // then all three come back, and the closing test stays out of it
    expect(results.size).toBe(3);
    expect(results.get(0)).toBe(45);
    expect(results.get(1)).toBe(12);
    expect(results.get(2)).toBe(30);
    expect(planTestResult(doc, 28, 1)).toBe(25);
  });

  it('should let the last value win when a doc duplicates one field', () => {
    // given a hand-edited doc with two values for the same field
    const doc = {
      testResults: [planTestResultId(1, 0, 10), planTestResultId(1, 0, 30)],
    };

    // then the resolved value does not depend on array order luck
    expect(planTestResult(doc, 1, 0)).toBe(30);
  });
});

describe('planBaselineTestDay / planFinalTestDay', () => {
  it('should identify both tests of a plan that opens and closes with one', () => {
    // given a plan bracketed by max tests
    const p = plan([day(1, 'test', 0), day(2, 'main', 30), day(3, 'test', 50)]);

    // then the opening one drives scaling and the closing one the comparison
    expect(planBaselineTestDay(p)?.dayIndex).toBe(1);
    expect(planFinalTestDay(p)?.dayIndex).toBe(3);
  });

  it('should treat a single closing test as final, not baseline', () => {
    // given a plan whose only test is its last day
    const p = plan([day(1, 'main', 30), day(2, 'test', 50)]);

    // then there is nothing after it to rescale
    expect(planBaselineTestDay(p)).toBeNull();
    expect(planFinalTestDay(p)?.dayIndex).toBe(2);
  });

  it('should find no test at all in a plan without one', () => {
    const p = plan([day(1, 'main', 30)]);
    expect(planBaselineTestDay(p)).toBeNull();
    expect(planFinalTestDay(p)).toBeNull();
  });
});

describe('planTestFields', () => {
  it('should ask for one value per measurable exercise of the day', () => {
    // given a baseline that measures a hold, pushups and another hold
    const test = day(1, 'test', 10, {
      exercises: [
        { exerciseId: 'plank.standard', target: 30 },
        { exerciseId: 'pushup', target: 10 },
        { exerciseId: 'core.hollowhold', target: 20 },
      ],
    });

    // when its fields are resolved
    const fields = planTestFields(test);

    // then all three are asked for, each in its own unit
    expect(fields).toHaveLength(3);
    expect(fields.map((f) => f.exerciseId)).toEqual([
      'plank.standard',
      'pushup',
      'core.hollowhold',
    ]);
    expect(fields.map((f) => f.itemIndex)).toEqual([0, 1, 2]);
    expect(fields.map((f) => f.measurement)).toEqual(['time', 'reps', 'time']);
    expect(fields.every((f) => f.hasItem)).toBe(true);
  });

  it('should fall back to one pushup field when the test prescribes nothing', () => {
    // given the opening test of a plan that just says "go to failure"
    const fields = planTestFields(day(1, 'test', 0));

    // then there is still somewhere to put the result — and no row to tick
    expect(fields).toHaveLength(1);
    expect(fields[0].exerciseId).toBe('pushup');
    expect(fields[0].itemIndex).toBe(0);
    expect(fields[0].hasItem).toBe(false);
    expect(fields[0].recommended).toBe(0);
  });

  it('should carry the day own recommendation as the reference figure', () => {
    // given a test day recommending 100
    const fields = planTestFields(day(30, 'test', 100));

    // then the single derived field reports it
    expect(fields).toHaveLength(1);
    expect(fields[0].recommended).toBe(100);
    expect(fields[0].hasItem).toBe(true);
  });

  it('should skip exercises no result can be recorded against', () => {
    // given a day pairing pushups with a distance run
    const test = day(1, 'test', 20, {
      exercises: [
        { exerciseId: 'pushup', target: 20 },
        { exerciseId: 'cardio.running', target: 1000 },
      ],
    });

    // when its fields are resolved
    const fields = planTestFields(test);

    // then only the rep- and time-measured work is asked for
    expect(fields.map((f) => f.exerciseId)).toEqual(['pushup']);
  });
});

describe('isValidTestResult', () => {
  it('should accept a whole number in range for its unit', () => {
    expect(isValidTestResult(1)).toBe(true);
    expect(isValidTestResult(MAX_TEST_REPS)).toBe(true);
    expect(isValidTestResult(600, 'time')).toBe(true);
    expect(isValidTestResult(MAX_TEST_SECONDS, 'time')).toBe(true);
  });

  it('should reject nonsense a stray keypress could produce', () => {
    expect(isValidTestResult(0)).toBe(false);
    expect(isValidTestResult(-5)).toBe(false);
    expect(isValidTestResult(12.5)).toBe(false);
    expect(isValidTestResult(MAX_TEST_REPS + 1)).toBe(false);
    expect(isValidTestResult(Number.NaN)).toBe(false);
  });

  it('should allow a hold longer than the rep ceiling', () => {
    // given a duration that would be absurd as a rep count
    // then the unit decides, not one shared ceiling
    expect(isValidTestResult(MAX_TEST_REPS + 1, 'time')).toBe(true);
    expect(isValidTestResult(MAX_TEST_SECONDS + 1, 'time')).toBe(false);
  });
});

describe('isTestDay', () => {
  it('should distinguish a test day from the rest', () => {
    const p = plan([day(1, 'test', 0), day(2, 'main', 30)]);
    expect(isTestDay(p, 1)).toBe(true);
    expect(isTestDay(p, 2)).toBe(false);
    expect(isTestDay(p, 99)).toBe(false);
  });
});

describe('the shipped catalog', () => {
  it('should offer a writable field on every test day', () => {
    // given every test day in the catalog — including the ones whose
    // prescription is empty, which once rendered no input at all
    for (const p of TRAINING_PLANS) {
      for (const d of p.days.filter((x) => x.kind === 'test')) {
        expect(planTestFields(d).length).toBeGreaterThan(0);
      }
    }
  });

  it('should ask Core Foundations for all three of its baselines', () => {
    // given the day whose description names a plank hold, pushups and a
    // hollow hold — but which listed no exercises at all
    const core = findPlanBySlug('core-4w') as TrainingPlan;
    const baseline = planBaselineTestDay(core) as TrainingPlanDay;

    // when its fields are resolved
    const fields = planTestFields(baseline);

    // then each measurement gets its own input
    expect(fields.map((f) => f.exerciseId)).toEqual([
      'plank.standard',
      'pushup',
      'core.hollowhold',
    ]);
  });

  it('should ask the Push-Pull final test for pushups and pull-ups', () => {
    // given a closing test whose description names two max efforts
    const pushPull = findPlanBySlug('push-pull-6w') as TrainingPlan;
    const final = planFinalTestDay(pushPull) as TrainingPlanDay;

    // then both are recordable, not just the pushups
    expect(planTestFields(final).map((f) => f.exerciseId)).toEqual([
      'pushup',
      'pull.pullups',
    ]);
  });

  it('should name a baseline for every exercise its opening test measures', () => {
    // given every plan that rescales itself
    for (const p of TRAINING_PLANS.filter((x) => x.baselineMax)) {
      const baseline = planBaselineTestDay(p) as TrainingPlanDay;
      expect(baseline).not.toBeNull();
      // then no measured exercise is left without a reference to
      // compare against, which would silently drop it from scaling
      for (const field of planTestFields(baseline)) {
        expect(p.baselineMax?.[field.exerciseId]).toBeGreaterThan(0);
      }
    }
  });
});
