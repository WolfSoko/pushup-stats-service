/**
 * Server-side precomputed user statistics.
 *
 * Stored in `userStats/{userId}` — updated atomically by Cloud Functions
 * on every pushup create/update/delete via delta calculations.
 */

/** Heatmap slot key: weekday + hour bucket, e.g. "Mo-08", "Fr-14" */
export type HeatmapSlot = string;

/**
 * Current version of UserStats calculation logic.
 * Increment this when changing rebuildFromEntries, applyDelta, or period key logic.
 *
 * Changelog:
 * - v1: Initial version (legacy, before versioning)
 * - v2: Fixed period keys to use TODAY (not last entry date) in rebuildFromEntries
 */
export const USERSTATS_VERSION = 2;

export interface UserStats {
  /** Firestore owner */
  userId: string;

  // ── Aggregates ──────────────────────────────────────────────────────
  /** Total reps across all time */
  total: number;
  /** Total number of entries across all time */
  totalEntries: number;
  /** Total number of unique days with at least one entry */
  totalDays: number;

  /** Reps for the current day (key: YYYY-MM-DD) */
  dailyReps: number;
  dailyKey: string;

  /** Reps for the current ISO week (key: YYYY-Www) */
  weeklyReps: number;
  weeklyKey: string;

  /** Reps for the current month (key: YYYY-MM) */
  monthlyReps: number;
  monthlyKey: string;

  // ── Streaks ─────────────────────────────────────────────────────────
  /** Current consecutive-day streak */
  currentStreak: number;
  /** ISO date of the last entry (YYYY-MM-DD), used for streak calculation */
  lastEntryDate: string | null;

  // ── Heatmap ─────────────────────────────────────────────────────────
  /** Cumulative reps per weekday+hour slot, e.g. { "Mo-08": 120, "Fr-14": 45 } */
  heatmap: Record<HeatmapSlot, number>;

  // ── Performance ─────────────────────────────────────────────────────
  /** Best single day: { date, total } */
  bestDay: { date: string; total: number } | null;
  /** Best single entry (highest reps in one record) */
  bestSingleEntry: { reps: number; timestamp: string } | null;

  // ── Metadata ────────────────────────────────────────────────────────
  /** Version of the calculation logic (used to detect when rebuild is needed) */
  version?: number;
  updatedAt: string;
}

/** The empty/initial state for a brand-new user. */
export function emptyUserStats(userId: string): UserStats {
  return {
    userId,
    total: 0,
    totalEntries: 0,
    totalDays: 0,
    dailyReps: 0,
    dailyKey: '',
    weeklyReps: 0,
    weeklyKey: '',
    monthlyReps: 0,
    monthlyKey: '',
    currentStreak: 0,
    lastEntryDate: null,
    heatmap: {},
    bestDay: null,
    bestSingleEntry: null,
    version: USERSTATS_VERSION,
    updatedAt: new Date().toISOString(),
  };
}
