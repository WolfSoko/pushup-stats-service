import type {
  LeaderboardBucket,
  LeaderboardData,
  LeaderboardPeriod,
} from './leaderboard.service';
import type { MeasurementType } from '@pu-stats/models';

export type SnapshotRow = { alias: string; reps: number; uid?: string };

export type SnapshotPeriods = Partial<Record<LeaderboardPeriod, SnapshotRow[]>>;

const TOP_N = 10;

/**
 * Factory for an empty leaderboard payload. A factory (not a shared
 * frozen constant) keeps each call independent: a caller that ever
 * mutates `.top` (e.g. accidentally splicing in a new entry) only
 * touches its own snapshot instead of the singleton that every other
 * bucket would also point at.
 */
export function emptyLeaderboardData(): LeaderboardData {
  return {
    daily: { top: [], current: null },
    last7: { top: [], current: null },
    last30: { top: [], current: null },
    allTime: { top: [], current: null },
    updatedAt: null,
  };
}

/**
 * Projects a snapshot's pre-ranked period arrays into the page's
 * `LeaderboardData` shape, flagging the current user's row by `uid`.
 */
export function projectSnapshotPeriods(
  periods: SnapshotPeriods,
  currentUserId: string | null,
  updatedAt: Date | null
): LeaderboardData {
  return {
    daily: buildSnapshotBucket(periods.daily, currentUserId),
    last7: buildSnapshotBucket(periods.last7, currentUserId),
    last30: buildSnapshotBucket(periods.last30, currentUserId),
    allTime: buildSnapshotBucket(periods.allTime, currentUserId),
    updatedAt,
  };
}

function buildSnapshotBucket(
  rows: SnapshotRow[] | undefined,
  currentUserId: string | null
): LeaderboardBucket {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { top: [], current: null };
  }
  const top = rows.slice(0, TOP_N).map((entry, i) => ({
    alias: entry.alias,
    reps: entry.reps,
    rank: i + 1,
    isCurrent: !!currentUserId && entry.uid === currentUserId,
    ...(entry.uid ? { uid: entry.uid } : {}),
  }));
  return {
    top,
    current: top.find((entry) => entry.isCurrent) ?? null,
  };
}

/**
 * Returns `true` for measurement types we can aggregate into a meaningful
 * per-period sum: rep counts, hold durations, and distances. `weight`
 * is excluded because a sum of raw reps across mixed loads isn't a
 * useful leaderboard metric.
 */
export function supportsLeaderboard(measurement: MeasurementType): boolean {
  return measurement !== 'weight';
}

/**
 * Coerces whatever the Firestore client decoded into a `Date`.
 */
export function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object') {
    const candidate = value as {
      toDate?: () => Date;
      seconds?: number;
      nanoseconds?: number;
    };
    if (typeof candidate.toDate === 'function') {
      try {
        const d = candidate.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
    if (typeof candidate.seconds === 'number') {
      const millis =
        candidate.seconds * 1000 +
        Math.floor((candidate.nanoseconds ?? 0) / 1_000_000);
      const d = new Date(millis);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}
