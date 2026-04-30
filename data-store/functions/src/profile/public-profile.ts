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

export interface PublicProfileProjection {
  uid: string;
  displayName: string;
  total: number;
  totalEntries: number;
  totalDays: number;
  currentStreak: number;
  bestSingleEntry: number | null;
  bestDayTotal: number | null;
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
 * Validates a Firebase UID input. Real Firebase UIDs are URL-safe characters
 * up to 128 chars long (anonymous: 28 chars). Reject anything outside a
 * conservative range so a malformed slug never reaches Firestore.
 */
export function isValidUid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
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
  stats: UserStatsForPublicProfile | null
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
      typeof stats?.bestSingleEntry?.reps === 'number'
        ? stats.bestSingleEntry.reps
        : null,
    bestDayTotal:
      typeof stats?.bestDay?.total === 'number' ? stats.bestDay.total : null,
    updatedAt: typeof stats?.updatedAt === 'string' ? stats.updatedAt : '',
  };
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
