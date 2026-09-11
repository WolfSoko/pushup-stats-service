import { describe, expect, it } from '@jest/globals';

import {
  isFriendsLeaderboardPeriod,
  participates,
  periodValue,
  rankFriends,
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
        { uid: 'a', displayName: 'Ada', value: 0, isViewer: false },
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
});
