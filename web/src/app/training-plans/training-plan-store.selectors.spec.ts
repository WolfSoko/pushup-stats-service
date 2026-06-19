import { TrainingPlanDay, UserTrainingPlan } from '@pu-stats/models';
import {
  dayTarget,
  isDayDone,
  isDaySkipped,
  isRepsMeasuredPlanDay,
} from './training-plan-store.selectors';

const plan: UserTrainingPlan = {
  userId: 'u1',
  planId: 'p',
  startDate: '2026-06-01',
  status: 'active',
  completedDays: [1, 3],
  skippedDays: [4],
};

describe('isDayDone', () => {
  it('should be true when the index is in completedDays', () => {
    // given a completed day
    // when checking it
    // then it is done
    expect(isDayDone(plan, 3)).toBe(true);
  });

  it('should be false when the index is not completed', () => {
    // given a non-completed day
    expect(isDayDone(plan, 2)).toBe(false);
  });

  it('should be false when the plan is null', () => {
    // given no plan
    expect(isDayDone(null, 1)).toBe(false);
  });

  it('should be false when the index is null', () => {
    // given no resolved day index
    expect(isDayDone(plan, null)).toBe(false);
  });
});

describe('isDaySkipped', () => {
  it('should be true when the index is in skippedDays', () => {
    // given a skipped day
    expect(isDaySkipped(plan, 4)).toBe(true);
  });

  it('should be false when the index is not skipped', () => {
    // given a non-skipped day
    expect(isDaySkipped(plan, 1)).toBe(false);
  });

  it('should treat a missing skippedDays array as empty', () => {
    // given a plan without skippedDays
    const noSkips: UserTrainingPlan = { ...plan, skippedDays: undefined };
    // when checking any day
    expect(isDaySkipped(noSkips, 4)).toBe(false);
  });

  it('should be false when plan or index is null', () => {
    // given missing inputs
    expect(isDaySkipped(null, 4)).toBe(false);
    expect(isDaySkipped(plan, null)).toBe(false);
  });
});

describe('dayTarget', () => {
  it('should return the day target reps', () => {
    // given a day with a target
    const day: TrainingPlanDay = {
      dayIndex: 1,
      kind: 'main',
      targetReps: 25,
      description: 'd',
    };
    // when reading the target
    expect(dayTarget(day)).toBe(25);
  });

  it('should return 0 when the day is null', () => {
    // given no day
    expect(dayTarget(null)).toBe(0);
  });
});

describe('isRepsMeasuredPlanDay', () => {
  it('should short-circuit pushup to true without a catalog lookup', () => {
    // given a day with no explicit exerciseId (defaults to pushup)
    const day: TrainingPlanDay = {
      dayIndex: 1,
      kind: 'main',
      targetReps: 20,
      description: 'd',
    };
    // when checking measurement eligibility
    // then it is reps-measured
    expect(isRepsMeasuredPlanDay(day)).toBe(true);
  });

  it('should be true for a reps-measured catalog exercise', () => {
    // given a reps-measured exercise day
    const day: TrainingPlanDay = {
      dayIndex: 2,
      kind: 'main',
      targetReps: 30,
      exerciseId: 'legs.squats',
      description: 'd',
    };
    // when checking eligibility
    expect(isRepsMeasuredPlanDay(day)).toBe(true);
  });

  it('should be false for a time-measured catalog exercise', () => {
    // given a time-measured exercise day
    const day: TrainingPlanDay = {
      dayIndex: 2,
      kind: 'main',
      targetReps: 60,
      exerciseId: 'plank.standard',
      description: 'd',
    };
    // when checking eligibility
    // then it cannot be honored with a reps payload
    expect(isRepsMeasuredPlanDay(day)).toBe(false);
  });

  it('should be false for an unknown exercise id', () => {
    // given an exercise id not in the catalog
    const day: TrainingPlanDay = {
      dayIndex: 2,
      kind: 'main',
      targetReps: 10,
      exerciseId: 'does.not.exist',
      description: 'd',
    };
    // when checking eligibility
    expect(isRepsMeasuredPlanDay(day)).toBe(false);
  });
});
