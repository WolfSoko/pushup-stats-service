/**
 * Sanitized projection of a user's stats for the public profile route.
 *
 * Only fields safe to expose to anonymous visitors live here. Anything that
 * touches privacy (email, goals, reminder config, raw entries, leaderboard
 * opt-in) MUST stay behind owner-only Firestore rules and never leak into
 * this shape.
 */
export interface PublicProfile {
  /** Firebase UID — used as the canonical permalink slug `/u/:uid`. */
  readonly uid: string;
  /** Public display name (anonymous fallback when none was set). */
  readonly displayName: string;
  /** Total reps across all time. */
  readonly total: number;
  /** Total number of recorded entries. */
  readonly totalEntries: number;
  /** Total number of unique days with at least one entry. */
  readonly totalDays: number;
  /** Current consecutive-day streak. */
  readonly currentStreak: number;
  /** Best single-entry rep count (null until any entries exist). */
  readonly bestSingleEntry: number | null;
  /** Best single-day total reps (null until any entries exist). */
  readonly bestDayTotal: number | null;
  /** ISO timestamp of the last stats update. */
  readonly updatedAt: string;
}
