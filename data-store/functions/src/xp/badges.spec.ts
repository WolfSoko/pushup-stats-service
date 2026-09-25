import { describe, expect, it } from '@jest/globals';
import { xpForLevel } from '@pu-stats/models';

import { newXpBadges, xpBadgesMayChange } from './badges';

describe('newXpBadges', () => {
  it('should return only badges not earned yet', () => {
    // when
    const ids = newXpBadges({ total: xpForLevel(11), byExercise: {} }, [
      { id: 'level-5', awardedAt: '2026-01-01T00:00:00Z' },
    ]);

    // then
    expect(ids).toEqual(['level-10']);
  });
});

describe('xpBadgesMayChange', () => {
  const base = { total: 150, byExercise: { pushup: 150 } };

  it('should check after a rebuild without a previous state', () => {
    // then
    expect(xpBadgesMayChange(null, base)).toBe(true);
  });

  it('should check on a level-up', () => {
    // then
    expect(xpBadgesMayChange(base, { ...base, total: 300 })).toBe(true);
  });

  it('should check when XP lands on a new exercise', () => {
    // then
    expect(
      xpBadgesMayChange(base, {
        total: 160,
        byExercise: { pushup: 150, 'pull.pullups': 10 },
      })
    ).toBe(true);
  });

  it('should skip when neither the level nor the exercises changed', () => {
    // then
    expect(
      xpBadgesMayChange(base, { total: 180, byExercise: { pushup: 180 } })
    ).toBe(false);
  });
});
