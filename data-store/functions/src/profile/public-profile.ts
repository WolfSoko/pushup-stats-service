/**
 * Pure logic for projecting a user's private stats + config into the
 * sanitized {@link PublicProfileProjection} shape returned by the
 * `getPublicProfile` Cloud Function.
 *
 * Kept Firebase-free so it can be unit-tested without an emulator and so
 * the projection rules stay in one auditable place — every leak risk
 * (email, goals, reminder config, raw entries) is whitelisted by absence.
 */

import type { MeasurementType } from '@pu-stats/models';

import { toPublicDisplayName, type UserProfile } from './logic';

/** Subset of `UserConfig` this projection actually reads. */
export interface UserConfigForPublicProfile extends UserProfile {
  ui?: { publicProfile?: boolean; hideFromLeaderboard?: boolean };
  createdAt?: string;
  /** Set by the client after a photo upload; drives the photo URL. */
  photoUpdatedAt?: string;
}

/** Subset of `UserStats` this projection actually reads. */
export interface UserStatsForPublicProfile {
  total?: number;
  totalEntries?: number;
  totalDays?: number;
  currentStreak?: number;
  bestSingleEntry?: { reps: number; timestamp: string } | null;
  bestDay?: { date: string; total: number } | null;
  /**
   * Period buckets carry the key they were written for. Reading the
   * value without checking the key would present last week's number as
   * "this week" for anyone who has not trained since.
   */
  weeklyReps?: number;
  weeklyKey?: string;
  monthlyReps?: number;
  monthlyKey?: string;
  /** Cumulative reps per `<weekday>-<HH>` slot, zero slots pruned. */
  heatmap?: Record<string, number>;
  updatedAt?: string;
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
  total: number;
  totalEntries: number;
  totalDays: number;
  currentStreak: number;
  bestSingleEntry: number | null;
  bestDayTotal: number | null;
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
  /** Reps in the *current* Berlin week/month; 0 when the bucket is stale. */
  weeklyReps: number;
  monthlyReps: number;
  /** Cumulative reps per `<weekday>-<HH>` slot. */
  heatmap: Record<string, number>;
  /** Top exercises by volume, grouped and formatted by the client. */
  exercises: ExerciseTotal[];
  /**
   * True only when the projection is handed to its own owner despite the
   * profile being private. Never true for a third party — the callable
   * returns `not-found` in that case, unchanged.
   */
  isPrivate: boolean;
  updatedAt: string;
}

/**
 * Returns true iff the user has explicitly opted in to a public profile.
 * Defaults to private — undefined / missing fields = false.
 */
export function isPublicProfileAllowed(
  config: UserConfigForPublicProfile | undefined | null
): boolean {
  return config?.ui?.publicProfile === true;
}

/**
 * Validates a Firebase UID input. The Auth API allows UIDs of 1-128
 * characters; the Admin SDK accepts arbitrary strings, but in practice every
 * shipped UID we see is URL-safe (A-Z, a-z, 0-9, `_`, `-`).
 *
 * We restrict the charset rather than the length so projects with custom
 * short UIDs (e.g. test fixtures) still work, while a malformed slug like a
 * path traversal (`..`) or a slash never reaches Firestore.
 */
export function isValidUid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

/**
 * Build the public projection. Returns `null` when the requested user has
 * not opted in — callers MUST surface this as `not-found` to anonymous
 * callers so existence of a private user can't be probed.
 */
export interface PublicProfileExtras {
  readonly achievements?: UserAchievementsForPublicProfile | null;
  readonly photoURL?: string | null;
  readonly exercises?: ReadonlyArray<ExerciseTotal>;
  /** Berlin period keys for "now", used to reject stale buckets. */
  readonly currentWeeklyKey?: string;
  readonly currentMonthlyKey?: string;
  /**
   * Set only when the caller proved they own this uid. It is the single
   * bypass of the opt-in gate and must never be derived from request data.
   */
  readonly viewerIsOwner?: boolean;
}

export function buildPublicProfile(
  uid: string,
  config: UserConfigForPublicProfile | null,
  stats: UserStatsForPublicProfile | null,
  extras: PublicProfileExtras = {}
): PublicProfileProjection | null {
  if (!config) return null;
  const isPublic = isPublicProfileAllowed(config);
  // The owner may see their own profile before opting in; nobody else can.
  if (!isPublic && extras.viewerIsOwner !== true) return null;

  return {
    uid,
    displayName: toPublicDisplayName(config),
    total: numberOrZero(stats?.total),
    totalEntries: numberOrZero(stats?.totalEntries),
    totalDays: numberOrZero(stats?.totalDays),
    currentStreak: numberOrZero(stats?.currentStreak),
    bestSingleEntry:
      typeof stats?.bestSingleEntry?.reps === 'number' &&
      Number.isFinite(stats.bestSingleEntry.reps)
        ? stats.bestSingleEntry.reps
        : null,
    bestDayTotal:
      typeof stats?.bestDay?.total === 'number' &&
      Number.isFinite(stats.bestDay.total)
        ? stats.bestDay.total
        : null,
    achievements: publicAchievementIds(extras.achievements ?? null),
    photoURL:
      typeof extras.photoURL === 'string' && extras.photoURL !== ''
        ? extras.photoURL
        : null,
    memberSince:
      typeof config.createdAt === 'string' && config.createdAt !== ''
        ? config.createdAt
        : null,
    weeklyReps: periodValue(
      stats?.weeklyReps,
      stats?.weeklyKey,
      extras.currentWeeklyKey
    ),
    monthlyReps: periodValue(
      stats?.monthlyReps,
      stats?.monthlyKey,
      extras.currentMonthlyKey
    ),
    heatmap: publicHeatmap(stats?.heatmap),
    exercises: [...(extras.exercises ?? [])],
    isPrivate: !isPublic,
    updatedAt: typeof stats?.updatedAt === 'string' ? stats.updatedAt : '',
  };
}

/**
 * Ids of earned achievements, newest first.
 *
 * Defensive on purpose: this document is written by a trigger, but the
 * profile is served unauthenticated, so a malformed or partially written
 * entry must degrade to "no badges" rather than break the page.
 */
function publicAchievementIds(
  achievements: UserAchievementsForPublicProfile | null
): string[] {
  const earned = achievements?.earned;
  if (!Array.isArray(earned)) return [];
  return earned
    .filter(
      (entry): entry is { id: string; awardedAt: string } =>
        typeof entry?.id === 'string' &&
        entry.id.length > 0 &&
        typeof entry?.awardedAt === 'string'
    )
    .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt))
    .map((entry) => entry.id);
}

/**
 * A period bucket only counts when it was written for the period we are
 * in. Without the key check a user who last trained in March would show
 * their March volume as "this month".
 */
function periodValue(
  value: unknown,
  storedKey: unknown,
  currentKey: string | undefined
): number {
  if (!currentKey || storedKey !== currentKey) return 0;
  return numberOrZero(value);
}

/**
 * Heatmap slots, defensively filtered. The document is written by a
 * trigger, but this projection is served unauthenticated — a malformed
 * entry must degrade to an empty map rather than break the page.
 */
function publicHeatmap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [slot, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[A-Za-zÄÖÜäöü]{2,3}-\d{2}$/.test(slot)) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      continue;
    }
    out[slot] = value;
  }
  return out;
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
