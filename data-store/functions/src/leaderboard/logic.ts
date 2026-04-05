/**
 * Leaderboard ranking and calculation logic
 * Pure logic and database-agnostic components
 */

import {
  berlinDateParts,
  isoWeekFromYmd,
  BerlinDateParts,
} from '../datetime';
import {
  toPublicDisplayName,
  isLeaderboardNameAllowed,
  toAnonymousLabel,
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
}

export interface LeaderboardPeriods {
  daily: LeaderboardEntry[];
  weekly: LeaderboardEntry[];
  monthly: LeaderboardEntry[];
}

export interface LeaderboardKeys {
  daily: string;
  weekly: string;
  monthly: string;
}

export interface LeaderboardDocument {
  updatedAt?: unknown; // Firestore timestamp
  timezone: string;
  keys: LeaderboardKeys;
  periods: LeaderboardPeriods;
}

const TOP_N = 10;

/**
 * Ranks pushup entries for a specific period and target key
 * Returns top N entries sorted by reps descending, with anonymized names
 * @param rows Array of pushup records
 * @param periodKey Period type: 'daily', 'weekly', or 'monthly'
 * @param targetKey The specific period to filter by (e.g., '2024-03-15' for daily)
 * @param userProfiles Map of userId -> UserProfile for display names
 * @returns Sorted leaderboard entries (max TOP_N)
 */
export function rankEntries(
  rows: PushupRow[],
  periodKey: string,
  targetKey: string,
  userProfiles: Map<string, UserProfile>
): LeaderboardEntry[] {
  const totals = new Map<string, number>();

  // Aggregate reps by user for the target period
  for (const row of rows) {
    if (!row.timestamp || !row.userId) continue;

    const d = new Date(String(row.timestamp));
    if (Number.isNaN(d.getTime())) continue;
    const p = berlinDateParts(d);

    // Calculate which period this entry belongs to
    let key: string;
    if (periodKey === 'daily') {
      key = p.isoDate;
    } else if (periodKey === 'monthly') {
      key = `${p.year}-${String(p.month).padStart(2, '0')}`;
    } else {
      // weekly
      const wk = isoWeekFromYmd(p.year, p.month, p.day);
      key = `${wk.year}-W${String(wk.week).padStart(2, '0')}`;
    }

    // Only count entries that match the target period
    if (key !== targetKey) continue;

    totals.set(row.userId, (totals.get(row.userId) || 0) + Number(row.reps || 0));
  }

  // Convert to leaderboard entries with privacy-aware display names
  return [...totals.entries()]
    .map(([userId, reps]) => {
      const profile = userProfiles.get(userId);
      const alias = isLeaderboardNameAllowed(profile)
        ? toPublicDisplayName(profile)
        : toAnonymousLabel();
      return { alias, reps };
    })
    .sort((a, b) => b.reps - a.reps)
    .slice(0, TOP_N);
}

/**
 * Calculates the current period keys (daily, weekly, monthly) for today
 * @param now Current date/time (defaults to now)
 * @returns Object with formatted period keys
 */
export function calculateCurrentPeriodKeys(now = new Date()): LeaderboardKeys {
  const today = berlinDateParts(now);
  const week = isoWeekFromYmd(today.year, today.month, today.day);

  return {
    daily: today.isoDate,
    weekly: `${week.year}-W${String(week.week).padStart(2, '0')}`,
    monthly: `${today.year}-${String(today.month).padStart(2, '0')}`,
  };
}

/**
 * Calculates the month start date for querying Firestore
 * @param today Current date parts (Berlin timezone)
 * @returns ISO date string for first day of month (YYYY-MM-01)
 */
export function getMonthStartForQuery(today: BerlinDateParts): string {
  return `${today.year}-${String(today.month).padStart(2, '0')}-01`;
}

/**
 * Filters out a demo user from rows
 * @param rows Array of pushup records
 * @param demoUserId ID to filter out
 * @returns Filtered rows
 */
export function filterOutDemoUser(rows: PushupRow[], demoUserId: string): PushupRow[] {
  return rows.filter((r) => r.userId !== demoUserId);
}
