import { TrainingPlanDay, UserTrainingPlan } from '@pu-stats/models';
import {
  dayTarget,
  isDayDone,
  isDaySkipped,
  isPlanActive,
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

describe('isPlanActive', () => {
  const active = { planId: 'challenge-30d-v1', status: 'active' as const };

  it('should hold when the active plan is this plan', () => {
    // given / when / then
    expect(isPlanActive({ id: 'challenge-30d-v1' }, active)).toBe(true);
  });

  it('should not hold for a different plan', () => {
    // given / when / then
    expect(isPlanActive({ id: 'recruit-6w-v1' }, active)).toBe(false);
  });

  it('should not hold when the plan was abandoned', () => {
    // given / when / then
    expect(
      isPlanActive(
        { id: 'challenge-30d-v1' },
        { ...active, status: 'abandoned' }
      )
    ).toBe(false);
  });

  it('should not hold without an active plan', () => {
    // given / when / then
    expect(isPlanActive({ id: 'challenge-30d-v1' }, null)).toBe(false);
  });

  it('should not hold without a plan', () => {
    // given / when / then
    expect(isPlanActive(null, active)).toBe(false);
  });
});
