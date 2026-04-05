import { describe, it, expect } from '@jest/globals';
import {
  rankEntries,
  calculateCurrentPeriodKeys,
  getMonthStartForQuery,
  filterOutDemoUser,
  PushupRow,
  LeaderboardEntry,
} from './logic';
import { UserProfile } from '../profile';

describe('leaderboard/logic', () => {
  describe('rankEntries', () => {
    it('aggregates reps by user for a specific period', () => {
      const rows: PushupRow[] = [
        { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 10 },
        { userId: 'user1', timestamp: '2024-03-15T20:00:00Z', reps: 5 },
        { userId: 'user2', timestamp: '2024-03-15T15:00:00Z', reps: 20 },
      ];
      const profiles = new Map<string, UserProfile>([
        ['user1', { displayName: 'Alice' }],
        ['user2', { displayName: 'Bob' }],
      ]);

      const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ alias: 'Bob', reps: 20 });
      expect(result[1]).toEqual({ alias: 'Alice', reps: 15 });
    });

    it('sorts entries by reps descending', () => {
      const rows: PushupRow[] = [
        { userId: 'user3', timestamp: '2024-03-15T10:00:00Z', reps: 5 },
        { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 30 },
        { userId: 'user2', timestamp: '2024-03-15T10:00:00Z', reps: 15 },
      ];
      const profiles = new Map<string, UserProfile>([
        ['user1', { displayName: 'Alice' }],
        ['user2', { displayName: 'Bob' }],
        ['user3', { displayName: 'Charlie' }],
      ]);

      const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

      expect(result[0].reps).toBe(30);
      expect(result[1].reps).toBe(15);
      expect(result[2].reps).toBe(5);
    });

    it('filters entries by period key', () => {
      const rows: PushupRow[] = [
        { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 10 },
        { userId: 'user1', timestamp: '2024-03-16T10:00:00Z', reps: 20 }, // Different day
      ];
      const profiles = new Map<string, UserProfile>([
        ['user1', { displayName: 'Alice' }],
      ]);

      const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ alias: 'Alice', reps: 10 });
    });

    it('respects leaderboard privacy setting', () => {
      const rows: PushupRow[] = [
        { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 10 },
        { userId: 'user2', timestamp: '2024-03-15T10:00:00Z', reps: 20 },
      ];
      const profiles = new Map<string, UserProfile>([
        ['user1', { displayName: 'Alice', ui: { hideFromLeaderboard: false } }],
        ['user2', { displayName: 'Bob', ui: { hideFromLeaderboard: true } }], // Hidden
      ]);

      const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

      expect(result[0]).toEqual({ alias: 'anonym', reps: 20 });
      expect(result[1]).toEqual({ alias: 'Alice', reps: 10 });
    });

    it('uses anonymous label for users without profiles', () => {
      const rows: PushupRow[] = [
        { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 10 },
      ];
      const profiles = new Map<string, UserProfile>(); // Empty

      const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

      expect(result[0]).toEqual({ alias: 'anonym', reps: 10 });
    });

    it('limits results to TOP_N', () => {
      const rows: PushupRow[] = Array.from({ length: 20 }, (_, i) => ({
        userId: `user${i}`,
        timestamp: '2024-03-15T10:00:00Z',
        reps: 20 - i,
      }));
      const profiles = new Map<string, UserProfile>();
      rows.forEach((_, i) => {
        profiles.set(`user${i}`, { displayName: `User${i}` });
      });

      const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('ignores entries without userId', () => {
      const rows: PushupRow[] = [
        { userId: undefined, timestamp: '2024-03-15T10:00:00Z', reps: 10 },
        { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 20 },
      ];
      const profiles = new Map<string, UserProfile>([
        ['user1', { displayName: 'Alice' }],
      ]);

      const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

      expect(result).toHaveLength(1);
      expect(result[0].alias).toBe('Alice');
    });

    it('ignores entries without timestamp', () => {
      const rows: PushupRow[] = [
        { userId: 'user1', timestamp: undefined, reps: 10 },
        { userId: 'user2', timestamp: '2024-03-15T10:00:00Z', reps: 20 },
      ];
      const profiles = new Map<string, UserProfile>([
        ['user1', { displayName: 'Alice' }],
        ['user2', { displayName: 'Bob' }],
      ]);

      const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

      expect(result).toHaveLength(1);
      expect(result[0].alias).toBe('Bob');
    });

    it('handles weekly period aggregation', () => {
      const rows: PushupRow[] = [
        { userId: 'user1', timestamp: '2024-03-11T10:00:00Z', reps: 10 }, // Monday of week 11
        { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 5 }, // Friday of week 11
      ];
      const profiles = new Map<string, UserProfile>([
        ['user1', { displayName: 'Alice' }],
      ]);

      const result = rankEntries(rows, 'weekly', '2024-W11', profiles);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ alias: 'Alice', reps: 15 });
    });

    it('handles monthly period aggregation', () => {
      const rows: PushupRow[] = [
        { userId: 'user1', timestamp: '2024-03-01T10:00:00Z', reps: 10 },
        { userId: 'user1', timestamp: '2024-03-31T10:00:00Z', reps: 5 },
      ];
      const profiles = new Map<string, UserProfile>([
        ['user1', { displayName: 'Alice' }],
      ]);

      const result = rankEntries(rows, 'monthly', '2024-03', profiles);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ alias: 'Alice', reps: 15 });
    });
  });

  describe('calculateCurrentPeriodKeys', () => {
    it('returns period keys for current date', () => {
      const now = new Date('2024-03-15T10:00:00Z');
      const keys = calculateCurrentPeriodKeys(now);

      expect(keys.daily).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(keys.weekly).toMatch(/^\d{4}-W\d{2}$/);
      expect(keys.monthly).toMatch(/^\d{4}-\d{2}$/);
    });

    it('uses current date when not provided', () => {
      const keys = calculateCurrentPeriodKeys();

      expect(keys.daily).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(keys.weekly).toMatch(/^\d{4}-W\d{2}$/);
      expect(keys.monthly).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('getMonthStartForQuery', () => {
    it('returns first day of month in ISO format', () => {
      const result = getMonthStartForQuery({
        year: 2024,
        month: 3,
        day: 15,
        isoDate: '2024-03-15',
      });

      expect(result).toBe('2024-03-01');
    });

    it('pads month with zero', () => {
      const result = getMonthStartForQuery({
        year: 2024,
        month: 1,
        day: 15,
        isoDate: '2024-01-15',
      });

      expect(result).toBe('2024-01-01');
    });
  });

  describe('filterOutDemoUser', () => {
    it('removes demo user from rows', () => {
      const rows: PushupRow[] = [
        { userId: 'demo-user', timestamp: '2024-03-15T10:00:00Z', reps: 10 },
        { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 20 },
      ];

      const result = filterOutDemoUser(rows, 'demo-user');

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user1');
    });

    it('preserves other rows', () => {
      const rows: PushupRow[] = [
        { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 10 },
        { userId: 'user2', timestamp: '2024-03-15T10:00:00Z', reps: 20 },
      ];

      const result = filterOutDemoUser(rows, 'demo-user');

      expect(result).toHaveLength(2);
    });
  });
});
