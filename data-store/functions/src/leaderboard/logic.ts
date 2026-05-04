/**
 * Leaderboard ranking and calculation logic
 * Pure logic and database-agnostic components
 */

import { berlinDateParts, BerlinDateParts } from '../datetime';
import { isPublicProfileLinkAllowed, UserProfile } from '../profile';

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
}

export interface LeaderboardKeys {
  daily: string;
  last7: string;
  last30: string;
}

export interface LeaderboardDocument {
  updatedAt?: unknown; // Firestore timestamp
  timezone: string;
  keys: LeaderboardKeys;
  periods: LeaderboardPeriods;
}

export type LeaderboardPeriodKind = 'daily' | 'last7' | 'last30';

const TOP_N = 10;

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
  const totals = new Map<string, number>();

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

    totals.set(
      row.userId,
      (totals.get(row.userId) || 0) + Number(row.reps || 0)
    );
  }

  return [...totals.entries()]
    .flatMap(([userId, reps]): LeaderboardEntry[] => {
      const profile = userProfiles.get(userId);
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
 * All three buckets are anchored on today's ISO date — `last7` / `last30`
 * are rolling windows that always end on the current Berlin day.
 */
export function calculateCurrentPeriodKeys(now = new Date()): LeaderboardKeys {
  const today = berlinDateParts(now);
  return {
    daily: today.isoDate,
    last7: today.isoDate,
    last30: today.isoDate,
  };
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
