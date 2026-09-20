import { INVITE_MILESTONES, PLAN_DAY_MILESTONES } from '@pu-stats/models';

import { buildAchievementCollection } from './achievement-collection';

const EMPTY = { earned: [], planDayTotal: 0, invitedCount: 0 };

describe('buildAchievementCollection', () => {
  it('should list every catalog badge, locked ones included', () => {
    // when
    const view = buildAchievementCollection(EMPTY);

    // then
    expect(view.totalCount).toBeGreaterThan(
      PLAN_DAY_MILESTONES.length + INVITE_MILESTONES.length
    );
    expect(view.earnedCount).toBe(0);
    expect(view.groups.flatMap((g) => g.tiles)).toHaveLength(view.totalCount);
  });

  it('should group badges by kind in a stable order', () => {
    // when
    const view = buildAchievementCollection(EMPTY);

    // then
    expect(view.groups.map((g) => g.kind)).toEqual([
      'plan-days',
      'plan-completed',
      'invites',
    ]);
  });

  it('should mark an earned badge with the date it was awarded', () => {
    // given
    const awardedAt = '2026-09-01T10:00:00.000Z';

    // when
    const view = buildAchievementCollection({
      ...EMPTY,
      earned: [{ id: 'plan-days-1', awardedAt }],
      planDayTotal: 1,
    });

    // then
    const tile = view.groups
      .flatMap((g) => g.tiles)
      .find((t) => t.id === 'plan-days-1');
    expect(tile?.earnedAt).toBe(awardedAt);
    expect(view.earnedCount).toBe(1);
  });

  it('should point at the nearest locked milestone with its progress', () => {
    // given 9 plan days: the 10-day badge is one away, the 25-day one is not
    // when
    const view = buildAchievementCollection({
      ...EMPTY,
      earned: [{ id: 'plan-days-1', awardedAt: '2026-09-01T10:00:00.000Z' }],
      planDayTotal: 9,
    });

    // then
    expect(view.next?.id).toBe('plan-days-10');
    expect(view.next?.progress).toEqual({ current: 9, target: 10 });
  });

  it('should carry the progress onto the tile inside its group, not only on next', () => {
    // when
    const view = buildAchievementCollection({ ...EMPTY, planDayTotal: 9 });

    // then
    const tile = view.groups
      .flatMap((g) => g.tiles)
      .find((t) => t.id === 'plan-days-10');
    expect(tile?.progress).toEqual({ current: 9, target: 10 });
  });

  it('should skip milestones already reached when choosing the next one', () => {
    // given every counter sits exactly on a milestone the document has not
    // caught up with yet — those badges are due, not upcoming
    // when
    const view = buildAchievementCollection({
      ...EMPTY,
      planDayTotal: 10,
      invitedCount: Math.max(...INVITE_MILESTONES),
    });

    // then the next badge is the nearest one still out of reach
    expect(view.next?.id).toBe('plan-days-25');
  });

  it('should prefer an invite badge when it is closer than the next plan milestone', () => {
    // given 2 invites (1 away from 3) and 20 plan days (5 away from 25)
    // when
    const view = buildAchievementCollection({
      ...EMPTY,
      planDayTotal: 20,
      invitedCount: 2,
    });

    // then
    expect(view.next?.id).toBe('invites-3');
    expect(view.next?.progress).toEqual({ current: 2, target: 3 });
  });

  it('should have no next badge once every counted milestone is reached', () => {
    // when
    const view = buildAchievementCollection({
      ...EMPTY,
      planDayTotal: Math.max(...PLAN_DAY_MILESTONES),
      invitedCount: Math.max(...INVITE_MILESTONES),
    });

    // then — plan completions remain locked but carry no distance to show
    expect(view.next).toBeNull();
  });
});
