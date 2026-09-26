/**
 * Pure logic for projecting a user's private stats + config into the
 * sanitized {@link PublicProfileProjection} shape returned by the
 * `getPublicProfile` Cloud Function.
 *
 * Kept Firebase-free so it can be unit-tested without an emulator and so
 * the projection rules stay in one auditable place — every leak risk
 * (email, goals, reminder config, raw entries) is whitelisted by absence.
 */

import {
  canViewProfile,
  EMPTY_TRAINING_SUMMARY,
  isProfilePublic,
  isSectionVisibleTo,
  profileVisibilityMap,
  PROFILE_SECTIONS,
  type ProfileSection,
  type ProfileViewer,
  type PublicProfileXp,
} from '@pu-stats/models';

import { toPublicDisplayName } from './logic';
import type {
  PublicProfileExtras,
  PublicProfileProjection,
  UserAchievementsForPublicProfile,
  UserConfigForPublicProfile,
  UserStatsForPublicProfile,
} from './public-profile.types';

/**
 * Returns true iff some part of the profile is published to the world.
 * Defaults to private — undefined / missing fields = false.
 */
export function isPublicProfileAllowed(
  config: UserConfigForPublicProfile | undefined | null
): boolean {
  return isProfilePublic(config?.ui);
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
  const viewerIsOwner = extras.viewerIsOwner === true;
  const viewerIsFriend = extras.viewerIsFriend === true;
  const viewer: ProfileViewer = viewerIsOwner
    ? 'owner'
    : viewerIsFriend
      ? 'friend'
      : 'public';
  // The owner sees their own profile before opting in, a confirmed friend
  // sees it because the owner agreed to the friendship; nobody else can.
  if (!canViewProfile(config.ui, viewer)) return null;

  const visibility = profileVisibilityMap(config.ui);
  const hidden = PROFILE_SECTIONS.filter((s) => visibility[s] === 'off');
  // The owner needs the full picture to operate the switches; everyone
  // else gets a projection the values they may not see never entered.
  const show = <T>(section: ProfileSection, value: T, blank: T): T =>
    isSectionVisibleTo(visibility[section], viewer) ? value : blank;
  const summary = extras.summary ?? EMPTY_TRAINING_SUMMARY;

  return {
    uid,
    displayName: toPublicDisplayName(config),
    total: show('total', summary.reps, null),
    totalDurationSec: show('total', summary.durationSec, null),
    totalDistanceM: show('total', summary.distanceM, null),
    totalEntries: show('entries', summary.entries, null),
    totalDays: show('days', summary.days, null),
    currentStreak: show('streak', summary.currentStreak, null),
    bestEntryXp: show('bestSet', summary.bestEntryXp, null),
    bestDayXp: show('bestDay', summary.bestDayXp, null),
    xp: show('xp', publicXp(extras), null),
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
    heatmap: show('heatmap', publicHeatmap(stats?.heatmap), {}),
    exercises: show('exercises', [...(extras.exercises ?? [])], []),
    recent: show('recent', [...(extras.recent ?? [])], []),
    plan: show('plan', extras.plan ?? null, null),
    workouts: show('workouts', [...(extras.workouts ?? [])], []),
    isPrivate: !isPublic,
    viewerIsOwner,
    viewerIsFriend,
    viewerCheeredToday: viewerIsFriend && extras.viewerCheeredToday === true,
    hidden: viewerIsOwner ? hidden : [],
    visibility: viewerIsOwner ? visibility : {},
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
 * The owner's XP. `null` before the first booking, so a profile without
 * XP shows no empty level card.
 */
function publicXp(extras: PublicProfileExtras): PublicProfileXp | null {
  const xp = extras.xp;
  if (!xp) return null;
  return {
    total: numberOrZero(xp.total),
    weekly: periodValue(xp.weeklyXp, xp.weeklyKey, extras.currentWeeklyKey),
    monthly: periodValue(xp.monthlyXp, xp.monthlyKey, extras.currentMonthlyKey),
  };
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
