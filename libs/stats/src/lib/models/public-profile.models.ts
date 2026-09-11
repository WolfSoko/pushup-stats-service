import type { ProfileSection } from './profile-sections';
import type { ProfileSectionVisibility } from './profile-visibility.models';

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
  /**
   * Total reps across all time. `null` when the owner switched this
   * element off — the server omits it rather than relying on the client
   * to hide it, so a hidden value never reaches a visitor at all.
   */
  readonly total: number | null;
  /** Total number of recorded entries; `null` when switched off. */
  readonly totalEntries: number | null;
  /** Unique days with at least one entry; `null` when switched off. */
  readonly totalDays: number | null;
  /** Current consecutive-day streak; `null` when switched off. */
  readonly currentStreak: number | null;
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
  /**
   * Reps in the current Berlin week/month; 0 when the bucket is stale,
   * `null` when the element is switched off.
   */
  readonly weeklyReps: number | null;
  readonly monthlyReps: number | null;
  /** Cumulative reps per `<weekday>-<HH>` slot. */
  readonly heatmap: Readonly<Record<string, number>>;
  /** Top exercises by volume. */
  readonly exercises: ReadonlyArray<PublicProfileExercise>;
  /** The last handful of workouts, newest first. */
  readonly recent: ReadonlyArray<PublicProfileEntry>;
  /**
   * True only when the viewer is the owner and has not opted in yet. The
   * page keeps showing the content and adds a hint; nobody else ever
   * receives a private profile.
   */
  readonly isPrivate: boolean;
  /** True when the viewer owns this profile; drives the inline switches. */
  readonly viewerIsOwner: boolean;
  /**
   * Elements the owner switched off. Empty for visitors — naming them
   * would give away what the switch is there to withhold.
   */
  readonly hidden: ReadonlyArray<ProfileSection>;
  /**
   * Per-section audience (`off` / `friends` / `public`). Owner-only, same
   * reason as {@link hidden}; `{}` for everyone else.
   */
  readonly visibility: Partial<
    Record<ProfileSection, ProfileSectionVisibility>
  >;
  /** True when the viewer is a confirmed friend of this profile's owner. */
  readonly viewerIsFriend: boolean;
  /** ISO timestamp of the last stats update. */
  readonly updatedAt: string;
}

/**
 * One logged workout, as far as a profile visitor may see it: what was
 * trained, how much, and when. No id, no note, no source — those belong
 * to the owner's history.
 */
export interface PublicProfileEntry {
  readonly exerciseId: string;
  readonly value: number;
  readonly measurement: ProfileMeasurement;
  /** ISO timestamp of the entry. */
  readonly timestamp: string;
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
  readonly measurement: ProfileMeasurement;
}

export type ProfileMeasurement =
  'reps' | 'time' | 'distance' | 'weight' | 'distance-time';
