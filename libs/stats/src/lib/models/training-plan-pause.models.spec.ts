import { describe, expect, it } from '@jest/globals';

import {
  isPausedPlan,
  pausedPlanDayIndex,
  pausedPlanPatch,
  resumeStartDate,
} from './training-plan-pause.models';
import { currentPlanDayIndex } from './training-plan-schedule.models';
import type { UserTrainingPlan } from './training-plan.models';

const PLAN = { totalDays: 30 };

function userPlan(overrides: Partial<UserTrainingPlan> = {}): UserTrainingPlan {
  return {
    userId: 'u1',
    planId: 'challenge-30d-v1',
    startDate: '2026-09-01',
    status: 'active',
    completedDays: [],
    ...overrides,
  };
}

describe('training-plan-pause.models', () => {
  describe('isPausedPlan', () => {
    it('should only call a paused plan paused', () => {
      // when / then
      expect(isPausedPlan(userPlan({ status: 'paused' }))).toBe(true);
      expect(isPausedPlan(userPlan())).toBe(false);
      expect(isPausedPlan(userPlan({ status: 'abandoned' }))).toBe(false);
      expect(isPausedPlan(null)).toBe(false);
      expect(isPausedPlan(undefined)).toBe(false);
    });
  });

  describe('pausedPlanDayIndex', () => {
    it('should report the frozen day of a paused plan', () => {
      // given
      const plan = userPlan({ status: 'paused', pausedDayIndex: 12 });

      // when / then
      expect(pausedPlanDayIndex(plan, PLAN.totalDays)).toBe(12);
    });

    it('should report nothing for a plan that is running', () => {
      // when / then
      expect(
        pausedPlanDayIndex(userPlan({ pausedDayIndex: 12 }), 30)
      ).toBeNull();
    });

    it('should reject a frozen day the plan cannot have', () => {
      // when / then — hand-edited or from a re-versioned catalog entry
      expect(
        pausedPlanDayIndex({ status: 'paused', pausedDayIndex: 31 }, 30)
      ).toBeNull();
      expect(
        pausedPlanDayIndex({ status: 'paused', pausedDayIndex: 0 }, 30)
      ).toBeNull();
      expect(
        pausedPlanDayIndex({ status: 'paused', pausedDayIndex: 4.5 }, 30)
      ).toBeNull();
      expect(pausedPlanDayIndex({ status: 'paused' }, 30)).toBeNull();
    });
  });

  describe('pausedPlanPatch', () => {
    it('should freeze the day and stamp when the break started', () => {
      // given
      const now = new Date('2026-09-10T18:30:00.000Z');

      // when
      const patch = pausedPlanPatch(7, now);

      // then
      expect(patch).toEqual({
        status: 'paused',
        pausedAt: '2026-09-10T18:30:00.000Z',
        pausedDayIndex: 7,
      });
    });

    it('should never freeze below day 1', () => {
      // when / then
      expect(pausedPlanPatch(0).pausedDayIndex).toBe(1);
    });
  });

  describe('resumeStartDate', () => {
    it('should re-anchor so the frozen day is today again', () => {
      // given — paused on day 12, resuming three weeks later
      const plan = userPlan({ status: 'paused', pausedDayIndex: 12 });
      const today = '2026-10-05';

      // when
      const startDate = resumeStartDate(plan, PLAN, today);

      // then — the break costs no plan days
      expect(startDate).not.toBeNull();
      expect(currentPlanDayIndex(PLAN, startDate as string, today)).toBe(12);
    });

    it('should leave the schedule alone when there is no usable frozen day', () => {
      // when / then
      expect(resumeStartDate(userPlan(), PLAN, '2026-10-05')).toBeNull();
      expect(
        resumeStartDate(
          userPlan({ status: 'paused', pausedDayIndex: 99 }),
          PLAN,
          '2026-10-05'
        )
      ).toBeNull();
      expect(
        resumeStartDate(
          userPlan({ status: 'paused', pausedDayIndex: 12 }),
          null,
          '2026-10-05'
        )
      ).toBeNull();
    });
  });
});
