import {
  resolveAchievementBadge,
  resolveAchievementBadges,
} from './achievement-badge';

describe('resolveAchievementBadge', () => {
  it('should label a plan-day milestone', () => {
    // when
    const badge = resolveAchievementBadge('plan-days-10');

    // then — the test locale is the German source locale
    expect(badge?.label).toBe('10 Plantage');
    expect(badge?.icon.length).toBeGreaterThan(0);
  });

  it('should label the first plan day in the singular', () => {
    // when / then
    expect(resolveAchievementBadge('plan-days-1')?.label).toBe(
      'Erster Plantag'
    );
  });

  it('should label a finished plan without naming it', () => {
    // when / then — naming the plan would pull the whole catalog into the
    // anonymous profile route
    expect(resolveAchievementBadge('plan-completed-recruit-6w-v1')?.label).toBe(
      'Trainingsplan abgeschlossen'
    );
  });

  it('should label an invite badge as invites, not plan days', () => {
    // given a badge earned by inviting three friends
    const badge = resolveAchievementBadge('invites-3');

    // then
    expect(badge?.label).toBe('3 Freunde eingeladen');
    expect(badge?.label).not.toContain('Plantage');
  });

  it('should name the first invite in the singular', () => {
    // when / then
    expect(resolveAchievementBadge('invites-1')?.label).toBe(
      'Ersten Freund eingeladen'
    );
  });

  it('should skip ids no catalog knows rather than break the page', () => {
    // when / then
    expect(resolveAchievementBadge('invites-7')).toBeNull();
    expect(resolveAchievementBadge('nonsense')).toBeNull();
    expect(resolveAchievementBadges(['plan-days-1', 'nonsense'])).toHaveLength(
      1
    );
  });
});
