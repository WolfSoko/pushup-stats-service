import {
  PLAN_DAY_MILESTONES,
  deriveAchievements,
  findAchievementDefinition,
  planCompletedAchievementId,
} from './achievement.models';

describe('deriveAchievements', () => {
  describe('Given cumulative plan days', () => {
    it('should award nothing before the first milestone', () => {
      // when
      const ids = deriveAchievements({
        completedPlanDays: 0,
        completedPlanIds: [],
      });

      // then
      expect(ids).toEqual([]);
    });

    it('should award every milestone at or below the day count', () => {
      // when
      const ids = deriveAchievements({
        completedPlanDays: 25,
        completedPlanIds: [],
      });

      // then
      expect(ids).toEqual(['plan-days-1', 'plan-days-10', 'plan-days-25']);
    });

    it('should not award a milestone one day short', () => {
      // when
      const ids = deriveAchievements({
        completedPlanDays: 24,
        completedPlanIds: [],
      });

      // then
      expect(ids).not.toContain('plan-days-25');
    });
  });

  describe('Given finished plans', () => {
    it('should award one badge per plan', () => {
      // when
      const ids = deriveAchievements({
        completedPlanDays: 0,
        completedPlanIds: ['core-4w', 'challenge-30d'],
      });

      // then
      expect(ids).toEqual([
        'plan-completed-challenge-30d',
        'plan-completed-core-4w',
      ]);
    });

    it('should be order-stable regardless of input order', () => {
      // given
      const a = deriveAchievements({
        completedPlanDays: 5,
        completedPlanIds: ['core-4w', 'challenge-30d'],
      });

      // when
      const b = deriveAchievements({
        completedPlanDays: 5,
        completedPlanIds: ['challenge-30d', 'core-4w'],
      });

      // then — the trigger diffs this against stored ids, so an unstable
      // order would churn writes on every plan update
      expect(a).toEqual(b);
    });
  });

  it('should expose the entitlement, not a delta', () => {
    // given — a user who dropped from 25 to 24 days (day un-marked)
    // when
    const ids = deriveAchievements({
      completedPlanDays: 24,
      completedPlanIds: [],
    });

    // then — the caller only ever adds, so the already-awarded
    // `plan-days-25` stays untouched rather than being revoked
    expect(ids).toEqual(['plan-days-1', 'plan-days-10']);
  });
});

describe('findAchievementDefinition', () => {
  it.each(PLAN_DAY_MILESTONES.map((m) => [`plan-days-${m}`]))(
    'should resolve the milestone badge %s',
    (id) => {
      // then
      expect(findAchievementDefinition(id)).toEqual(
        expect.objectContaining({ id, kind: 'plan-days' })
      );
    }
  );

  it('should resolve a plan-completed badge back to its plan id', () => {
    // given
    const id = planCompletedAchievementId('full-body-6w');

    // when
    const definition = findAchievementDefinition(id);

    // then
    expect(definition).toEqual(
      expect.objectContaining({
        kind: 'plan-completed',
        planId: 'full-body-6w',
      })
    );
  });

  it('should return null for an id the catalog no longer knows', () => {
    // given — a badge earned under an older catalog must not break the
    // profile page
    // when
    const definition = findAchievementDefinition('plan-days-7');

    // then
    expect(definition).toBeNull();
  });
});
