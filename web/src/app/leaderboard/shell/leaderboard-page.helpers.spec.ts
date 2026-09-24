import {
  LEADERBOARD_PUSHUP_ID,
  LEADERBOARD_XP_ID,
} from '@pu-stats/data-access';
import {
  buildPopularExercises,
  formatLeaderboardValue,
  leaderboardLabel,
} from './leaderboard-page.helpers';

describe('leaderboard page helpers', () => {
  it('should lead the chip row with XP, then pushups', () => {
    // when
    const ids = buildPopularExercises().map((c) => c.id);

    // then
    expect(ids.slice(0, 2)).toEqual([LEADERBOARD_XP_ID, LEADERBOARD_PUSHUP_ID]);
    expect(ids).toContain('cardio.running');
  });

  it('should label the XP sentinel', () => {
    // then
    expect(leaderboardLabel(LEADERBOARD_XP_ID)).toBe('Gesamt-XP');
  });

  it('should format XP with thousands grouping', () => {
    // then
    expect(formatLeaderboardValue(1234, LEADERBOARD_XP_ID, 'de')).toBe(
      '1.234 XP'
    );
  });

  it('should keep empty slots unitless', () => {
    // then
    expect(formatLeaderboardValue(0, LEADERBOARD_XP_ID, 'de')).toBe('0');
  });

  it('should keep reps and time formatting for exercises', () => {
    // then
    expect(formatLeaderboardValue(25, LEADERBOARD_PUSHUP_ID, 'de')).toBe(
      '25 Reps'
    );
    expect(formatLeaderboardValue(90, 'plank.standard', 'de')).toBe('1:30');
  });
});
