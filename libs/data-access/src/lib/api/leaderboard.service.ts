import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  collection,
  doc,
  docData,
  Firestore,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from '@angular/fire/firestore';
import { findExerciseDefinition, type MeasurementType } from '@pu-stats/models';
import { EMPTY, Observable } from 'rxjs';

export type LeaderboardPeriod = 'daily' | 'last7' | 'last30' | 'allTime';

export type LeaderboardEntry = {
  alias: string;
  /**
   * Primary measurement aggregate over the period. Field is named `reps`
   * because the precomputed Firestore snapshot writes it under that
   * key — semantically it carries the aggregated value of whatever
   * measurement field the selected exercise uses (`reps`, `durationSec`,
   * `distanceM`).
   */
  reps: number;
  rank: number;
  isCurrent?: boolean;
  /**
   * Public-profile UID. Always populated by the cloud-function ranker
   * because leaderboard rows now require the full publicProfile opt-in.
   * Optional only for compatibility with older cached snapshots; current
   * snapshots always include it. When set, the row renders as a link to
   * `/u/<uid>`; when missing (legacy), the row stays plain text.
   */
  uid?: string;
};

export type LeaderboardBucket = {
  top: LeaderboardEntry[];
  current: LeaderboardEntry | null;
};

export type LeaderboardData = {
  daily: LeaderboardBucket;
  last7: LeaderboardBucket;
  last30: LeaderboardBucket;
  /**
   * Cumulative ranking with no time window. Pushup is sourced from the
   * Cloud Function ranker reading `userStats.total`; per-exercise is
   * sourced from `byExercise[id].periods.allTime` in the same writer's
   * snapshot, which reads
   * `userStats/{userId}/perExercise/{exerciseId}.total` across users.
   * The Firestore rule blocks cross-user `exerciseEntries` reads, so a
   * client-side fallback isn't possible — when the snapshot is missing
   * the bucket the UI shows empty.
   */
  allTime: LeaderboardBucket;
  /**
   * Wall-clock time at which the displayed aggregates were produced.
   * Sourced from the precomputed `leaderboards/current` snapshot's
   * server-side `updatedAt` for the pushup leaderboard, and from the
   * client-side fetch time for every other exercise (which is computed
   * locally on each load). `null` only when no data is available yet.
   */
  updatedAt: Date | null;
};

/**
 * Sentinel exerciseId for the legacy `pushups` collection. The Cloud
 * Function ranker writes the precomputed snapshot at
 * `leaderboards/current` only for this leaderboard; every other
 * exerciseId runs the client-side aggregation against `exerciseEntries`.
 */
export const LEADERBOARD_PUSHUP_ID = 'pushup';

const TOP_N = 10;
const TZ = 'Europe/Berlin';
const PUSHUPS_COLLECTION = 'pushups';

/**
 * Factory for an empty leaderboard payload. A factory (not a shared
 * frozen constant) keeps each call independent: a caller that ever
 * mutates `.top` (e.g. accidentally splicing in a new entry) only
 * touches its own snapshot instead of the singleton that every other
 * bucket would also point at.
 */
function emptyLeaderboardData(): LeaderboardData {
  return {
    daily: { top: [], current: null },
    last7: { top: [], current: null },
    last30: { top: [], current: null },
    allTime: { top: [], current: null },
    updatedAt: null,
  };
}

type AggregationRow = {
  userId: string;
  value: number;
  timestamp: string;
};

