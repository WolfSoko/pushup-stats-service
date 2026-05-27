/**
 * Leaderboard ranking and calculation logic
 * Pure logic and database-agnostic components
 */

import { berlinDateParts, BerlinDateParts } from '../datetime';
import {
  isLeaderboardExcluded,
  isPublicProfileLinkAllowed,
  UserProfile,
} from '../profile';

export interface PushupRow {
  timestamp?: string;
  userId?: string;
  reps?: number;
}

export interface LeaderboardEntry {
  alias: string;
  reps: number;
  /**
   * Public-profile UID. Always populated by `rankEntries()` because the
   * leaderboard now requires the full publicProfile opt-in. Kept optional
   * on the type so the frontend stays tolerant of older snapshots that
   * may still carry uid-less rows.
   */
  uid?: string;
}

export interface LeaderboardPeriods {
  daily: LeaderboardEntry[];
  last7: LeaderboardEntry[];
  last30: LeaderboardEntry[];
  allTime: LeaderboardEntry[];
}

export interface LeaderboardKeys {
  daily: string;
  last7: string;
  last30: string;
  /**
   * The `allTime` bucket is unbounded, but the key still tracks the
   * snapshot's anchor day so consumers can tell when the cumulative
   * ranking was last rebuilt. Mirrors `daily` for that reason.
   */
  allTime: string;
}

export interface LeaderboardDocument {
  updatedAt?: unknown; // Firestore timestamp
  timezone: string;
  keys: LeaderboardKeys;
  periods: LeaderboardPeriods;
}

export type LeaderboardPeriodKind = 'daily' | 'last7' | 'last30' | 'allTime';

const TOP_N = 10;

/**
 * Per-user, per-Berlin-day cap on reps that count toward the leaderboard.
 * Acts as a defense-in-depth on top of the per-entry cap (`PUSHUP_REPS_MAX`)
 * — a determined cheater can still log many entries below 500 reps per
 * day, this caps the visible total at a plausible elite ceiling. Anything
 * above is silently truncated; the user's own stats keep the raw value.
 */
const LEADERBOARD_DAILY_REPS_CAP = 2000;

/**
 * Returns the ISO date `daysBack` days before the given Berlin date.
 * Uses UTC math anchored to noon to dodge DST boundary glitches — the only
 * thing we read out is `YYYY-MM-DD`, so the time of day is irrelevant.
 */
