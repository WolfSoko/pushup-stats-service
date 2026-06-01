import {
  currentPlanDayIndex,
  isPlanCompleted,
  planDayByIndex,
  startDateForTargetDay,
  TrainingPlan,
  trainingPlanDayExerciseId,
} from './training-plan.models';
import { findExerciseDefinition } from './exercise.catalog';
import { findPlanById, TRAINING_PLANS } from './training-plan.catalog';

describe('training-plan models', () => {
  describe('currentPlanDayIndex', () => {
    const plan = { totalDays: 30 };

    it('returns 1 on the start date', () => {
      expect(currentPlanDayIndex(plan, '2026-04-01', '2026-04-01')).toBe(1);
    });

    it('returns N+1 days after start', () => {
      expect(currentPlanDayIndex(plan, '2026-04-01', '2026-04-08')).toBe(8);
    });

    it('caps at totalDays once the plan would have ended', () => {
      expect(currentPlanDayIndex(plan, '2026-04-01', '2026-06-30')).toBe(30);
    });

    it('returns null when today is before the start date', () => {
      expect(currentPlanDayIndex(plan, '2026-04-10', '2026-04-09')).toBeNull();
    });

    it('returns null on malformed dates', () => {
      expect(currentPlanDayIndex(plan, 'nope', '2026-04-01')).toBeNull();
      expect(currentPlanDayIndex(plan, '2026-04-01', '2026/04/01')).toBeNull();
    });

    it('returns null on impossible calendar dates', () => {
      // 2026-02-30 doesn't exist; Date() would otherwise overflow.
      expect(currentPlanDayIndex(plan, '2026-02-30', '2026-04-01')).toBeNull();
      expect(currentPlanDayIndex(plan, '2026-04-01', '2026-13-01')).toBeNull();
    });

    it('crosses month and year boundaries via calendar diff', () => {
      // 2025-12-31 -> 2026-01-02 = day 3
      expect(currentPlanDayIndex(plan, '2025-12-31', '2026-01-02')).toBe(3);
    });
  });

  describe('planDayByIndex', () => {
    const plan: TrainingPlan = {
      id: 'test',
      slug: 'test',
      title: '',
      summary: '',
      level: 'beginner',
      totalDays: 3,
      days: [
        { dayIndex: 1, kind: 'main', targetReps: 30, description: '' },
        { dayIndex: 2, kind: 'rest', targetReps: 0, description: '' },
        { dayIndex: 3, kind: 'main', targetReps: 33, description: '' },
      ],
    };

    it('looks up by dayIndex', () => {
      expect(planDayByIndex(plan, 2)?.kind).toBe('rest');
      expect(planDayByIndex(plan, 3)?.targetReps).toBe(33);
    });

    it('returns null for out-of-range indexes', () => {
      expect(planDayByIndex(plan, 0)).toBeNull();
      expect(planDayByIndex(plan, 4)).toBeNull();
    });
  });

  describe('isPlanCompleted', () => {
    const plan: TrainingPlan = {
      id: 'test',
      slug: 'test',
      title: '',
      summary: '',
      level: 'beginner',
      totalDays: 4,
      days: [
        { dayIndex: 1, kind: 'main', targetReps: 30, description: '' },
        { dayIndex: 2, kind: 'rest', targetReps: 0, description: '' },
        { dayIndex: 3, kind: 'main', targetReps: 33, description: '' },
        { dayIndex: 4, kind: 'test', targetReps: 50, description: '' },
      ],
    };

    it('is true once every non-rest day is completed', () => {
      expect(isPlanCompleted(plan, [1, 3, 4])).toBe(true);
    });

    it('ignores rest days even if they are not in completedDays', () => {
      expect(isPlanCompleted(plan, [1, 3, 4])).toBe(true);
    });

    it('is false while any non-rest day is missing', () => {
      expect(isPlanCompleted(plan, [1, 4])).toBe(false);
      expect(isPlanCompleted(plan, [])).toBe(false);
    });

    it('treats skipped non-rest days as not required', () => {
      // Day 3 skipped → only 1 and 4 are required.
      expect(isPlanCompleted(plan, [1, 4], [3])).toBe(true);
    });

    it('returns false when every working day is skipped (nothing to finish)', () => {
      expect(isPlanCompleted(plan, [], [1, 3, 4])).toBe(false);
    });
  });

  describe('startDateForTargetDay', () => {
    it('returns today for targetDay === 1', () => {
      expect(startDateForTargetDay(30, 1, '2026-04-15')).toBe('2026-04-15');
    });

    it('returns today minus (target-1) days for later targets', () => {
      expect(startDateForTargetDay(30, 8, '2026-04-15')).toBe('2026-04-08');
    });

    it('crosses month boundaries', () => {
      // 2026-05-02 - 5 days = 2026-04-27
      expect(startDateForTargetDay(30, 6, '2026-05-02')).toBe('2026-04-27');
    });

    it('crosses year boundaries', () => {
      // 2026-01-02 - 5 days = 2025-12-28
      expect(startDateForTargetDay(30, 6, '2026-01-02')).toBe('2025-12-28');
    });

    it('returns null for out-of-range targets', () => {
      expect(startDateForTargetDay(30, 0, '2026-04-15')).toBeNull();
      expect(startDateForTargetDay(30, 31, '2026-04-15')).toBeNull();
      expect(startDateForTargetDay(30, -1, '2026-04-15')).toBeNull();
    });

    it('returns null on malformed today', () => {
      expect(startDateForTargetDay(30, 1, 'nope')).toBeNull();
    });
  });

  describe('catalog', () => {
    it('exposes at least three plans', () => {
      expect(TRAINING_PLANS.length).toBeGreaterThanOrEqual(3);
    });

    it('every plan has localised title and summary', () => {
      // `$localize` falls back to the source string in the unit-test
      // environment (no translations loaded), so assert non-empty.
      for (const plan of TRAINING_PLANS) {
        expect(plan.title).toBeTruthy();
        expect(plan.summary).toBeTruthy();
      }
    });

    it('every plan day has a non-empty localised description', () => {
      for (const plan of TRAINING_PLANS) {
        for (const day of plan.days) {
          expect(day.description).toBeTruthy();
        }
      }
    });

    it('every plan has contiguous day indexes 1..totalDays', () => {
      for (const plan of TRAINING_PLANS) {
        const indexes = plan.days.map((d) => d.dayIndex);
        const expected = Array.from(
          { length: plan.totalDays },
          (_, i) => i + 1
        );
        expect(indexes).toEqual(expected);
      }
    });

    it('every plan has unique day indexes (no duplicates)', () => {
      for (const plan of TRAINING_PLANS) {
        const indexes = plan.days.map((d) => d.dayIndex);
        expect(new Set(indexes).size).toBe(indexes.length);
      }
    });

    it('rest days have targetReps === 0', () => {
      for (const plan of TRAINING_PLANS) {
        for (const day of plan.days) {
          if (day.kind === 'rest') {
            expect(day.targetReps).toBe(0);
          }
        }
      }
    });

    it('main-day sets sum to targetReps when sets are defined', () => {
      for (const plan of TRAINING_PLANS) {
        for (const day of plan.days) {
          if (day.sets && day.kind !== 'test') {
            const sum = day.sets.reduce((a, b) => a + b, 0);
            expect(sum).toBe(day.targetReps);
          }
        }
      }
    });

    it('findPlanById returns the matching plan', () => {
      expect(findPlanById('challenge-30d-v1')?.totalDays).toBe(30);
      expect(findPlanById('does-not-exist')).toBeNull();
    });

    it('should reference only catalog exercises or the pushup sentinel', () => {
      // given — binds plans to the exercise SSOT: any day naming an exercise
      // must name a real catalog entry. 'pushup' is the legacy-collection
      // sentinel (no catalog entry by design).
      for (const plan of TRAINING_PLANS) {
        for (const day of plan.days) {
          // when
          const id = trainingPlanDayExerciseId(day);
          // then
          if (id === 'pushup') continue;
          expect(findExerciseDefinition(id)).not.toBeNull();
        }
      }
    });

    it('should ship only pushup days the store can log idempotently today', () => {
      // given — logPlanDay reasons about reps through LiveDataStore, which is
      // pushup-only, so a non-pushup plan day would be silently skipped;
      // guard against shipping one the store can't honor.
      // when / then
      for (const plan of TRAINING_PLANS) {
        for (const day of plan.days) {
          expect(trainingPlanDayExerciseId(day)).toBe('pushup');
        }
      }
    });
  });

  describe('trainingPlanDayExerciseId', () => {
    it('should default to the pushup sentinel when a day names no exercise', () => {
      // given
      const day = { exerciseId: undefined };
      // when
      const resolved = trainingPlanDayExerciseId(day);
      // then
      expect(resolved).toBe('pushup');
    });

    it('should pass through an explicit catalog exercise id', () => {
      // given
      const day = { exerciseId: 'legs.squats' };
      // when
      const resolved = trainingPlanDayExerciseId(day);
      // then
      expect(resolved).toBe('legs.squats');
    });
  });
});
