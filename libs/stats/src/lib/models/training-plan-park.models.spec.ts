import {
  parkedFrom,
  planHasProgress,
  resumedPlanFrom,
  type ParkedTrainingPlan,
} from './training-plan-park.models';
import { TrainingPlan, UserTrainingPlan } from './training-plan.models';
import { currentPlanDayIndex } from './training-plan-schedule.models';

function userPlan(overrides: Partial<UserTrainingPlan> = {}): UserTrainingPlan {
  return {
    userId: 'u',
    planId: 'challenge-30d-v1',
    startDate: '2026-01-01',
    status: 'active',
    completedDays: [],
    ...overrides,
  };
}

const PLAN: Pick<TrainingPlan, 'id' | 'totalDays'> = {
  id: 'challenge-30d-v1',
  totalDays: 30,
};

describe('planHasProgress', () => {
  it('should be false for a plan the user only just activated', () => {
    // given nothing recorded — switching away costs nothing, so there is
    // no point asking the user about it
    expect(planHasProgress(userPlan())).toBe(false);
    expect(planHasProgress(null)).toBe(false);
  });

  it('should recognise every kind of progress a plan accumulates', () => {
    expect(planHasProgress(userPlan({ completedDays: [1] }))).toBe(true);
    expect(planHasProgress(userPlan({ skippedDays: [2] }))).toBe(true);
    expect(planHasProgress(userPlan({ completedItems: ['1:0'] }))).toBe(true);
    expect(planHasProgress(userPlan({ testResults: ['1:0:30'] }))).toBe(true);
  });
});

describe('parkedFrom', () => {
  it('should carry every field a resumed plan needs', () => {
    // given a plan with progress of each kind, on day 12
    const parked = parkedFrom(
      userPlan({
        completedDays: [1, 2, 3],
        skippedDays: [4],
        completedItems: ['1:0'],
        testResults: ['1:0:30'],
      }),
      12,
      new Date('2026-02-01T10:00:00.000Z')
    );

    // then nothing the user earned is left behind
    expect(parked).toEqual({
      planId: 'challenge-30d-v1',
      dayIndex: 12,
      completedDays: [1, 2, 3],
      skippedDays: [4],
      completedItems: ['1:0'],
      testResults: ['1:0:30'],
      parkedAt: '2026-02-01T10:00:00.000Z',
    });
  });

  it('should omit empty collections rather than writing empty arrays', () => {
    // given only completed days
    const parked = parkedFrom(userPlan({ completedDays: [1] }), 3);

    // then the record stays minimal
    expect(parked.skippedDays).toBeUndefined();
    expect(parked.completedItems).toBeUndefined();
    expect(parked.testResults).toBeUndefined();
  });

  it('should copy the arrays rather than aliasing the live document', () => {
    // given a plan whose arrays are still being mutated elsewhere
    const live = userPlan({ completedDays: [1] });
    const parked = parkedFrom(live, 2);

    // when the live document changes
    live.completedDays.push(2);

    // then the snapshot is unaffected
    expect(parked.completedDays).toEqual([1]);
  });

  it('should never park a day index below one', () => {
    // given a plan whose day could not be resolved
    expect(parkedFrom(userPlan(), 0).dayIndex).toBe(1);
  });
});

describe('resumedPlanFrom', () => {
  const parked: ParkedTrainingPlan = {
    planId: 'challenge-30d-v1',
    dayIndex: 12,
    completedDays: [1, 2, 3],
    skippedDays: [4],
    completedItems: ['1:0'],
    testResults: ['1:0:30'],
    parkedAt: '2026-02-01T10:00:00.000Z',
  };

  it('should re-anchor the start date so today is the day left off', () => {
    // given a plan parked on day 12, resumed three weeks later
    const resumed = resumedPlanFrom(parked, PLAN, '2026-02-22');

    // then the break does not read as three weeks of missed training
    expect(currentPlanDayIndex(PLAN, resumed.startDate, '2026-02-22')).toBe(12);
  });

  it('should restore every kind of progress', () => {
    const resumed = resumedPlanFrom(parked, PLAN, '2026-02-22');

    expect(resumed.completedDays).toEqual([1, 2, 3]);
    expect(resumed.skippedDays).toEqual([4]);
    expect(resumed.completedItems).toEqual(['1:0']);
    expect(resumed.testResults).toEqual(['1:0:30']);
    expect(resumed.status).toBe('active');
  });

  it('should fall back to today when the parked day no longer fits', () => {
    // given a record parked on a day the plan no longer has — a retired
    // or re-versioned catalog entry
    const stale = { ...parked, dayIndex: 99 };

    // when it is resumed
    const resumed = resumedPlanFrom(stale, PLAN, '2026-02-22');

    // then the plan still opens rather than resolving to no day at all
    expect(resumed.startDate).toBe('2026-02-22');
  });

  it('should not alias the parked record arrays', () => {
    // given a resumed plan
    const resumed = resumedPlanFrom(parked, PLAN, '2026-02-22');

    // when the live plan advances
    resumed.completedDays.push(5);

    // then the snapshot it came from is untouched
    expect(parked.completedDays).toEqual([1, 2, 3]);
  });
});
