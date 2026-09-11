import { describe, expect, it } from '@jest/globals';

import {
  configuredDailyGoal,
  planGoalFromTotals,
  reminderGoalExerciseIds,
  reminderPlanDay,
} from './reminder-goal';

// A plan whose days prescribe push-ups and nothing else — the shape the
// `counts: 'value'` branch is about. (The 30-day challenge stopped being
// one when it gained core and leg work.)
const PUSHUP_PLAN = 'recruit-6w-v1';
const CORE_PLAN = 'core-4w-v1';

function activePlan(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'u1',
    planId: PUSHUP_PLAN,
    startDate: '2026-09-09',
    status: 'active' as const,
    completedDays: [],
    ...overrides,
  };
}

describe('push/reminder-goal', () => {
  describe('reminderPlanDay', () => {
    it('should resolve the day the user is on today', () => {
      // given
      const plan = activePlan();

      // when — day 3 of the plan, a pushup-only main day
      const resolved = reminderPlanDay(plan, '2026-09-11');

      // then
      expect(resolved?.dayIndex).toBe(3);
      expect(resolved?.day.targetReps).toBe(33);
    });

    it('should ignore a plan that is not active', () => {
      // when / then
      expect(
        reminderPlanDay(activePlan({ status: 'abandoned' }), '2026-09-10')
      ).toBeNull();
      expect(reminderPlanDay(undefined, '2026-09-10')).toBeNull();
    });

    it('should ignore a plan id that is no longer in the catalog', () => {
      // when / then
      expect(
        reminderPlanDay(activePlan({ planId: 'retired-plan' }), '2026-09-10')
      ).toBeNull();
    });

    it('should report nothing before the plan starts', () => {
      // when / then
      expect(reminderPlanDay(activePlan(), '2026-09-08')).toBeNull();
    });

    it('should report nothing on a day that prescribes no target', () => {
      // when — day 1 of the challenge plan is the max test (target 0)
      const resolved = reminderPlanDay(
        activePlan({ planId: 'challenge-30d-v1' }),
        '2026-09-09'
      );

      // then
      expect(resolved).toBeNull();
    });

    it('should scale the day by the measured opening test', () => {
      // given — the plan's numbers assume 22 reps; this user managed 44
      const plan = activePlan({
        planId: 'challenge-30d-v1',
        testResults: ['1:0:44'],
      });

      // when
      const resolved = reminderPlanDay(plan, '2026-09-10');

      // then
      expect(resolved?.day.targetReps).toBeGreaterThan(60);
    });
  });

  describe('planGoalFromTotals', () => {
    it('should report the day total against the prescribed reps', () => {
      // given
      const { day, dayIndex } = reminderPlanDay(
        activePlan(),
        '2026-09-11'
      ) as NonNullable<ReturnType<typeof reminderPlanDay>>;

      // when
      const goal = planGoalFromTotals(
        day,
        dayIndex,
        [],
        new Map([['pushup', 25]]),
        '2026-09-11'
      );

      // then
      expect(goal).toMatchObject({
        kind: 'plan',
        dayIndex: 3,
        counts: 'value',
        done: 25,
        target: 33,
        reached: false,
      });
    });

    it('should be reached once the aggregate covers the day', () => {
      // given
      const { day, dayIndex } = reminderPlanDay(
        activePlan(),
        '2026-09-11'
      ) as NonNullable<ReturnType<typeof reminderPlanDay>>;

      // when
      const goal = planGoalFromTotals(
        day,
        dayIndex,
        [],
        new Map([['pushup', 33]]),
        '2026-09-11'
      );

      // then
      expect(goal?.reached).toBe(true);
    });

    it('should count exercises on a multi-exercise day', () => {
      // given — Core Foundations day 2: plank, hollow hold, dead bug, pushups
      const resolved = reminderPlanDay(
        activePlan({ planId: CORE_PLAN, startDate: '2026-09-09' }),
        '2026-09-10'
      ) as NonNullable<ReturnType<typeof reminderPlanDay>>;

      // when — only the pushups are logged
      const goal = planGoalFromTotals(
        resolved.day,
        resolved.dayIndex,
        [],
        new Map([['pushup', 20]]),
        '2026-09-10'
      );

      // then
      expect(goal).toMatchObject({ counts: 'items', done: 1, target: 4 });
      expect(goal?.reached).toBe(false);
    });

    it('should credit hand-ticked exercises', () => {
      // given
      const resolved = reminderPlanDay(
        activePlan({ planId: CORE_PLAN, startDate: '2026-09-09' }),
        '2026-09-10'
      ) as NonNullable<ReturnType<typeof reminderPlanDay>>;
      const allItems = reminderGoalExerciseIds(resolved.day).map(
        (_, i) => `${resolved.dayIndex}:${i}`
      );

      // when
      const goal = planGoalFromTotals(
        resolved.day,
        resolved.dayIndex,
        allItems,
        new Map(),
        '2026-09-10'
      );

      // then
      expect(goal?.reached).toBe(true);
    });

    it('should fulfil a seconds-based exercise from its day aggregate', () => {
      // given — day 2 prescribes 90 s of plank across three sets
      const resolved = reminderPlanDay(
        activePlan({ planId: CORE_PLAN, startDate: '2026-09-09' }),
        '2026-09-10'
      ) as NonNullable<ReturnType<typeof reminderPlanDay>>;

      // when
      const goal = planGoalFromTotals(
        resolved.day,
        resolved.dayIndex,
        [],
        new Map([['plank.standard', 90]]),
        '2026-09-10'
      );

      // then
      expect(goal).toMatchObject({ counts: 'items', done: 1 });
    });
  });

  describe('reminderGoalExerciseIds', () => {
    it('should list each prescribed exercise once', () => {
      // given
      const resolved = reminderPlanDay(
        activePlan({ planId: CORE_PLAN, startDate: '2026-09-09' }),
        '2026-09-10'
      ) as NonNullable<ReturnType<typeof reminderPlanDay>>;

      // when
      const ids = reminderGoalExerciseIds(resolved.day);

      // then
      expect(ids).toContain('pushup');
      expect(ids).toContain('plank.standard');
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('configuredDailyGoal', () => {
    it('should sum the rep-based complex daily goals', () => {
      // given
      const config = {
        goals: {
          daily: [
            {
              id: 'a',
              exerciseId: 'pushup',
              target: 80,
              measurement: 'reps',
              unit: 'reps',
            },
            {
              id: 'b',
              exerciseId: 'plank.standard',
              target: 120,
              measurement: 'time',
              unit: 's',
            },
          ],
        },
        dailyGoal: 50,
      };

      // when / then — the seconds goal must not inflate the rep target
      expect(configuredDailyGoal(config)).toBe(80);
    });

    it('should fall back to the legacy single number', () => {
      // when / then
      expect(configuredDailyGoal({ dailyGoal: 120 })).toBe(120);
    });

    it('should report no goal when none is configured', () => {
      // when / then
      expect(configuredDailyGoal({})).toBe(0);
      expect(configuredDailyGoal(undefined)).toBe(0);
      expect(configuredDailyGoal({ dailyGoal: 0 })).toBe(0);
    });
  });
});
