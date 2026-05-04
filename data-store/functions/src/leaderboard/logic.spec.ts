import { describe, it, expect } from '@jest/globals';
import {
  rankEntries,
  calculateCurrentPeriodKeys,
  getLeaderboardQueryStartDate,
  isoDateNDaysBefore,
  filterOutDemoUser,
  PushupRow,
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
        [
          'user1',
          {
            displayName: 'Alice',
            ui: { hideFromLeaderboard: false, publicProfile: true },
          },
        ],
        [
          'user2',
          {
            displayName: 'Bob',
            ui: { hideFromLeaderboard: false, publicProfile: true },
          },
        ],
      ]);

      const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ alias: 'Bob', reps: 20, uid: 'user2' });
      expect(result[1]).toEqual({ alias: 'Alice', reps: 15, uid: 'user1' });
    });

    it('sorts entries by reps descending', () => {
      const rows: PushupRow[] = [
        { userId: 'user3', timestamp: '2024-03-15T10:00:00Z', reps: 5 },
        { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 30 },
        { userId: 'user2', timestamp: '2024-03-15T10:00:00Z', reps: 15 },
      ];
      const profiles = new Map<string, UserProfile>([
        [
          'user1',
          {
            displayName: 'Alice',
            ui: { hideFromLeaderboard: false, publicProfile: true },
          },
        ],
        [
          'user2',
          {
            displayName: 'Bob',
            ui: { hideFromLeaderboard: false, publicProfile: true },
          },
        ],
        [
          'user3',
          {
            displayName: 'Charlie',
            ui: { hideFromLeaderboard: false, publicProfile: true },
          },
        ],
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
        [
          'user1',
          {
            displayName: 'Alice',
            ui: { hideFromLeaderboard: false, publicProfile: true },
          },
        ],
      ]);

      const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ alias: 'Alice', reps: 10, uid: 'user1' });
    });

    it('drops users who opted out of the leaderboard', () => {
      const rows: PushupRow[] = [
        { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 10 },
        { userId: 'user2', timestamp: '2024-03-15T10:00:00Z', reps: 20 },
      ];
      const profiles = new Map<string, UserProfile>([
        [
          'user1',
          {
            displayName: 'Alice',
            ui: { hideFromLeaderboard: false, publicProfile: true },
          },
        ],
        ['user2', { displayName: 'Bob', ui: { hideFromLeaderboard: true } }],
      ]);

      const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ alias: 'Alice', reps: 10, uid: 'user1' });
    });

    it('drops users without an explicit publicProfile opt-in', () => {
      // `hideFromLeaderboard` undefined defaults to hidden — no more
      // `anonym` fallback row.
      const rows: PushupRow[] = [
        { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 10 },
      ];
      const profiles = new Map<string, UserProfile>([
        ['user1', { displayName: 'Alice' }],
      ]);

      const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

      expect(result).toEqual([]);
    });

    describe('public-profile gate', () => {
      it('only includes users with full publicProfile opt-in; every row carries a uid', () => {
        const rows: PushupRow[] = [
          { userId: 'optedIn', timestamp: '2024-03-15T10:00:00Z', reps: 30 },
          { userId: 'leaderOnly', timestamp: '2024-03-15T10:00:00Z', reps: 20 },
          {
            userId: 'profileOnly',
            timestamp: '2024-03-15T10:00:00Z',
            reps: 10,
          },
        ];
        const profiles = new Map<string, UserProfile>([
          [
            'optedIn',
            {
              displayName: 'Alice',
              ui: { hideFromLeaderboard: false, publicProfile: true },
            },
          ],
          [
            // Leaderboard toggle on, but no public profile → dropped.
            'leaderOnly',
            {
              displayName: 'Bob',
              ui: { hideFromLeaderboard: false, publicProfile: false },
            },
          ],
          [
            // Public profile but leaderboard hidden → dropped.
            'profileOnly',
            {
              displayName: 'Carol',
              ui: { hideFromLeaderboard: true, publicProfile: true },
            },
          ],
        ]);

        const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

        expect(result).toEqual([{ alias: 'Alice', reps: 30, uid: 'optedIn' }]);
      });

      it('drops users with empty/whitespace displayName even when both opt-ins are on', () => {
        // No display name → no row. The leaderboard never falls back to
        // an anonymous alias.
        const rows: PushupRow[] = [
          { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 10 },
          { userId: 'user2', timestamp: '2024-03-15T10:00:00Z', reps: 20 },
        ];
        const profiles = new Map<string, UserProfile>([
          [
            'user1',
            {
              displayName: '',
              ui: { hideFromLeaderboard: false, publicProfile: true },
            },
          ],
          [
            'user2',
            {
              displayName: '   ',
              ui: { hideFromLeaderboard: false, publicProfile: true },
            },
          ],
        ]);

        const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

        expect(result).toEqual([]);
      });
    });

    describe('daily cap', () => {
      it('caps a single-day total at 2000 reps for the daily leaderboard', () => {
        const rows: PushupRow[] = [
          { userId: 'cheater', timestamp: '2024-03-15T08:00:00Z', reps: 500 },
          { userId: 'cheater', timestamp: '2024-03-15T10:00:00Z', reps: 500 },
          { userId: 'cheater', timestamp: '2024-03-15T12:00:00Z', reps: 500 },
          { userId: 'cheater', timestamp: '2024-03-15T14:00:00Z', reps: 500 },
          { userId: 'cheater', timestamp: '2024-03-15T16:00:00Z', reps: 500 },
        ];
        const profiles = new Map<string, UserProfile>([
          [
            'cheater',
            {
              displayName: 'Mallory',
              ui: { hideFromLeaderboard: false, publicProfile: true },
            },
          ],
        ]);

        const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

        expect(result).toHaveLength(1);
        expect(result[0].reps).toBe(2000);
      });

      it('caps each Berlin day independently in last7 windows', () => {
        // 7 days × 3000 reps = 21000 raw, but each day caps at 2000
        // → 14000 visible.
        const rows: PushupRow[] = [];
        for (let day = 9; day <= 15; day++) {
          const iso = `2024-03-${String(day).padStart(2, '0')}T10:00:00Z`;
          rows.push({ userId: 'cheater', timestamp: iso, reps: 1500 });
          rows.push({ userId: 'cheater', timestamp: iso, reps: 1500 });
        }
        const profiles = new Map<string, UserProfile>([
          [
            'cheater',
            {
              displayName: 'Mallory',
              ui: { hideFromLeaderboard: false, publicProfile: true },
            },
          ],
        ]);

        const result = rankEntries(rows, 'last7', '2024-03-15', profiles);

        expect(result).toHaveLength(1);
        expect(result[0].reps).toBe(14000);
      });

      it('does not affect users below the daily cap', () => {
        const rows: PushupRow[] = [
          { userId: 'honest', timestamp: '2024-03-15T08:00:00Z', reps: 50 },
          { userId: 'honest', timestamp: '2024-03-15T18:00:00Z', reps: 50 },
        ];
        const profiles = new Map<string, UserProfile>([
          [
            'honest',
            {
              displayName: 'Alice',
              ui: { hideFromLeaderboard: false, publicProfile: true },
            },
          ],
        ]);

        const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

        expect(result[0].reps).toBe(100);
      });
    });

    describe('admin shadow-ban', () => {
      it('excludes users flagged with leaderboardExcluded=true even with both opt-ins', () => {
        const rows: PushupRow[] = [
          { userId: 'good', timestamp: '2024-03-15T10:00:00Z', reps: 30 },
          { userId: 'cheater', timestamp: '2024-03-15T10:00:00Z', reps: 999 },
        ];
        const profiles = new Map<string, UserProfile>([
          [
            'good',
            {
              displayName: 'Alice',
              ui: { hideFromLeaderboard: false, publicProfile: true },
            },
          ],
          [
            'cheater',
            {
              displayName: 'Mallory',
              ui: { hideFromLeaderboard: false, publicProfile: true },
              leaderboardExcluded: true,
            },
          ],
        ]);

        const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

        expect(result).toEqual([{ alias: 'Alice', reps: 30, uid: 'good' }]);
      });

      it('does not affect users where the flag is unset or false', () => {
        const rows: PushupRow[] = [
          { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 10 },
          { userId: 'user2', timestamp: '2024-03-15T10:00:00Z', reps: 20 },
        ];
        const profiles = new Map<string, UserProfile>([
          [
            'user1',
            {
              displayName: 'Alice',
              ui: { hideFromLeaderboard: false, publicProfile: true },
              leaderboardExcluded: false,
            },
          ],
          [
            'user2',
            {
              displayName: 'Bob',
              ui: { hideFromLeaderboard: false, publicProfile: true },
            },
          ],
        ]);

        const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

        expect(result).toHaveLength(2);
      });
    });

    it('drops users without profiles entirely', () => {
      const rows: PushupRow[] = [
        { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 10 },
      ];
      const profiles = new Map<string, UserProfile>(); // Empty

      const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

      expect(result).toEqual([]);
    });

    it('limits results to TOP_N', () => {
      const rows: PushupRow[] = Array.from({ length: 20 }, (_, i) => ({
        userId: `user${i}`,
        timestamp: '2024-03-15T10:00:00Z',
        reps: 20 - i,
      }));
      const profiles = new Map<string, UserProfile>();
      rows.forEach((_, i) => {
        profiles.set(`user${i}`, {
          displayName: `User${i}`,
          ui: { hideFromLeaderboard: false, publicProfile: true },
        });
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
        [
          'user1',
          {
            displayName: 'Alice',
            ui: { hideFromLeaderboard: false, publicProfile: true },
          },
        ],
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
        [
          'user1',
          {
            displayName: 'Alice',
            ui: { hideFromLeaderboard: false, publicProfile: true },
          },
        ],
        [
          'user2',
          {
            displayName: 'Bob',
            ui: { hideFromLeaderboard: false, publicProfile: true },
          },
        ],
      ]);

      const result = rankEntries(rows, 'daily', '2024-03-15', profiles);

      expect(result).toHaveLength(1);
      expect(result[0].alias).toBe('Bob');
    });

    it('aggregates the trailing 7-day window inclusive of both endpoints', () => {
      // Given — today is 2024-03-15. The trailing 7-day window covers
      // 2024-03-09 (start) through 2024-03-15 (today), inclusive.
      const rows: PushupRow[] = [
        { userId: 'user1', timestamp: '2024-03-09T10:00:00Z', reps: 4 }, // included (start)
        { userId: 'user1', timestamp: '2024-03-15T10:00:00Z', reps: 6 }, // included (today)
        { userId: 'user1', timestamp: '2024-03-08T10:00:00Z', reps: 99 }, // excluded (8 days back)
        { userId: 'user1', timestamp: '2024-03-16T10:00:00Z', reps: 99 }, // excluded (future)
      ];
      const profiles = new Map<string, UserProfile>([
        [
          'user1',
          {
            displayName: 'Alice',
            ui: { hideFromLeaderboard: false, publicProfile: true },
          },
        ],
      ]);

      // When
      const result = rankEntries(rows, 'last7', '2024-03-15', profiles);

      // Then — only the two in-window rows are summed.
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ alias: 'Alice', reps: 10, uid: 'user1' });
    });

    it('aggregates the trailing 30-day window inclusive of both endpoints', () => {
      // Given — today is 2024-03-30. Window is 2024-03-01 .. 2024-03-30 (30 days).
      const rows: PushupRow[] = [
        { userId: 'user1', timestamp: '2024-03-01T10:00:00Z', reps: 5 },
        { userId: 'user1', timestamp: '2024-03-30T10:00:00Z', reps: 7 },
        { userId: 'user1', timestamp: '2024-02-29T10:00:00Z', reps: 99 }, // excluded (31 days back)
      ];
      const profiles = new Map<string, UserProfile>([
        [
          'user1',
          {
            displayName: 'Alice',
            ui: { hideFromLeaderboard: false, publicProfile: true },
          },
        ],
      ]);

      // When
      const result = rankEntries(rows, 'last30', '2024-03-30', profiles);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ alias: 'Alice', reps: 12, uid: 'user1' });
    });
  });

  describe('calculateCurrentPeriodKeys', () => {
    it('returns todays ISO date for all three buckets', () => {
      const now = new Date('2024-03-15T10:00:00Z');
      const keys = calculateCurrentPeriodKeys(now);

      expect(keys.daily).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(keys.last7).toBe(keys.daily);
      expect(keys.last30).toBe(keys.daily);
    });

    it('uses current date when not provided', () => {
      const keys = calculateCurrentPeriodKeys();

      expect(keys.daily).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(keys.last7).toBe(keys.daily);
      expect(keys.last30).toBe(keys.daily);
    });
  });

  describe('isoDateNDaysBefore', () => {
    it('returns the same date for daysBack = 0', () => {
      const result = isoDateNDaysBefore(
        { year: 2024, month: 3, day: 15, isoDate: '2024-03-15' },
        0
      );
      expect(result).toBe('2024-03-15');
    });

    it('walks across month boundaries', () => {
      const result = isoDateNDaysBefore(
        { year: 2024, month: 3, day: 1, isoDate: '2024-03-01' },
        1
      );
      expect(result).toBe('2024-02-29'); // 2024 is a leap year
    });

    it('walks across year boundaries', () => {
      const result = isoDateNDaysBefore(
        { year: 2024, month: 1, day: 1, isoDate: '2024-01-01' },
        1
      );
      expect(result).toBe('2023-12-31');
    });
  });

  describe('getLeaderboardQueryStartDate', () => {
    it('returns the date 30 days before today, one day buffer beyond the last30 window for TZ slack', () => {
      // Given — today is the 30th of March in Berlin.
      const today: BerlinDateParts = {
        year: 2024,
        month: 3,
        day: 30,
        isoDate: '2024-03-30',
      };

      // When
      const result = getLeaderboardQueryStartDate(today);

      // Then — bound is the 29th of February (one day earlier than the 30-day
      // window's first day) so the Firestore query also catches rows whose
      // UTC timestamp falls on the previous calendar day relative to Berlin.
      expect(result).toBe('2024-02-29');
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
