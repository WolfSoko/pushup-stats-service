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

/**
 * What the board compares. `days` and `streak` do not care which exercise
 * anyone does — the fair default among friends with different favourites;
 * `reps` is one exercise's count, for those who want to race.
 */
export type FriendsBoardMetric = 'days' | 'streak' | 'reps';

export function isFriendsBoardMetric(
  value: unknown
): value is FriendsBoardMetric {
  return value === 'days' || value === 'streak' || value === 'reps';
}

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
  /**
   * `userStats/{uid}/perExercise/{exerciseId}` for `reps`, the root
   * `userStats/{uid}` for `days` and `streak`; null when absent.
   */
  readonly stats: {
    total?: unknown;
    totalDays?: unknown;
    currentStreak?: unknown;
    lastEntryDate?: unknown;
    dailyReps?: unknown;
    dailyKey?: unknown;
    weeklyReps?: unknown;
    weeklyKey?: unknown;
    monthlyReps?: unknown;
    monthlyKey?: unknown;
  } | null;
  /** Training days in the period, counted from the entries (`days`, week/month). */
  readonly days?: number;
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
  /** Cheers this participant received today. */
  readonly cheers: number;
  /** Whether the viewer already cheered them today. */
  readonly cheered: boolean;
}

export interface CheersToday {
  readonly received: ReadonlyMap<string, number>;
  readonly cheeredByViewer: ReadonlySet<string>;
}

export const NO_CHEERS: CheersToday = {
  received: new Map(),
  cheeredByViewer: new Set(),
};

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
 * A streak only counts while it is alive: the last entry was today or
 * yesterday. An older one has broken, whatever the stored number says.
 */
export function streakValue(row: FriendStatsRow, todayIso: string): number {
  const stats = row.stats;
  if (!stats || typeof stats.lastEntryDate !== 'string') return 0;
  const last = stats.lastEntryDate;
  if (last !== todayIso && last !== previousDay(todayIso)) return 0;
  return numberOrZero(stats.currentStreak);
}

/** The participant's value for the metric the board compares. */
export function metricValue(
  row: FriendStatsRow,
  metric: FriendsBoardMetric,
  period: FriendsLeaderboardPeriod,
  keys: PeriodKeys
): number {
  if (metric === 'reps') return periodValue(row, period, keys);
  if (metric === 'streak') return streakValue(row, keys.dailyKey);
  if (period === 'allTime') return numberOrZero(row.stats?.totalDays);
  if (period === 'daily') return periodValue(row, 'daily', keys) > 0 ? 1 : 0;
  return row.days ?? 0;
}

/** First day of the period holding `todayIso`: the ISO week's Monday, or the 1st. */
export function periodStartIso(
  period: 'week' | 'month',
  todayIso: string
): string {
  if (period === 'month') return `${todayIso.slice(0, 7)}-01`;
  const date = new Date(`${todayIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function previousDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Distinct days among `isoDates` that fall into [from, to]. */
export function countDistinctDays(
  isoDates: ReadonlyArray<string>,
  from: string,
  to: string
): number {
  return new Set(isoDates.filter((day) => day >= from && day <= to)).size;
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
  keys: PeriodKeys,
  cheers: CheersToday = NO_CHEERS,
  metric: FriendsBoardMetric = 'reps'
): FriendsLeaderboardEntry[] {
  return rows
    .filter(participates)
    .map((row) => ({
      uid: row.uid,
      displayName: row.displayName,
      value: Math.round(metricValue(row, metric, period, keys)),
      isViewer: row.isViewer,
      cheers: cheers.received.get(row.uid) ?? 0,
      cheered: cheers.cheeredByViewer.has(row.uid),
    }))
    .sort(
      (a, b) =>
        b.value - a.value ||
        (a.displayName ?? '').localeCompare(b.displayName ?? '')
    );
}
