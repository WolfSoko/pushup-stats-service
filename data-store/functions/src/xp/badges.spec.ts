import { describe, expect, it } from '@jest/globals';

import { newXpBadges } from './badges';

describe('newXpBadges', () => {
  it('should return only badges not earned yet', () => {
    // when
    const ids = newXpBadges({ level: 11, byExercise: {} }, [
      { id: 'level-5', awardedAt: '2026-01-01T00:00:00Z' },
    ]);

    // then
    expect(ids).toEqual(['level-10']);
  });
});