export function isoDateNDaysBefore(
  reference: BerlinDateParts,
  daysBack: number
): string {
  const anchor = Date.UTC(
    reference.year,
    reference.month - 1,
    reference.day,
    12,
    0,
    0
  );
  const shifted = new Date(anchor - daysBack * 86_400_000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Ranks pushup entries for a specific period and target key.
 * - `daily`: aggregates entries on `targetKey` (an ISO date).
 * - `last7` / `last30`: aggregates entries with Berlin-date in the trailing
 *   7- or 30-day window ending on `targetKey` (inclusive).
 *
 * Returns top N entries sorted by reps descending, with privacy-aware names.
 */
export function rankEntries(
  rows: PushupRow[],
  periodKey: LeaderboardPeriodKind,
  targetKey: string,
  userProfiles: Map<string, UserProfile>
): LeaderboardEntry[] {
  // Aggregate per (userId, Berlin day) first so the daily cap can be
  // applied before windowed sums collapse the day boundary.
  const perDay = new Map<string, Map<string, number>>();

  let windowStart: string | null = null;
  if (periodKey === 'last7' || periodKey === 'last30') {
    const [y, m, d] = targetKey.split('-').map(Number);
    const days = periodKey === 'last7' ? 6 : 29;
    windowStart = isoDateNDaysBefore(
      { year: y, month: m, day: d, isoDate: targetKey },
      days
    );
  }

  for (const row of rows) {
    if (!row.timestamp || !row.userId) continue;

    const d = new Date(String(row.timestamp));
    if (Number.isNaN(d.getTime())) continue;
    const p = berlinDateParts(d);

    if (periodKey === 'daily') {
      if (p.isoDate !== targetKey) continue;
    } else {
      if (!windowStart) continue;
      if (p.isoDate < windowStart || p.isoDate > targetKey) continue;
    }

    let userDays = perDay.get(row.userId);
    if (!userDays) {
      userDays = new Map();
      perDay.set(row.userId, userDays);
    }
    userDays.set(
      p.isoDate,
      (userDays.get(p.isoDate) || 0) + Number(row.reps || 0)
    );
  }

  const totals = new Map<string, number>();
  for (const [userId, days] of perDay) {
    let total = 0;
    for (const [, dayReps] of days) {
      total += Math.min(dayReps, LEADERBOARD_DAILY_REPS_CAP);
    }
    totals.set(userId, total);
  }

  return [...totals.entries()]
    .flatMap(([userId, reps]): LeaderboardEntry[] => {
      const profile = userProfiles.get(userId);
      // Admin-set exclusion shadow-bans regardless of opt-in toggles.
      if (isLeaderboardExcluded(profile)) return [];
      // Public leaderboard requires the full public-profile opt-in:
      // `ui.publicProfile === true`, `ui.hideFromLeaderboard === false`,
      // and a non-empty `displayName`. `isPublicProfileLinkAllowed`
      // checks all three — so every row that survives is also linkable
      // to /u/<uid>.
      if (!isPublicProfileLinkAllowed(profile)) return [];
      const alias = String(profile?.displayName || '').trim();
      return [{ alias, reps, uid: userId }];
    })
    .sort((a, b) => b.reps - a.reps)
    .slice(0, TOP_N);
}

/**
 * Calculates the current period keys for today.
 * All four buckets are anchored on today's ISO date — `last7` / `last30`
 * are rolling windows that always end on the current Berlin day, and
 * `allTime` records the day the cumulative ranking was last rebuilt.
 */
export function calculateCurrentPeriodKeys(now = new Date()): LeaderboardKeys {
  const today = berlinDateParts(now);
  return {
    daily: today.isoDate,
    last7: today.isoDate,
    last30: today.isoDate,
    allTime: today.isoDate,
  };
}

/**
 * Per-user lifetime totals taken from `userStats/{userId}.total`. Keyed
 * by userId so callers can join with the userConfigs profile map without
 * re-querying.
 */
export interface UserTotalRow {
  userId: string;
  total: number;
}

/**
 * Ranks lifetime totals from the precomputed `userStats` aggregates.
 * Unlike {@link rankEntries} there's no per-day cap to apply — the
 * cumulative total already encompasses arbitrarily many days. We still
 * gate on the full public-profile opt-in and admin exclusion so the
 * privacy contract matches the windowed leaderboards.
 */
export function rankAllTime(
  rows: UserTotalRow[],
  userProfiles: Map<string, UserProfile>
): LeaderboardEntry[] {
  return rows
    .flatMap(({ userId, total }): LeaderboardEntry[] => {
      if (!userId) return [];
      if (!Number.isFinite(total) || total <= 0) return [];
      const profile = userProfiles.get(userId);
      if (isLeaderboardExcluded(profile)) return [];
      if (!isPublicProfileLinkAllowed(profile)) return [];
      const alias = String(profile?.displayName || '').trim();
      return [{ alias, reps: total, uid: userId }];
    })
    .sort((a, b) => b.reps - a.reps)
    .slice(0, TOP_N);
}

/**
 * Returns the ISO date that bounds the Firestore query for the leaderboard
 * rebuild. Reaches back 30 days from today's Berlin date — one extra day
 * beyond the last30 window — so the query also captures rows whose UTC
 * timestamp falls on the previous calendar day (e.g. Berlin 00:30 on
 * day-29 stored as UTC 23:30 on day-30). `rankEntries()` then trims to the
 * exact 30-day Berlin window.
 */
export function getLeaderboardQueryStartDate(today: BerlinDateParts): string {
  return isoDateNDaysBefore(today, 30);
}

/**
 * Filters out a demo user from rows
 */
export function filterOutDemoUser(
  rows: PushupRow[],
  demoUserId: string
): PushupRow[] {
  return rows.filter((r) => r.userId !== demoUserId);
}
