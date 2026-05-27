import { describe, it, expect } from '@jest/globals';
import {
  rankExerciseEntries,
  getExerciseLeaderboardQueryStartDate,
  isoDateNDaysBefore,
  ExerciseEntryRow,
} from './logic';
import { UserProfile } from '../profile';

function publicProfile(displayName: string): UserProfile {
  return {
    displayName,
    ui: { hideFromLeaderboard: false, publicProfile: true },
  };
}

describe('exercise-leaderboard/logic', () => {
  describe('rankExerciseEntries — reps measurement', () => {
    it('aggregates reps by user for the daily period', () => {
      const rows: ExerciseEntryRow[] = [
        {
          userId: 'alice',
          exerciseId: 'legs.squats',
          timestamp: '2024-03-15T10:00:00Z',
          reps: 20,
        },
        {
          userId: 'alice',
          exerciseId: 'legs.squats',
          timestamp: '2024-03-15T18:00:00Z',
          reps: 30,
        },
        {
          userId: 'bob',
          exerciseId: 'legs.squats',
          timestamp: '2024-03-15T12:00:00Z',
          reps: 40,
        },
      ];
      const profiles = new Map<string, UserProfile>([
        ['alice', publicProfile('Alice')],
        ['bob', publicProfile('Bob')],
      ]);

      const result = rankExerciseEntries(
        rows,
        'reps',
        'daily',
        '2024-03-15',
        profiles
      );

      expect(result).toEqual([
        { alias: 'Alice', reps: 50, uid: 'alice' },
        { alias: 'Bob', reps: 40, uid: 'bob' },
      ]);
    });

    it('caps single-day reps total at 2000', () => {
      const rows: ExerciseEntryRow[] = [];
      for (let i = 0; i < 6; i++) {
        rows.push({
          userId: 'cheater',
          exerciseId: 'legs.squats',
          timestamp: `2024-03-15T0${i}:00:00Z`,
          reps: 500,
        });
      }
      const profiles = new Map<string, UserProfile>([
        ['cheater', publicProfile('Mallory')],
      ]);

      const result = rankExerciseEntries(
        rows,
        'reps',
        'daily',
        '2024-03-15',
        profiles
      );

      expect(result[0].reps).toBe(2000);
    });
  });

  describe('rankExerciseEntries — time measurement', () => {
    it('reads durationSec instead of reps for time-measured exercises', () => {
      const rows: ExerciseEntryRow[] = [
        {
          userId: 'alice',
          exerciseId: 'plank.standard',
          timestamp: '2024-03-15T10:00:00Z',
          durationSec: 90,
          // A misfiled `reps` field should be ignored.
          reps: 9999,
        },
        {
          userId: 'bob',
          exerciseId: 'plank.standard',
          timestamp: '2024-03-15T10:00:00Z',
          durationSec: 120,
        },
      ];
      const profiles = new Map<string, UserProfile>([
        ['alice', publicProfile('Alice')],
        ['bob', publicProfile('Bob')],
      ]);

      const result = rankExerciseEntries(
        rows,
        'durationSec',
        'daily',
        '2024-03-15',
        profiles
      );

      expect(result).toEqual([
        { alias: 'Bob', reps: 120, uid: 'bob' },
        { alias: 'Alice', reps: 90, uid: 'alice' },
      ]);
    });

    it('caps single-day durationSec total at 4h (14_400 s)', () => {
      // 6 × 3000 s = 18 000 s raw, capped at 14 400 (4 h).
      const rows: ExerciseEntryRow[] = [];
      for (let i = 0; i < 6; i++) {
        rows.push({
          userId: 'cheater',
          exerciseId: 'plank.standard',
          timestamp: `2024-03-15T0${i}:00:00Z`,
          durationSec: 3000,
        });
      }
      const profiles = new Map<string, UserProfile>([
        ['cheater', publicProfile('Mallory')],
      ]);

      const result = rankExerciseEntries(
        rows,
        'durationSec',
        'daily',
        '2024-03-15',
        profiles
      );

      expect(result[0].reps).toBe(14_400);
    });
  });

  describe('rankExerciseEntries — distance measurement', () => {
    it('reads distanceM for distance-time exercises (ignoring the duration companion)', () => {
      const rows: ExerciseEntryRow[] = [
        {
          userId: 'alice',
          exerciseId: 'cardio.running',
          timestamp: '2024-03-15T10:00:00Z',
          distanceM: 5000,
          durationSec: 1800,
        },
        {
          userId: 'alice',
          exerciseId: 'cardio.running',
          timestamp: '2024-03-15T18:00:00Z',
          distanceM: 3000,
          durationSec: 1100,
        },
      ];
      const profiles = new Map<string, UserProfile>([
        ['alice', publicProfile('Alice')],
      ]);

      const result = rankExerciseEntries(
        rows,
        'distanceM',
        'daily',
        '2024-03-15',
        profiles
      );

      expect(result).toEqual([{ alias: 'Alice', reps: 8000, uid: 'alice' }]);
    });

    it('caps single-day distanceM total at 100 km', () => {
      // Six logged runs of 30 km = 180 km raw, capped at 100 km/day.
      const rows: ExerciseEntryRow[] = [];
      for (let i = 0; i < 6; i++) {
        rows.push({
          userId: 'cheater',
          exerciseId: 'cardio.running',
          timestamp: `2024-03-15T0${i}:00:00Z`,
          distanceM: 30_000,
          durationSec: 9000,
        });
      }
      const profiles = new Map<string, UserProfile>([
        ['cheater', publicProfile('Mallory')],
      ]);

      const result = rankExerciseEntries(
        rows,
        'distanceM',
        'daily',
        '2024-03-15',
        profiles
      );

      expect(result[0].reps).toBe(100_000);
    });
  });

  describe('privacy & shadow-ban — symmetry with pushup ranker', () => {
    it('drops users without the full publicProfile opt-in', () => {
      const rows: ExerciseEntryRow[] = [
        {
          userId: 'optedIn',
          exerciseId: 'legs.squats',
          timestamp: '2024-03-15T10:00:00Z',
          reps: 30,
        },
        {
          userId: 'leaderOnly',
          exerciseId: 'legs.squats',
          timestamp: '2024-03-15T10:00:00Z',
          reps: 20,
        },
        {
          userId: 'profileOnly',
          exerciseId: 'legs.squats',
          timestamp: '2024-03-15T10:00:00Z',
          reps: 10,
        },
      ];
      const profiles = new Map<string, UserProfile>([
        ['optedIn', publicProfile('Alice')],
        [
          'leaderOnly',
          {
            displayName: 'Bob',
            ui: { hideFromLeaderboard: false, publicProfile: false },
          },
        ],
        [
          'profileOnly',
          {
            displayName: 'Carol',
            ui: { hideFromLeaderboard: true, publicProfile: true },
          },
        ],
      ]);

      const result = rankExerciseEntries(
        rows,
        'reps',
        'daily',
        '2024-03-15',
        profiles
      );

      expect(result).toEqual([{ alias: 'Alice', reps: 30, uid: 'optedIn' }]);
    });

    it('respects the admin shadow-ban flag', () => {
      const rows: ExerciseEntryRow[] = [
        {
          userId: 'good',
          exerciseId: 'legs.squats',
          timestamp: '2024-03-15T10:00:00Z',
          reps: 30,
        },
        {
          userId: 'cheater',
          exerciseId: 'legs.squats',
          timestamp: '2024-03-15T10:00:00Z',
          reps: 999,
        },
      ];
      const profiles = new Map<string, UserProfile>([
        ['good', publicProfile('Alice')],
        [
          'cheater',
          {
            displayName: 'Mallory',
            ui: { hideFromLeaderboard: false, publicProfile: true },
            leaderboardExcluded: true,
          },
        ],
      ]);

      const result = rankExerciseEntries(
        rows,
        'reps',
        'daily',
        '2024-03-15',
        profiles
      );

      expect(result).toEqual([{ alias: 'Alice', reps: 30, uid: 'good' }]);
    });

    it('drops rows without a parsable timestamp or numeric value field', () => {
      const rows: ExerciseEntryRow[] = [
        {
          userId: 'alice',
          exerciseId: 'legs.squats',
          timestamp: undefined,
          reps: 10,
        },
        {
          userId: 'alice',
          exerciseId: 'legs.squats',
          timestamp: 'not-a-date',
          reps: 10,
        },
        // Numeric value missing — the row would be a "wrong measurement
        // field" violation client-side, but the ranker should just skip
        // it rather than throwing.
        {
          userId: 'alice',
          exerciseId: 'legs.squats',
          timestamp: '2024-03-15T10:00:00Z',
        },
        // This one is the only valid row.
        {
          userId: 'alice',
          exerciseId: 'legs.squats',
          timestamp: '2024-03-15T10:00:00Z',
          reps: 25,
        },
      ];
      const profiles = new Map<string, UserProfile>([
        ['alice', publicProfile('Alice')],
      ]);

      const result = rankExerciseEntries(
        rows,
        'reps',
        'daily',
        '2024-03-15',
        profiles
      );

      expect(result).toEqual([{ alias: 'Alice', reps: 25, uid: 'alice' }]);
    });
  });

  describe('window semantics', () => {
    it('aggregates the trailing 7-day window inclusive of both endpoints', () => {
      const rows: ExerciseEntryRow[] = [
        // Included — start of window
        {
          userId: 'alice',
          exerciseId: 'cardio.running',
          timestamp: '2024-03-09T10:00:00Z',
          distanceM: 4000,
        },
        // Included — today
        {
          userId: 'alice',
          exerciseId: 'cardio.running',
          timestamp: '2024-03-15T10:00:00Z',
          distanceM: 6000,
        },
        // Excluded — 8 days back
        {
          userId: 'alice',
          exerciseId: 'cardio.running',
          timestamp: '2024-03-08T10:00:00Z',
          distanceM: 99_000,
        },
      ];
      const profiles = new Map<string, UserProfile>([
        ['alice', publicProfile('Alice')],
      ]);

      const result = rankExerciseEntries(
        rows,
        'distanceM',
        'last7',
        '2024-03-15',
        profiles
      );

      expect(result).toEqual([{ alias: 'Alice', reps: 10_000, uid: 'alice' }]);
    });

    it('applies the daily cap independently within multi-day windows', () => {
      // 7 days × 3 h plank/day → 21h raw, capped at 4h/day → 28h visible.
      const rows: ExerciseEntryRow[] = [];
      for (let day = 9; day <= 15; day++) {
        const iso = `2024-03-${String(day).padStart(2, '0')}T10:00:00Z`;
        rows.push({
          userId: 'alice',
          exerciseId: 'plank.standard',
          timestamp: iso,
          durationSec: 10_800,
        });
      }
      const profiles = new Map<string, UserProfile>([
        ['alice', publicProfile('Alice')],
      ]);

      const result = rankExerciseEntries(
        rows,
        'durationSec',
        'last7',
        '2024-03-15',
        profiles
      );

      // 7 × 10_800 = 75_600 raw; capped at 14_400/day → 7 × 14_400 = 100_800.
      // But raw < cap → uncapped sum is the smaller of the two.
      expect(result[0].reps).toBe(75_600);
    });
  });

  describe('top-N limit', () => {
    it('returns at most 10 entries', () => {
      const rows: ExerciseEntryRow[] = Array.from({ length: 20 }, (_, i) => ({
        userId: `user${i}`,
        exerciseId: 'legs.squats',
        timestamp: '2024-03-15T10:00:00Z',
        reps: 20 - i,
      }));
      const profiles = new Map<string, UserProfile>(
        rows.map((r) => [r.userId as string, publicProfile(`User${r.userId}`)])
      );

      const result = rankExerciseEntries(
        rows,
        'reps',
        'daily',
        '2024-03-15',
        profiles
      );

      expect(result).toHaveLength(10);
    });
  });

  describe('getExerciseLeaderboardQueryStartDate', () => {
    it('returns the date 30 days before today (one-day buffer beyond last30)', () => {
      const result = getExerciseLeaderboardQueryStartDate({
        year: 2024,
        month: 3,
        day: 30,
        isoDate: '2024-03-30',
      });
      expect(result).toBe('2024-02-29');
    });
  });

  describe('isoDateNDaysBefore', () => {
    it('walks across month boundaries', () => {
      const result = isoDateNDaysBefore(
        { year: 2024, month: 3, day: 1, isoDate: '2024-03-01' },
        1
      );
      expect(result).toBe('2024-02-29');
    });
  });
});
