/**
 * Pure logic for projecting a user's private stats + config into the
 * sanitized {@link PublicProfileProjection} shape returned by the
 * `getPublicProfile` Cloud Function.
 *
 * Kept Firebase-free so it can be unit-tested without an emulator and so
 * the projection rules stay in one auditable place — every leak risk
 * (email, goals, reminder config, raw entries) is whitelisted by absence.
 */

import { normalizeHiddenSections, type ProfileSection } from '@pu-stats/models';

import { toPublicDisplayName } from './logic';
import type {
  PublicProfileExtras,
  PublicProfileProjection,
  UserAchievementsForPublicProfile,
  UserConfigForPublicProfile,
  UserStatsForPublicProfile,
} from './public-profile.types';

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

  const hidden = normalizeHiddenSections(config.ui?.profileHidden);
  const viewerIsOwner = extras.viewerIsOwner === true;
  // The owner needs the full picture to operate the switches; everyone
  // else gets a projection the hidden values never entered.
  const show = <T>(section: ProfileSection, value: T, blank: T): T =>
    viewerIsOwner || !hidden.includes(section) ? value : blank;

  return {
    uid,
    displayName: toPublicDisplayName(config),
    total: show('total', numberOrZero(stats?.total), null),
    totalEntries: show('entries', numberOrZero(stats?.totalEntries), null),
    totalDays: show('days', numberOrZero(stats?.totalDays), null),
    currentStreak: show('streak', numberOrZero(stats?.currentStreak), null),
    bestSingleEntry: show(
      'bestSet',
      typeof stats?.bestSingleEntry?.reps === 'number' &&
        Number.isFinite(stats.bestSingleEntry.reps)
        ? stats.bestSingleEntry.reps
        : null,
      null
    ),
    bestDayTotal: show(
      'bestDay',
      typeof stats?.bestDay?.total === 'number' &&
        Number.isFinite(stats.bestDay.total)
        ? stats.bestDay.total
        : null,
      null
    ),
    achievements: show(
      'achievements',
      publicAchievementIds(extras.achievements ?? null),
      []
    ),
    photoURL:
      typeof extras.photoURL === 'string' && extras.photoURL !== ''
        ? extras.photoURL
        : null,
    memberSince:
      typeof config.createdAt === 'string' && config.createdAt !== ''
        ? config.createdAt
        : null,
    weeklyReps: show(
      'week',
      periodValue(stats?.weeklyReps, stats?.weeklyKey, extras.currentWeeklyKey),
      null
    ),
    monthlyReps: show(
      'month',
      periodValue(
        stats?.monthlyReps,
        stats?.monthlyKey,
        extras.currentMonthlyKey
      ),
      null
    ),
    heatmap: show('heatmap', publicHeatmap(stats?.heatmap), {}),
    exercises: show('exercises', [...(extras.exercises ?? [])], []),
    isPrivate: !isPublic,
    viewerIsOwner,
    hidden: viewerIsOwner ? hidden : [],
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
