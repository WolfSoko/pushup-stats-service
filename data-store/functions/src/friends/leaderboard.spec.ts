import { describe, expect, it } from '@jest/globals';

import {
  countDistinctDays,
  isFriendsBoardMetric,
  isFriendsLeaderboardPeriod,
  metricValue,
  participates,
  periodStartIso,
  periodValue,
  rankFriends,
  streakValue,
  xpStatsOf,
  type FriendStatsRow,
} from './leaderboard';

const KEYS = {
  dailyKey: '2026-09-10',
  weeklyKey: '2026-W37',
  monthlyKey: '2026-09',
};

function row(over: Partial<FriendStatsRow> = {}): FriendStatsRow {
  return {
    uid: 'a',
    displayName: 'Ada',
    stats: {
      total: 5000,
      dailyReps: 40,
      dailyKey: KEYS.dailyKey,
      weeklyReps: 300,
      weeklyKey: KEYS.weeklyKey,
      monthlyReps: 1200,
      monthlyKey: KEYS.monthlyKey,
    },
    ui: { publicProfile: true },
    isViewer: false,
    ...over,
  };
}

describe('friends/leaderboard', () => {
  describe('metricValue', () => {
    const rooted = row({
      stats: {
        total: 5000,
        totalDays: 42,
        currentStreak: 6,
        lastEntryDate: KEYS.dailyKey,
        dailyReps: 40,
        dailyKey: KEYS.dailyKey,
      },
      days: 3,
    });

    it('should count training days from the entries for a week or month', () => {
      // when / then
      expect(metricValue(rooted, 'days', 'week', KEYS)).toBe(3);
      expect(metricValue(rooted, 'days', 'month', KEYS)).toBe(3);
    });

    it('should take all-time days from the aggregate and today as 0 or 1', () => {
      // when / then
      expect(metricValue(rooted, 'days', 'allTime', KEYS)).toBe(42);
      expect(metricValue(rooted, 'days', 'daily', KEYS)).toBe(1);
      expect(
        metricValue(row({ stats: { dailyReps: 0 } }), 'days', 'daily', KEYS)
      ).toBe(0);
    });

    it('should only count a streak that is still alive', () => {
      // when / then — today or yesterday keeps it, older breaks it
      expect(streakValue(rooted, KEYS.dailyKey)).toBe(6);
      expect(
        streakValue(
          row({ stats: { currentStreak: 6, lastEntryDate: '2026-09-09' } }),
          KEYS.dailyKey
        )
      ).toBe(6);
      expect(
        streakValue(
          row({ stats: { currentStreak: 6, lastEntryDate: '2026-09-08' } }),
          KEYS.dailyKey
        )
      ).toBe(0);
      expect(metricValue(rooted, 'streak', 'month', KEYS)).toBe(6);
    });

    it('should still read reps per period', () => {
      // when / then
      expect(metricValue(row(), 'reps', 'week', KEYS)).toBe(300);
    });

    it('should recognise the metrics it knows', () => {
      // when / then
      expect(isFriendsBoardMetric('days')).toBe(true);
      expect(isFriendsBoardMetric('streak')).toBe(true);
      expect(isFriendsBoardMetric('reps')).toBe(true);
      expect(isFriendsBoardMetric('points')).toBe(false);
    });
  });

  describe('periodStartIso', () => {
    it('should start the week on Monday and the month on the 1st', () => {
      // when / then — 2026-09-10 is a Thursday
      expect(periodStartIso('week', '2026-09-10')).toBe('2026-09-07');
      expect(periodStartIso('week', '2026-09-07')).toBe('2026-09-07');
      expect(periodStartIso('week', '2026-09-13')).toBe('2026-09-07');
      expect(periodStartIso('month', '2026-09-10')).toBe('2026-09-01');
    });
  });

  describe('countDistinctDays', () => {
    it('should count each day once and only inside the window', () => {
      // when / then
      expect(
        countDistinctDays(
          [
            '2026-09-06',
            '2026-09-07',
            '2026-09-07',
            '2026-09-09',
            '2026-09-11',
          ],
          '2026-09-07',
          '2026-09-10'
        )
      ).toBe(2);
    });
  });

  describe('periodValue', () => {
    it('should read the bucket the period asks for', () => {
      // when / then
      expect(periodValue(row(), 'daily', KEYS)).toBe(40);
      expect(periodValue(row(), 'week', KEYS)).toBe(300);
      expect(periodValue(row(), 'month', KEYS)).toBe(1200);
      expect(periodValue(row(), 'allTime', KEYS)).toBe(5000);
    });

    it('should count a rolled-over bucket as zero', () => {
      // given yesterday's daily bucket
      const stale = row({
        stats: { ...row().stats, dailyKey: '2026-09-09' },
      });

      // when / then — the value belongs to a day that is over
      expect(periodValue(stale, 'daily', KEYS)).toBe(0);
      expect(periodValue(stale, 'allTime', KEYS)).toBe(5000);
    });

    it('should treat a missing aggregate as zero', () => {
      // when / then
      expect(periodValue(row({ stats: null }), 'week', KEYS)).toBe(0);
    });
  });

  describe('participates', () => {
    it('should include a friend who shows their total to friends', () => {
      // when / then
      expect(
        participates(row({ ui: { profileVisibility: { total: 'friends' } } }))
      ).toBe(true);
      expect(participates(row({ ui: { publicProfile: true } }))).toBe(true);
    });

    it('should leave out a friend who switched their total off', () => {
      // when / then
      expect(
        participates(row({ ui: { profileVisibility: { total: 'off' } } }))
      ).toBe(false);
    });

    it('should always include the viewer', () => {
      // given — a board without the person reading it is missing its point
      const hiddenViewer = row({
        isViewer: true,
        ui: { profileVisibility: { total: 'off' } },
      });

      // when / then
      expect(participates(hiddenViewer)).toBe(true);
    });

    it('should include a legacy private profile, whose default is friends', () => {
      // when / then
      expect(participates(row({ ui: { publicProfile: false } }))).toBe(true);
    });
  });

  describe('rankFriends', () => {
    it('should sort highest first', () => {
      // given
      const rows = [
        row({
          uid: 'a',
          displayName: 'Ada',
          stats: { ...row().stats, weeklyReps: 100 },
        }),
        row({
          uid: 'b',
          displayName: 'Bob',
          stats: { ...row().stats, weeklyReps: 900 },
        }),
      ];

      // when
      const board = rankFriends(rows, 'week', KEYS);

      // then
      expect(board.map((e) => e.uid)).toEqual(['b', 'a']);
    });

    it('should break ties by name so the order does not wobble', () => {
      // given
      const rows = [
        row({ uid: 'b', displayName: 'Bob', stats: null }),
        row({ uid: 'a', displayName: 'Ada', stats: null }),
      ];

      // when / then
      expect(rankFriends(rows, 'week', KEYS).map((e) => e.displayName)).toEqual(
        ['Ada', 'Bob']
      );
    });

    it('should keep participants at zero on the board', () => {
      // given — the zero is the nudge
      const rows = [row({ stats: null })];

      // when
      const board = rankFriends(rows, 'daily', KEYS);

      // then
      expect(board).toEqual([
        {
          uid: 'a',
          displayName: 'Ada',
          value: 0,
          isViewer: false,
          cheers: 0,
          cheered: false,
        },
      ]);
    });

    it('should carry today’s cheers onto each row', () => {
      // given — Ada got two cheers, and the viewer already cheered Bob
      const rows = [row({ uid: 'a' }), row({ uid: 'b', displayName: 'Bob' })];
      const cheers = {
        received: new Map([['a', 2]]),
        cheeredByViewer: new Set(['b']),
      };

      // when
      const board = rankFriends(rows, 'week', KEYS, cheers);

      // then
      expect(board.map((e) => [e.uid, e.cheers, e.cheered])).toEqual([
        ['a', 2, false],
        ['b', 0, true],
      ]);
    });

    it('should drop a friend who is not participating', () => {
      // given
      const rows = [
        row({ uid: 'a' }),
        row({ uid: 'b', ui: { profileVisibility: { total: 'off' } } }),
      ];

      // when / then
      expect(rankFriends(rows, 'week', KEYS).map((e) => e.uid)).toEqual(['a']);
    });
  });

  describe('isFriendsLeaderboardPeriod', () => {
    it('should accept the four periods and nothing else', () => {
      // when / then
      expect(isFriendsLeaderboardPeriod('daily')).toBe(true);
      expect(isFriendsLeaderboardPeriod('allTime')).toBe(true);
      expect(isFriendsLeaderboardPeriod('yearly')).toBe(false);
      expect(isFriendsLeaderboardPeriod(undefined)).toBe(false);
    });
  });

  it('should rank by the metric asked for', () => {
    // given — Ada trained more days, Bob did more reps
    const ada = row({ uid: 'a', displayName: 'Ada', days: 5 });
    const bob = row({
      uid: 'b',
      displayName: 'Bob',
      days: 2,
      stats: { weeklyReps: 900, weeklyKey: KEYS.weeklyKey },
    });

    // when / then
    expect(
      rankFriends([bob, ada], 'week', KEYS, undefined, 'days').map((e) => e.uid)
    ).toEqual(['a', 'b']);
    expect(
      rankFriends([bob, ada], 'week', KEYS, undefined, 'reps').map((e) => e.uid)
    ).toEqual(['b', 'a']);
  });
});

describe('XP metric', () => {
  it('should accept xp as a board metric', () => {
    // then
    expect(isFriendsBoardMetric('xp')).toBe(true);
  });

  it('should rank the period bucket of the XP aggregate', () => {
    // given
    const stats = xpStatsOf({
      total: 900,
      dailyXp: 50,
      dailyKey: KEYS.dailyKey,
      weeklyXp: 250,
      weeklyKey: KEYS.weeklyKey,
      monthlyXp: 600,
      monthlyKey: '2026-08',
    });

    // when
    const value = (period: 'daily' | 'week' | 'month' | 'allTime') =>
      metricValue(row({ stats }), 'xp', period, KEYS);

    // then
    expect(value('daily')).toBe(50);
    expect(value('week')).toBe(250);
    expect(value('month')).toBe(0);
    expect(value('allTime')).toBe(900);
  });

  it('should map a missing XP aggregate to no stats', () => {
    // then
    expect(xpStatsOf(undefined)).toBeNull();
  });
});
