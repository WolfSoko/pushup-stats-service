import { describe, expect, it } from '@jest/globals';

import {
  dailyReminderGoal,
  isGoalPauseEnabled,
  planReminderGoal,
  shouldPauseForReachedGoal,
} from './reminder-goal.models';
import { reminderGoalLine } from './reminder-i18n.models';
import type { PlanExerciseProgress } from './training-plan-exercise.models';

function progress(
  overrides: Partial<PlanExerciseProgress> & { target: number }
): PlanExerciseProgress {
  const { target, ...rest } = overrides;
  return {
    itemIndex: 0,
    exercise: { exerciseId: 'pushup', target },
    logged: 0,
    fulfilledByEntries: false,
    checkedOff: false,
    done: false,
    ...rest,
  };
}

describe('reminder-goal.models', () => {
  describe('planReminderGoal', () => {
    it('should report the exercise numbers for a single-exercise day', () => {
      // given
      const day = [progress({ target: 100, logged: 60 })];

      // when
      const goal = planReminderGoal(day, 12);

      // then
      expect(goal).toEqual({
        kind: 'plan',
        dayIndex: 12,
        counts: 'value',
        done: 60,
        target: 100,
        reached: false,
      });
    });

    it('should count finished exercises on a multi-exercise day', () => {
      // given
      const day = [
        progress({
          target: 50,
          logged: 50,
          fulfilledByEntries: true,
          done: true,
        }),
        progress({ itemIndex: 1, target: 90, logged: 45 }),
      ];

      // when
      const goal = planReminderGoal(day, 3);

      // then
      expect(goal).toMatchObject({
        counts: 'items',
        done: 1,
        target: 2,
        reached: false,
      });
    });

    it('should be reached once every exercise of the day is done', () => {
      // given
      const day = [
        progress({ target: 50, logged: 50, done: true }),
        progress({ itemIndex: 1, target: 90, logged: 90, done: true }),
      ];

      // when / then
      expect(planReminderGoal(day, 3)?.reached).toBe(true);
    });

    it('should treat a hand-ticked single exercise as reached', () => {
      // given
      const day = [
        progress({ target: 100, logged: 100, checkedOff: true, done: true }),
      ];

      // when / then
      expect(planReminderGoal(day, 1)?.reached).toBe(true);
    });

    it('should return null for a day that prescribes nothing', () => {
      // when / then
      expect(planReminderGoal([], 4)).toBeNull();
      expect(planReminderGoal([progress({ target: 0 })], 4)).toBeNull();
    });
  });

  describe('dailyReminderGoal', () => {
    it('should report progress toward the configured goal', () => {
      // when
      const goal = dailyReminderGoal(40, 100);

      // then
      expect(goal).toEqual({
        kind: 'daily',
        counts: 'value',
        done: 40,
        target: 100,
        reached: false,
      });
    });

    it('should cap the reported amount at the goal once reached', () => {
      // when
      const goal = dailyReminderGoal(130, 100);

      // then
      expect(goal).toMatchObject({ done: 100, reached: true });
    });

    it('should return null when no goal is configured', () => {
      // when / then
      expect(dailyReminderGoal(40, 0)).toBeNull();
      expect(dailyReminderGoal(40, Number.NaN)).toBeNull();
    });
  });

  describe('shouldPauseForReachedGoal', () => {
    it('should pause a reached goal by default', () => {
      // given
      const reached = dailyReminderGoal(100, 100);

      // when / then
      expect(shouldPauseForReachedGoal(undefined, reached)).toBe(true);
      expect(shouldPauseForReachedGoal({}, reached)).toBe(true);
      expect(isGoalPauseEnabled(undefined)).toBe(true);
    });

    it('should keep reminding when the user switched the pause off', () => {
      // given
      const reached = dailyReminderGoal(100, 100);

      // when / then
      expect(
        shouldPauseForReachedGoal({ pauseWhenGoalReached: false }, reached)
      ).toBe(false);
    });

    it('should not pause an open goal or a missing one', () => {
      // when / then
      expect(shouldPauseForReachedGoal({}, dailyReminderGoal(40, 100))).toBe(
        false
      );
      expect(shouldPauseForReachedGoal({}, null)).toBe(false);
    });
  });

  describe('reminderGoalLine', () => {
    it('should name the remaining reps of the daily goal', () => {
      // when / then
      expect(reminderGoalLine('de', dailyReminderGoal(40, 100))).toBe(
        'Tagesziel: 40/100 – noch 60'
      );
      expect(reminderGoalLine('en-GB', dailyReminderGoal(40, 100))).toBe(
        'Daily goal: 40/100 – 60 to go'
      );
    });

    it('should name the plan day and its numbers', () => {
      // given
      const goal = planReminderGoal(
        [progress({ target: 100, logged: 60 })],
        12
      );

      // when / then
      expect(reminderGoalLine('de', goal)).toBe(
        'Plan-Tag 12: 60/100 – noch 40'
      );
    });

    it('should count exercises on a multi-exercise plan day', () => {
      // given
      const goal = planReminderGoal(
        [
          progress({ target: 50, logged: 50, done: true }),
          progress({ itemIndex: 1, target: 90, logged: 45 }),
        ],
        3
      );

      // when / then
      expect(reminderGoalLine('de', goal)).toBe(
        'Plan-Tag 3: 1/2 Übungen geschafft'
      );
    });

    it('should be empty without a goal', () => {
      // when / then
      expect(reminderGoalLine('de', null)).toBe('');
    });
  });
});
