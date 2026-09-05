import {
  EMPTY_PROGRESS,
  advanceProgress,
  newlyEarned,
  type AchievementProgress,
} from './logic';

const PLAN_3_DAYS = {
  days: [
    { dayIndex: 0, kind: 'work' },
    { dayIndex: 1, kind: 'work' },
    { dayIndex: 2, kind: 'work' },
  ],
} as Parameters<typeof advanceProgress>[2];

describe('advanceProgress', () => {
  describe('Given the first plan', () => {
    it('should count the completed days', () => {
      // when
      const progress = advanceProgress(
        EMPTY_PROGRESS,
        { planId: 'core-4w', completedDays: [0, 1], skippedDays: [] },
        PLAN_3_DAYS
      );

      // then
      expect(progress).toEqual(
        expect.objectContaining({
          planDayTotal: 0,
          currentPlanId: 'core-4w',
          currentPlanDays: 2,
        })
      );
    });
  });

  describe('Given a day is un-marked afterwards', () => {
    it('should not decrease the count', () => {
      // given
      const before: AchievementProgress = {
        planDayTotal: 0,
        currentPlanId: 'core-4w',
        currentPlanDays: 2,
        completedPlanIds: [],
      };

      // when — the user corrects a mistake and removes a day
      const progress = advanceProgress(
        before,
        { planId: 'core-4w', completedDays: [0], skippedDays: [] },
        PLAN_3_DAYS
      );

      // then — a badge already earned must not be revoked
      expect(progress.currentPlanDays).toBe(2);
    });
  });

  describe('Given the user switches plans', () => {
    it('should bank the previous plan days into the total', () => {
      // given
      const before: AchievementProgress = {
        planDayTotal: 5,
        currentPlanId: 'core-4w',
        currentPlanDays: 4,
        completedPlanIds: [],
      };

      // when
      const progress = advanceProgress(
        before,
        { planId: 'hiit-4w', completedDays: [0], skippedDays: [] },
        PLAN_3_DAYS
      );

      // then — milestones keep counting across plans
      expect(progress).toEqual(
        expect.objectContaining({
          planDayTotal: 9,
          currentPlanId: 'hiit-4w',
          currentPlanDays: 1,
        })
      );
    });
  });

  describe('Given every required day is done', () => {
    it('should record the plan as completed once', () => {
      // when
      const first = advanceProgress(
        EMPTY_PROGRESS,
        { planId: 'core-4w', completedDays: [0, 1, 2], skippedDays: [] },
        PLAN_3_DAYS
      );
      const again = advanceProgress(
        first,
        { planId: 'core-4w', completedDays: [0, 1, 2], skippedDays: [] },
        PLAN_3_DAYS
      );

      // then
      expect(first.completedPlanIds).toEqual(['core-4w']);
      expect(again.completedPlanIds).toEqual(['core-4w']);
    });

    it('should not record a plan the catalog no longer knows', () => {
      // given — the plan was removed from the catalog after the user
      // started it; completion cannot be judged, so nothing is awarded
      // when
      const progress = advanceProgress(
        EMPTY_PROGRESS,
        { planId: 'gone-4w', completedDays: [0, 1, 2], skippedDays: [] },
        null
      );

      // then
      expect(progress.completedPlanIds).toEqual([]);
      expect(progress.currentPlanDays).toBe(3);
    });
  });
});

describe('newlyEarned', () => {
  it('should return only badges not already awarded', () => {
    // given
    const progress: AchievementProgress = {
      planDayTotal: 8,
      currentPlanId: 'core-4w',
      currentPlanDays: 3,
      completedPlanIds: ['core-4w'],
    };

    // when
    const ids = newlyEarned(progress, ['plan-days-1']);

    // then
    expect(ids).toEqual(['plan-days-10', 'plan-completed-core-4w']);
  });

  it('should return nothing when everything is already awarded', () => {
    // given
    const progress: AchievementProgress = {
      planDayTotal: 0,
      currentPlanId: 'core-4w',
      currentPlanDays: 1,
      completedPlanIds: [],
    };

    // when
    const ids = newlyEarned(progress, ['plan-days-1']);

    // then
    expect(ids).toEqual([]);
  });

  it('should count banked and current plan days together', () => {
    // given — 9 banked plus 1 current crosses the 10-day milestone
    const progress: AchievementProgress = {
      planDayTotal: 9,
      currentPlanId: 'hiit-4w',
      currentPlanDays: 1,
      completedPlanIds: [],
    };

    // when
    const ids = newlyEarned(progress, ['plan-days-1']);

    // then
    expect(ids).toEqual(['plan-days-10']);
  });
});
