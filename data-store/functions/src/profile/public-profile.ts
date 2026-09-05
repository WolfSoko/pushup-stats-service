/**
 * Pure logic for projecting a user's private stats + config into the
 * sanitized {@link PublicProfileProjection} shape returned by the
 * `getPublicProfile` Cloud Function.
 *
 * Kept Firebase-free so it can be unit-tested without an emulator and so
 * the projection rules stay in one auditable place — every leak risk
 * (email, goals, reminder config, raw entries) is whitelisted by absence.
 */

import { toPublicDisplayName, type UserProfile } from './logic';

/** Subset of `UserConfig` this projection actually reads. */
export interface UserConfigForPublicProfile extends UserProfile {
  ui?: { publicProfile?: boolean; hideFromLeaderboard?: boolean };
}

/** Subset of `UserStats` this projection actually reads. */
export interface UserStatsForPublicProfile {
  total?: number;
  totalEntries?: number;
  totalDays?: number;
  currentStreak?: number;
  bestSingleEntry?: { reps: number; timestamp: string } | null;
  bestDay?: { date: string; total: number } | null;
  updatedAt?: string;
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
export function buildPublicProfile(
  uid: string,
  config: UserConfigForPublicProfile | null,
  stats: UserStatsForPublicProfile | null,
  achievements: UserAchievementsForPublicProfile | null = null
): PublicProfileProjection | null {
  if (!config || !isPublicProfileAllowed(config)) return null;

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
    achievements: publicAchievementIds(achievements),
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

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
