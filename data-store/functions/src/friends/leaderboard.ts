import {
  isSectionVisibleTo,
  sectionVisibility,
  type ProfileVisibilityUi,
} from '@pu-stats/models';

/**
 * Ranking a handful of friends — not the global leaderboard.
 *
 * The public leaderboard is a precomputed top-N snapshot; friends are an
 * arbitrary set of at most `MAX_FRIENDS` users, so their values are read
 * per user from the per-exercise aggregates and ranked here.
 */

export type FriendsLeaderboardPeriod = 'daily' | 'week' | 'month' | 'allTime';

export function isFriendsLeaderboardPeriod(
  value: unknown
): value is FriendsLeaderboardPeriod {
  return (
    value === 'daily' ||
    value === 'week' ||
    value === 'month' ||
    value === 'allTime'
  );
}

/** What one participant contributes, as read from Firestore. */
export interface FriendStatsRow {
  readonly uid: string;
  readonly displayName: string | null;
  /** `userStats/{uid}/perExercise/{exerciseId}`, or null when absent. */
  readonly stats: {
    total?: unknown;
    dailyReps?: unknown;
    dailyKey?: unknown;
    weeklyReps?: unknown;
    weeklyKey?: unknown;
    monthlyReps?: unknown;
    monthlyKey?: unknown;
  } | null;
  /** The participant's own profile settings, for the visibility gate. */
  readonly ui: ProfileVisibilityUi | undefined;
  /** True for the user who asked — they always see themselves. */
  readonly isViewer: boolean;
}

export interface FriendsLeaderboardEntry {
  readonly uid: string;
  readonly displayName: string | null;
  readonly value: number;
  readonly isViewer: boolean;
}

/** Current period keys, so a rolled-over bucket counts as zero. */
export interface PeriodKeys {
  readonly dailyKey: string;
  readonly weeklyKey: string;
  readonly monthlyKey: string;
}

function numberOrZero(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * A participant's value for the period. A stored bucket whose key is not
 * the current one belongs to an earlier day/week/month and counts as zero
 * — the same staleness rule the dashboard and the public profile apply.
 */
export function periodValue(
  row: FriendStatsRow,
  period: FriendsLeaderboardPeriod,
  keys: PeriodKeys
): number {
  const stats = row.stats;
  if (!stats) return 0;
  if (period === 'allTime') return numberOrZero(stats.total);
  if (period === 'daily') {
    return stats.dailyKey === keys.dailyKey ? numberOrZero(stats.dailyReps) : 0;
  }
  if (period === 'week') {
    return stats.weeklyKey === keys.weeklyKey
      ? numberOrZero(stats.weeklyReps)
      : 0;
  }
  return stats.monthlyKey === keys.monthlyKey
    ? numberOrZero(stats.monthlyReps)
    : 0;
}

/**
 * Whether this participant's numbers may appear at all.
 *
 * Gated on their own `total` section: the friends leaderboard is "my
 * numbers, visible to friends", and someone who switched that off for
 * friends is not in it. The viewer always sees their own row — otherwise
 * the board would be missing the person reading it.
 */
export function participates(row: FriendStatsRow): boolean {
  if (row.isViewer) return true;
  return isSectionVisibleTo(sectionVisibility(row.ui, 'total'), 'friend');
}

/**
 * The board: highest first, ties broken by name so the order is stable
 * between calls. Participants without a value still appear — a friends
 * board that drops everyone at zero would be empty on most days, and
 * seeing the zero is the nudge.
 */
export function rankFriends(
  rows: ReadonlyArray<FriendStatsRow>,
  period: FriendsLeaderboardPeriod,
  keys: PeriodKeys
): FriendsLeaderboardEntry[] {
  return rows
    .filter(participates)
    .map((row) => ({
      uid: row.uid,
      displayName: row.displayName,
      value: Math.round(periodValue(row, period, keys)),
      isViewer: row.isViewer,
    }))
    .sort(
      (a, b) =>
        b.value - a.value ||
        (a.displayName ?? '').localeCompare(b.displayName ?? '')
    );
}