type CachedBuckets = {
  daily?: LeaderboardBucket;
  last7?: LeaderboardBucket;
  last30?: LeaderboardBucket;
  allTime?: LeaderboardBucket;
  updatedAt: Date | null;
};

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(Auth, { optional: true });

  /**
   * Real-time stream of the precomputed `leaderboards/current` document
   * (pushup leaderboard). Emits on every Cloud Function rebuild so the
   * store can invalidate its cached pushup bucket.
   */
  observeSnapshot(): Observable<unknown> {
    if (!this.firestore) return EMPTY;
    return docData(doc(this.firestore, 'leaderboards', 'current'));
  }

  /**
   * Real-time stream of the precomputed `leaderboards/exercises`
   * document (per-exercise leaderboards). Emits on every Cloud Function
   * rebuild so the store can invalidate cached non-pushup buckets —
   * without this the first post-deploy rebuild never reaches a user
   * who opened the page before the snapshot existed.
   */
  observeExerciseSnapshot(): Observable<unknown> {
    if (!this.firestore) return EMPTY;
    return docData(doc(this.firestore, 'leaderboards', 'exercises'));
  }

  /**
   * Loads ranked buckets (daily / last7 / last30) for the requested
   * exercise. The default — and the `LEADERBOARD_PUSHUP_ID` sentinel —
   * routes through the legacy `pushups` collection and merges in the
   * precomputed snapshot at `leaderboards/current`. Every other
   * exerciseId queries `exerciseEntries` and aggregates client-side;
   * the snapshot doesn't carry per-exercise rankings yet.
   */
  async load(
    exerciseId: string = LEADERBOARD_PUSHUP_ID
  ): Promise<LeaderboardData> {
    if (exerciseId === LEADERBOARD_PUSHUP_ID) return this.loadPushup();
    return this.loadExercise(exerciseId);
  }

  private async loadPushup(): Promise<LeaderboardData> {
    const currentUserId = this.auth?.currentUser?.uid ?? null;
    const start = this.last30StartDateKey();
    const rows = await this.fetchPushupRows(start);

    // The 30-day pushups query can't compute a cumulative ranking — a
    // user whose last entry is older than 30 days would silently drop
    // off the list. The Cloud Function ranker fills `allTime` from
    // `userStats.total`; until the next snapshot rebuild lands we
    // surface an empty bucket rather than a stale 30-day approximation.
    const fallback: LeaderboardData = {
      daily: this.aggregate(rows, 'daily', currentUserId),
      last7: this.aggregate(rows, 'last7', currentUserId),
      last30: this.aggregate(rows, 'last30', currentUserId),
      allTime: { top: [], current: null },
      updatedAt: new Date(),
    };

    const cached = await this.loadSnapshot(currentUserId);

    // Per-bucket merge: during the rollout from the old weekly/monthly schema
    // the snapshot may still lack the new fields. In that case use the
    // client-computed fallback instead of an empty array.
    return {
      daily: this.mergeBucket(cached?.daily, fallback.daily),
      last7: this.mergeBucket(cached?.last7, fallback.last7),
      last30: this.mergeBucket(cached?.last30, fallback.last30),
      allTime: this.mergeBucket(cached?.allTime, fallback.allTime),
      // When a snapshot exists, its `updatedAt` is the only honest answer
      // — the server-computed rows may be hours old, so the client fetch
      // time would mislabel stale data as fresh. We deliberately surface
      // `null` (UI hides the line) rather than the client clock in that
      // case. Only when no snapshot exists at all does the fallback time
      // describe the buckets we actually display (entirely client-side).
      updatedAt: cached ? cached.updatedAt : fallback.updatedAt,
    };
  }

  /**
   * Per-exercise leaderboard. Reads the precomputed snapshot at
   * `leaderboards/exercises`, which the Cloud Function
   * `rebuildExerciseLeaderboards` rewrites every 15 min (and on every
   * `exerciseEntries` write). The doc is publicly readable; querying
   * `exerciseEntries` directly is blocked by the Firestore rule's
   * `userId == request.auth.uid` filter, so the snapshot is the only
   * way to surface cross-user rankings.
   *
   * Returns an empty leaderboard when the snapshot doesn't exist yet
   * (first run after deploy), the exerciseId isn't in the snapshot
   * (no recent activity), or the exercise's measurement type isn't
   * rankable (`weight`).
   */
  private async loadExercise(exerciseId: string): Promise<LeaderboardData> {
    const def = findExerciseDefinition(exerciseId);
    if (!def) return emptyLeaderboardData();
    if (!supportsLeaderboard(def.measurement)) return emptyLeaderboardData();
    return this.loadExerciseSnapshot(exerciseId);
  }

  private mergeBucket(
    cached: LeaderboardBucket | undefined,
    fallback: LeaderboardBucket
  ): LeaderboardBucket {
    if (!cached) return fallback;
    return {
      top: cached.top,
      current: cached.top.find((entry) => entry.isCurrent) ?? fallback.current,
    };
  }

  private async loadSnapshot(
    currentUserId: string | null
  ): Promise<CachedBuckets | null> {
    if (!this.firestore) return null;

    const snap = await getDoc(doc(this.firestore, 'leaderboards', 'current'));
    if (!snap.exists()) return null;

    const data = snap.data() as {
      updatedAt?: unknown;
      periods?: Partial<
        Record<
          LeaderboardPeriod,
          Array<{ alias: string; reps: number; uid?: string }>
        >
      >;
    };

    const updatedAt = toDateOrNull(data?.updatedAt);

    const periods = data?.periods;
    if (!periods) return updatedAt ? { updatedAt } : null;

    const mapTop = (
      arr: Array<{ alias: string; reps: number; uid?: string }>
    ) =>
      arr.slice(0, TOP_N).map((entry, i) => ({
        alias: entry.alias,
        reps: entry.reps,
        rank: i + 1,
        // Prefer matching the snapshot row by `uid` (exact identity) when
        // it's present — snapshot aliases are real display names, so the
        // obfuscated `toAlias(currentUserId)` form would never match a
        // public-profile-opted-in user and `mergeBucket()` would fall
        // back to the client-side `current` unnecessarily. Older
        // snapshots without `uid` keep the alias-based fallback so the
        // rollout doesn't lose the highlight in flight.
        isCurrent: currentUserId
          ? entry.uid
            ? entry.uid === currentUserId
            : entry.alias === this.toAlias(currentUserId)
          : false,
        ...(entry.uid ? { uid: entry.uid } : {}),
      }));

    // Only include keys that are actually present on the snapshot. An
    // explicit empty array is preserved (server says "no entries"); a
    // missing key drops out so the merger uses the client-side fallback.
    const result: CachedBuckets = { updatedAt };
    if (Array.isArray(periods.daily)) {
      result.daily = { top: mapTop(periods.daily), current: null };
    }
    if (Array.isArray(periods.last7)) {
      result.last7 = { top: mapTop(periods.last7), current: null };
    }
    if (Array.isArray(periods.last30)) {
      result.last30 = { top: mapTop(periods.last30), current: null };
    }
    if (Array.isArray(periods.allTime)) {
      result.allTime = { top: mapTop(periods.allTime), current: null };
    }
    return result;
  }

  private async fetchPushupRows(startKey: string): Promise<AggregationRow[]> {
    if (!this.firestore) return [];

    try {
      const ref = collection(this.firestore, PUSHUPS_COLLECTION);
      const q = query(
        ref,
        where('timestamp', '>=', startKey),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);

      return snap.docs
        .map(
          (d) =>
            d.data() as Partial<{
              userId: string;
              reps: number;
              timestamp: string;
            }>
        )
        .filter(
          (d): d is { userId: string; reps: number; timestamp: string } =>
            !!d.userId && !!d.timestamp && Number.isFinite(d.reps)
        )
        .map((d) => ({
          userId: d.userId,
          timestamp: d.timestamp,
          value: Number(d.reps),
        }));
    } catch {
      return [];
    }
  }

  /**
   * Reads the per-exercise snapshot doc at `leaderboards/exercises`
   * and projects the requested exerciseId's pre-ranked buckets into
   * the page's `LeaderboardData` shape. Rank, isCurrent, and uid-link
   * resolution all happen here so the snapshot doc stays compact.
   *
   * The doc is structured as
   *   { keys, timezone, updatedAt,
   *     byExercise: { [exerciseId]: { measurement, unit, periods } } }
   * — see `rebuildExerciseLeaderboardsCore` in
   * `data-store/functions/src/index.ts` for the writer side.
   *
   * The `allTime` bucket is populated when the writer includes it; the
   * client never recomputes lifetime totals from `exerciseEntries`
   * because the Firestore rule blocks cross-user reads. When the
   * snapshot doesn't carry `allTime` yet (legacy doc) the bucket
   * surfaces empty rather than mis-labelling last30 data as cumulative.
   */
  private async loadExerciseSnapshot(
    exerciseId: string
  ): Promise<LeaderboardData> {
    if (!this.firestore) return emptyLeaderboardData();

    const currentUserId = this.auth?.currentUser?.uid ?? null;

    try {
      const snap = await getDoc(
        doc(this.firestore, 'leaderboards', 'exercises')
      );
      if (!snap.exists()) return emptyLeaderboardData();

      const data = snap.data() as {
        updatedAt?: unknown;
        byExercise?: Record<
          string,
          {
            periods?: Partial<
              Record<
                LeaderboardPeriod,
                Array<{ alias: string; reps: number; uid?: string }>
              >
            >;
          }
        >;
      };

      const updatedAt = toDateOrNull(data?.updatedAt);
      const exerciseSnap = data?.byExercise?.[exerciseId];
      if (!exerciseSnap?.periods) {
        return { ...emptyLeaderboardData(), updatedAt };
      }

      return {
        daily: this.buildSnapshotBucket(
          exerciseSnap.periods.daily,
          currentUserId
        ),
        last7: this.buildSnapshotBucket(
          exerciseSnap.periods.last7,
          currentUserId
        ),
        last30: this.buildSnapshotBucket(
          exerciseSnap.periods.last30,
          currentUserId
        ),
        allTime: this.buildSnapshotBucket(
          exerciseSnap.periods.allTime,
          currentUserId
        ),
        updatedAt,
      };
    } catch (err) {
      // Non-critical: leaderboard surface degrades to empty list on a
      // transient read failure instead of wedging the UI. Surface to
      // dev console for diagnostics.

      console.warn(
        `[LeaderboardService] leaderboards/exercises read failed for ${exerciseId}:`,
        err
      );
      return emptyLeaderboardData();
    }
  }

  /**
   * Projects a snapshot period array into a `LeaderboardBucket`,
   * assigning sequential ranks and flagging the current user's row
   * by `uid` match. Symmetric to the pushup snapshot reader's
   * `mapTop` — kept separate because that one also needs the
   * legacy uid-less alias fallback path which is irrelevant here
   * (per-exercise snapshots always carry `uid`).
   */
  private buildSnapshotBucket(
    rows: Array<{ alias: string; reps: number; uid?: string }> | undefined,
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

  private aggregate(
    rows: AggregationRow[],
    period: LeaderboardPeriod,
    currentUserId: string | null
  ): LeaderboardBucket {
    // Window keys are computed in Europe/Berlin to match the server-side
    // bucketing (`berlinDateParts`). Comparing with UTC days would shift
    // entries logged near local midnight by ±1 day vs the snapshot.
    const today = this.berlinDateKey(new Date());
    // `allTime` keeps every row — no upper or lower date bound. The
    // other periods anchor on today's Berlin date and reach back the
    // matching number of days.
    const windowStart: string | null =
      period === 'allTime'
        ? null
        : period === 'daily'
          ? today
          : this.shiftBerlinDate(today, period === 'last7' ? -6 : -29);

    const totals = new Map<string, number>();

    for (const row of rows) {
      if (windowStart !== null) {
        const key = this.berlinDateKey(new Date(row.timestamp));
        if (key < windowStart || key > today) continue;
      }
      totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.value);
    }

    const ranked = [...totals.entries()]
      .map(([userId, value]) => ({
        userId,
        alias: this.toAlias(userId),
        reps: value,
      }))
      .sort((a, b) => b.reps - a.reps)
      .map((entry, index) => ({
        alias: entry.alias,
        reps: entry.reps,
        rank: index + 1,
        isCurrent: !!currentUserId && entry.userId === currentUserId,
      }));

    return {
      top: ranked.slice(0, TOP_N),
      current: ranked.find((entry) => entry.isCurrent) ?? null,
    };
  }

  private toAlias(userId: string): string {
    const cleaned = userId.trim();
    if (!cleaned) return 'A•••';
    const first = cleaned[0]?.toUpperCase() ?? 'A';
    const last = cleaned[cleaned.length - 1]?.toUpperCase() ?? 'X';
    return `${first}...${last}`;
  }

  /**
   * Lower bound for the Firestore `timestamp` query — date-only `YYYY-MM-DD`
   * to lexicographically match any ISO timestamp format the entries may use
   * (`...Z`, `...+02:00`, with or without milliseconds). The window reaches
   * back 30 days from today's Berlin date for a one-day safety buffer.
   */
  private last30StartDateKey(): string {
    return this.shiftBerlinDate(this.berlinDateKey(new Date()), -30);
  }

  private berlinDateKey(date: Date): string {
    // `en-CA` formats as `YYYY-MM-DD`, which is the canonical ISO date form
    // and lexicographically sortable.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private shiftBerlinDate(yyyymmdd: string, deltaDays: number): string {
    const [y, m, d] = yyyymmdd.split('-').map(Number);
    // Anchor at 10:00 UTC (~11:00 / 12:00 Berlin) to stay far from midnight
    // so DST transitions can't push the calendar day off-by-one when we
    // shift by whole-day increments.
    const anchor = Date.UTC(y, m - 1, d, 10, 0, 0);
    return this.berlinDateKey(new Date(anchor + deltaDays * 86_400_000));
  }
}

/**
 * Returns `true` for measurement types we can aggregate into a meaningful
 * per-period sum: rep counts, hold durations, and distances. `weight`
 * is excluded because a sum of raw reps across mixed loads isn't a
 * useful leaderboard metric — the right aggregation is `Σ(weightKg × reps)`,
 * which requires a dedicated path the catalog doesn't yet ship.
 */
function supportsLeaderboard(measurement: MeasurementType): boolean {
  return measurement !== 'weight';
}

/**
 * Coerces whatever the Firestore client decoded into a `Date` — typically a
 * `Timestamp` instance (`.toDate()`), but the wire format may also surface
 * as `{seconds, nanoseconds}`, a number of millis, an ISO string, or
 * `Date` already. Anything unrecognised becomes `null` so the UI can hide
 * the freshness line rather than rendering "Invalid Date".
 */
function toDateOrNull(value: unknown): Date | null {
  // Nullish check (not falsy) so epoch-0 millis / empty-but-valid Date
  // instances aren't silently dropped. The downstream `getTime()` /
  // `Number.isNaN` guards still reject genuine "Invalid Date" values.
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
