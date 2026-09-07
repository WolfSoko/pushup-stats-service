import {
  isTestDay,
  isValidTestResult,
  MAX_TEST_REPS,
  parsePlanTestResultId,
  planBaselineTestDay,
  planFinalTestDay,
  planTestExercise,
  planTestResult,
  planTestResultId,
} from './training-plan-test.models';
import { TrainingPlan, TrainingPlanDay } from './training-plan.models';
import { TRAINING_PLANS } from './training-plan.catalog';

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
  it('should round-trip a day index and a result', () => {
    // given an id built for day 1 with 37 reps
    const id = planTestResultId(1, 37);

    // when it is parsed back
    // then nothing is lost
    expect(parsePlanTestResultId(id)).toEqual({ dayIndex: 1, reps: 37 });
  });

  it('should reject a malformed id', () => {
    expect(parsePlanTestResultId('1:')).toBeNull();
    expect(parsePlanTestResultId('x:3')).toBeNull();
    expect(parsePlanTestResultId('1:2:3')).toBeNull();
  });
});

describe('planTestResult', () => {
  it('should return null for a day with no recorded result', () => {
    expect(planTestResult({ testResults: [] }, 1)).toBeNull();
    expect(planTestResult(null, 1)).toBeNull();
  });

  it('should read the result of the requested day only', () => {
    // given results for the opening and closing tests
    const doc = {
      testResults: [planTestResultId(1, 20), planTestResultId(30, 44)],
    };

    // then each day resolves to its own number
    expect(planTestResult(doc, 1)).toBe(20);
    expect(planTestResult(doc, 30)).toBe(44);
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

describe('planTestExercise', () => {
  it('should fall back to the pushup sentinel when the test prescribes nothing', () => {
    // given the opening test of a plan that just says "go to failure"
    const test = day(1, 'test', 0);

    // when the measured exercise is resolved
    const resolved = planTestExercise(test);

    // then there is still somewhere to write the attempt — and no row to tick
    expect(resolved.exerciseId).toBe('pushup');
    expect(resolved.itemIndex).toBeNull();
    expect(resolved.recommended).toBe(0);
  });

  it('should target the single derived item of a plain test day', () => {
    // given a test day carrying a recommendation
    const resolved = planTestExercise(day(30, 'test', 100));

    // then the attempt closes the day's one exercise row
    expect(resolved.exerciseId).toBe('pushup');
    expect(resolved.itemIndex).toBe(0);
    expect(resolved.recommended).toBe(100);
  });

  it('should pick the first rep-counted item of a multi-exercise test', () => {
    // given a functional test that opens with a timed hold
    const test = day(28, 'test', 30, {
      exercises: [
        { exerciseId: 'plank.standard', target: 60 },
        { exerciseId: 'pushup', target: 30 },
        { exerciseId: 'core.hollowhold', target: 60 },
      ],
    });

    // when the measured exercise is resolved
    const resolved = planTestExercise(test);

    // then the max attempt lands on the pushups, not the plank
    expect(resolved.exerciseId).toBe('pushup');
    expect(resolved.itemIndex).toBe(1);
  });
});

describe('isValidTestResult', () => {
  it('should accept a whole number of reps in range', () => {
    expect(isValidTestResult(1)).toBe(true);
    expect(isValidTestResult(37)).toBe(true);
    expect(isValidTestResult(MAX_TEST_REPS)).toBe(true);
  });

  it('should reject nonsense a stray keypress could produce', () => {
    expect(isValidTestResult(0)).toBe(false);
    expect(isValidTestResult(-5)).toBe(false);
    expect(isValidTestResult(12.5)).toBe(false);
    expect(isValidTestResult(MAX_TEST_REPS + 1)).toBe(false);
    expect(isValidTestResult(Number.NaN)).toBe(false);
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
  it('should offer a writable max-test exercise on every test day', () => {
    // given every test day in the catalog — including the two whose
    // prescription is empty, which previously rendered no input at all
    for (const p of TRAINING_PLANS) {
      for (const d of p.days.filter((x) => x.kind === 'test')) {
        // then each resolves an exercise the result can be written against
        expect(planTestExercise(d).exerciseId).toBeTruthy();
      }
    }
  });
});
