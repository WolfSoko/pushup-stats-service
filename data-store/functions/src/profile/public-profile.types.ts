import {
  type MeasurementType,
  type ProfileSection,
  type ProfileSectionVisibility,
  type PublicProfileWorkout,
  type PublicProfileXp,
  type TrainingSummary,
} from '@pu-stats/models';

import { type UserProfile } from './logic';

/** Subset of `UserConfig` this projection actually reads. */
export interface UserConfigForPublicProfile extends UserProfile {
  ui?: {
    publicProfile?: boolean;
    hideFromLeaderboard?: boolean;
    hideAccountPhoto?: boolean;
    /** Ids from `PROFILE_SECTIONS` the owner switched off. */
    profileHidden?: unknown;
    /** Level per section, keyed by `PROFILE_SECTIONS`. */
    profileVisibility?: Readonly<Record<string, string>>;
  };
  createdAt?: string;
  /** Set by the client after a photo upload; drives the photo URL. */
  photoUpdatedAt?: string;
}

/** What the projection takes from the training aggregate besides the numbers. */
export interface UserStatsForPublicProfile {
  /** XP of every exercise per `<weekday>-<HH>` slot, zero slots pruned. */
  heatmap?: Record<string, number>;
  updatedAt?: string;
}

/** Subset of `userXp/{uid}` this projection reads. */
export interface UserXpForPublicProfile {
  total?: unknown;
  weeklyXp?: unknown;
  weeklyKey?: unknown;
  monthlyXp?: unknown;
  monthlyKey?: unknown;
}

/** Where the owner stands in their training plan. */
export interface PlanProgress {
  planId: string;
  dayIndex: number;
  totalDays: number;
  paused: boolean;
}

/** One logged workout, as a profile visitor may see it. */
export interface RecentEntry {
  exerciseId: string;
  /** Reps, seconds or metres — see {@link ExerciseTotal.measurement}. */
  value: number;
  measurement: MeasurementType;
  timestamp: string;
}

/** One entry of the per-exercise breakdown. */
export interface ExerciseTotal {
  exerciseId: string;
  total: number;
  totalDays: number;
  /**
   * Carried per entry because the stored `total` is not unit-homogeneous:
   * it holds reps, seconds or metres depending on the exercise. Summing
   * across measurements would be meaningless, so the client formats and
   * groups by this instead.
   */
  measurement: MeasurementType;
}

/** Shape of `userAchievements/{uid}` as far as the profile cares. */
export interface UserAchievementsForPublicProfile {
  earned?: Array<{ id?: unknown; awardedAt?: unknown }>;
}

export interface PublicProfileProjection {
  uid: string;
  displayName: string;
  /**
   * Stats the owner switched off are `null` here rather than merely
   * hidden by the client: the projection travels over the wire, so a
   * value that is only hidden in the template is still public.
   */
  total: number | null;
  totalDurationSec: number | null;
  totalDistanceM: number | null;
  totalEntries: number | null;
  totalDays: number | null;
  currentStreak: number | null;
  bestEntryXp: number | null;
  bestDayXp: number | null;
  xp: PublicProfileXp | null;
  /**
   * Ids of achievements the user has earned, newest first. Ids only —
   * the label and icon come from the client-side catalog, so renaming a
   * badge never requires a data migration.
   */
  achievements: string[];
  /** Google/Firebase Auth photo, or an uploaded one once that exists. */
  photoURL: string | null;
  /** ISO date the account was created, null when unknown. */
  memberSince: string | null;
  /** XP of every exercise per `<weekday>-<HH>` slot. */
  heatmap: Record<string, number>;
  /** Top exercises by volume, grouped and formatted by the client. */
  exercises: ExerciseTotal[];
  /** The last few workouts, newest first. Empty when not visible. */
  recent: RecentEntry[];
  /** The running training plan, `null` when there is none or it is hidden. */
  plan: PlanProgress | null;
  /** Workouts the owner put on their profile. Empty when not visible. */
  workouts: PublicProfileWorkout[];
  /**
   * True only when the projection is handed to its own owner despite the
   * profile being private. Never true for a third party — the callable
   * returns `not-found` in that case, unchanged.
   */
  isPrivate: boolean;
  /**
   * True when the projection goes to the profile's own owner. Drives the
   * inline visibility switches; a third party always gets `false`.
   */
  viewerIsOwner: boolean;
  /**
   * Elements the owner switched off. Only ever populated for the owner —
   * telling a visitor *what* is hidden would leak the very thing the
   * switch is there to hide.
   */
  hidden: ProfileSection[];
  /**
   * Per-section audience (`off` / `friends` / `public`), owner-only for the
   * same reason as {@link hidden}. Empty for everyone else.
   */
  visibility: Partial<Record<ProfileSection, ProfileSectionVisibility>>;
  /** True when the viewer is a confirmed friend of this profile's owner. */
  viewerIsFriend: boolean;
  /** A friend already cheered the owner today; always `false` for anyone else. */
  viewerCheeredToday: boolean;
  updatedAt: string;
}

/**
 * Build the public projection. Returns `null` when the requested user has
 * not opted in — callers MUST surface this as `not-found` to anonymous
 * callers so existence of a private user can't be probed.
 */
export interface PublicProfileExtras {
  /** Lifetime numbers across all exercises, from the owner's entries. */
  readonly summary?: TrainingSummary | null;
  readonly xp?: UserXpForPublicProfile | null;
  readonly achievements?: UserAchievementsForPublicProfile | null;
  readonly photoURL?: string | null;
  readonly exercises?: ReadonlyArray<ExerciseTotal>;
  readonly recent?: ReadonlyArray<RecentEntry>;
  readonly plan?: PlanProgress | null;
  readonly workouts?: ReadonlyArray<PublicProfileWorkout>;
  /** Berlin period keys for "now", used to reject stale buckets. */
  readonly currentWeeklyKey?: string;
  readonly currentMonthlyKey?: string;
  /**
   * Set only when the caller proved they own this uid. It is the single
   * bypass of the opt-in gate and must never be derived from request data.
   */
  readonly viewerIsOwner?: boolean;
  /**
   * Set only when a confirmed friendship was read from Firestore. Like
   * `viewerIsOwner`, it opens data the public gate would refuse, so it
   * must never be derived from request data.
   */
  readonly viewerIsFriend?: boolean;
  /** Read alongside the friendship; ignored unless the viewer is a friend. */
  readonly viewerCheeredToday?: boolean;
}
