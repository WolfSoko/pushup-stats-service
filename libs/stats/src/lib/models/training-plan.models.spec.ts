import {
  currentPlanDayIndex,
  isPlanCompleted,
  localizePlan,
  planDayByIndex,
  TrainingPlan,
} from './training-plan.models';
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
      titleEn: '',
      summary: '',
      summaryEn: '',
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
      titleEn: '',
      summary: '',
      summaryEn: '',
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
  });

  describe('localizePlan', () => {
    const plan: TrainingPlan = {
      id: 'x',
      slug: 'x',
      title: 'Deutscher Titel',
      titleEn: 'English title',
      summary: 'Deutsche Beschreibung',
      summaryEn: 'English summary',
      level: 'beginner',
      totalDays: 1,
      days: [
        {
          dayIndex: 1,
          kind: 'main',
          targetReps: 10,
          description: 'Deutsch',
          descriptionEn: 'English',
        },
      ],
    };

    it('returns English fields when locale starts with "en"', () => {
      const out = localizePlan(plan, 'en');
      expect(out.title).toBe('English title');
      expect(out.summary).toBe('English summary');
      expect(out.days[0].description).toBe('English');
    });

    it('returns German fields for the source locale "de"', () => {
      const out = localizePlan(plan, 'de');
      expect(out.title).toBe('Deutscher Titel');
      expect(out.days[0].description).toBe('Deutsch');
    });

    it('handles "en-US" the same as "en"', () => {
      expect(localizePlan(plan, 'en-US').title).toBe('English title');
    });

    it('falls back to German description when descriptionEn is missing', () => {
      const noEnDay: TrainingPlan = {
        ...plan,
        days: [
          {
            dayIndex: 1,
            kind: 'main',
            targetReps: 10,
            description: 'Nur Deutsch',
          },
        ],
      };
      expect(localizePlan(noEnDay, 'en').days[0].description).toBe(
        'Nur Deutsch'
      );
    });
  });

  describe('catalog', () => {
    it('exposes at least three plans', () => {
      expect(TRAINING_PLANS.length).toBeGreaterThanOrEqual(3);
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
  });
});
