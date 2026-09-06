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
  /**
   * Ids of earned achievements, newest first. Ids only — labels and
   * icons come from the local catalog, and the award timestamps stay
   * server-side because when a badge was earned reveals activity
   * patterns the profile does not publish.
   */
  readonly achievements: ReadonlyArray<string>;
  /** Profile picture (Google account photo), null when none is set. */
  readonly photoURL: string | null;
  /** ISO date the account was created, null when unknown. */
  readonly memberSince: string | null;
  /** Reps in the current Berlin week/month; 0 when the bucket is stale. */
  readonly weeklyReps: number;
  readonly monthlyReps: number;
  /** Cumulative reps per `<weekday>-<HH>` slot. */
  readonly heatmap: Readonly<Record<string, number>>;
  /** Top exercises by volume. */
  readonly exercises: ReadonlyArray<PublicProfileExercise>;
  /**
   * True only when the viewer is the owner and has not opted in yet. The
   * page keeps showing the content and adds a hint; nobody else ever
   * receives a private profile.
   */
  readonly isPrivate: boolean;
  /** ISO timestamp of the last stats update. */
  readonly updatedAt: string;
}

export interface PublicProfileExercise {
  readonly exerciseId: string;
  readonly total: number;
  readonly totalDays: number;
  /**
   * The stored total is not unit-homogeneous — reps, seconds or metres
   * depending on the exercise — so the client groups and formats by this
   * instead of summing across entries.
   */
  readonly measurement:
    'reps' | 'time' | 'distance' | 'weight' | 'distance-time';
}
