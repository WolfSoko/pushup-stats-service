/**
 * Per-exercise leaderboard ranking — sibling of `../leaderboard/logic.ts`.
 *
 * The pushup leaderboard reads `pushups`, which has a publicly readable
 * subset (demo-user docs + snapshot at `leaderboards/current`). Every
 * other catalog exercise lives in `exerciseEntries` where the Firestore
 * rule restricts reads to the owning user — so the client cannot
 * aggregate cross-user rankings. This module owns the server-side
 * aggregation that bridges the gap: a scheduled rebuild reads all
 * recent `exerciseEntries`, groups by exerciseId, and writes a single
 * public snapshot at `leaderboards/exercises` that the client can read.
 */

import { berlinDateParts, BerlinDateParts } from '../datetime';
import {
  isLeaderboardExcluded,
  isPublicProfileLinkAllowed,
  UserProfile,
} from '../profile';

/**
 * Subset of the `exerciseEntries` Firestore doc we actually consume.
 * Every catalog exercise's primary value lives on `reps`,
 * `durationSec`, or `distanceM` — `rankExerciseEntries` is told via
 * `valueField` which one to read.
 */
export interface ExerciseEntryRow {
  timestamp?: string;
  userId?: string;
  exerciseId?: string;
  reps?: number;
  durationSec?: number;
  distanceM?: number;
}

export interface ExerciseLeaderboardEntry {
  alias: string;
  /**
   * Aggregated primary value over the period. Reuses the snapshot field
   * name `reps` from the pushup leaderboard so the frontend's
   * `LeaderboardEntry` type carries both shapes uniformly — semantically
   * this is "reps", "seconds", or "meters" depending on the exercise's
   * measurement.
   */
  reps: number;
  uid?: string;
}

export interface ExerciseLeaderboardPeriods {
  daily: ExerciseLeaderboardEntry[];
  last7: ExerciseLeaderboardEntry[];
  last30: ExerciseLeaderboardEntry[];
}

export type ExerciseLeaderboardPeriodKind = 'daily' | 'last7' | 'last30';

/**
 * Value field on `ExerciseEntryRow` that carries the primary measurement
 * value for a given exercise. Mirrors `measurementValueField()` from
 * `@pu-stats/models`, which the client uses for the same routing; the
 * value isn't shared between the two because the Cloud Functions
 * package can't depend on the Angular workspace lib.
 */
export type ExerciseValueField = 'reps' | 'durationSec' | 'distanceM';

const TOP_N = 10;

/**
 * Per-user, per-Berlin-day cap by value-field. Acts as the anti-cheat
 * shape that mirrors `LEADERBOARD_DAILY_REPS_CAP = 2000` for the pushup
 * leaderboard: a high but plausible elite ceiling, anything above is
 * silently truncated.
 *
 * - `reps`: 2000 per day matches the pushup ceiling.
 * - `durationSec`: 14400 s = 4 h per day per exercise — covers ultra
 *   plank/yoga sessions without giving an absurd number room to win.
 * - `distanceM`: 100 000 m = 100 km per day per exercise — leaves the
 *   ultra-runner / cyclist headroom while blocking obvious garbage.
 */
const DAILY_CAP_BY_FIELD: Readonly<Record<ExerciseValueField, number>> = {
  reps: 2000,
  durationSec: 14_400,
  distanceM: 100_000,
};

/**
 * Returns the ISO date `daysBack` days before the given Berlin date.
 * Duplicated from `../leaderboard/logic.ts` to avoid a back-reference
 * between sibling modules. UTC math anchored to noon dodges DST glitches.
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
 * Same trailing-window semantics as the pushup ranker:
 *   - `daily`: rows with Berlin-date == `targetKey`.
 *   - `last7` / `last30`: rows in the trailing 7- or 30-day window
 *     ending on `targetKey` (inclusive on both endpoints).
 *
 * `valueField` selects which numeric field on the row carries the
 * primary measurement (`reps`, `durationSec`, or `distanceM`).
 * Privacy filtering is identical to the pushup ranker — full
 * publicProfile opt-in required, admin shadow-ban respected.
 */
export function rankExerciseEntries(
  rows: ExerciseEntryRow[],
  valueField: ExerciseValueField,
  periodKey: ExerciseLeaderboardPeriodKind,
  targetKey: string,
  userProfiles: Map<string, UserProfile>
): ExerciseLeaderboardEntry[] {
  // Aggregate per (userId, Berlin day) first so the per-day cap can be
  // applied before the windowed sum collapses the day boundary.
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
    const rawValue = row[valueField];
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) continue;

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
    userDays.set(p.isoDate, (userDays.get(p.isoDate) || 0) + rawValue);
  }

  const cap = DAILY_CAP_BY_FIELD[valueField];
  const totals = new Map<string, number>();
  for (const [userId, days] of perDay) {
    let total = 0;
    for (const [, dayValue] of days) {
      total += Math.min(dayValue, cap);
    }
    totals.set(userId, total);
  }

  return [...totals.entries()]
    .flatMap(([userId, reps]): ExerciseLeaderboardEntry[] => {
      const profile = userProfiles.get(userId);
      if (isLeaderboardExcluded(profile)) return [];
      if (!isPublicProfileLinkAllowed(profile)) return [];
      const alias = String(profile?.displayName || '').trim();
      // Snapshots are rounded to integers — durationSec/distanceM are
      // already integers per the Firestore rule, and rounding reps
      // here is a no-op. Keeps the JSON payload compact and consistent
      // with the pushup snapshot shape.
      return [{ alias, reps: Math.round(reps), uid: userId }];
    })
    .sort((a, b) => b.reps - a.reps)
    .slice(0, TOP_N);
}

/**
 * Lower bound for the Firestore `exerciseEntries` query — reaches back
 * 30 days from today's Berlin date with one extra day buffer, matching
 * `getLeaderboardQueryStartDate` for pushups so rows logged in UTC near
 * Berlin midnight don't get clipped.
 */
export function getExerciseLeaderboardQueryStartDate(
  today: BerlinDateParts
): string {
  return isoDateNDaysBefore(today, 30);
}
