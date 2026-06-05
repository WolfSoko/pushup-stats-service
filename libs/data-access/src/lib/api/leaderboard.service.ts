import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { doc, docData, Firestore, getDoc } from '@angular/fire/firestore';
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
   * Cumulative ranking with no time window. Sourced from
   * `byExercise[id].periods.allTime` in the Cloud Function ranker's
   * snapshot, which reads `userStats/{userId}/perExercise/{exerciseId}.total`
   * across users.
   */
  allTime: LeaderboardBucket;
  /**
   * Wall-clock time at which the displayed aggregates were produced.
   * `null` only when no data is available yet.
   */
  updatedAt: Date | null;
};

/**
 * Sentinel exerciseId for the pushup leaderboard. The Cloud Function
 * ranker writes the precomputed snapshot at `leaderboards/exercises`
 * for this exercise like every other catalog exercise.
 */
export const LEADERBOARD_PUSHUP_ID = 'pushup';

const TOP_N = 10;

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

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(Auth, { optional: true });

  /**
   * Real-time stream of the precomputed `leaderboards/current` document.
   * Kept so the store's `pushupSub` subscription can still wire up (the
   * subscription itself is removed in the same step, but `observeSnapshot`
   * is also used by `observeExerciseSnapshot` tests).
   */
  observeSnapshot(): Observable<unknown> {
    if (!this.firestore) return EMPTY;
    return docData(doc(this.firestore, 'leaderboards', 'current'));
  }

  /**
   * Real-time stream of the precomputed `leaderboards/exercises`
   * document (per-exercise leaderboards). Emits on every Cloud Function
   * rebuild so the store can invalidate cached non-pushup buckets.
   */
  observeExerciseSnapshot(): Observable<unknown> {
    if (!this.firestore) return EMPTY;
    return docData(doc(this.firestore, 'leaderboards', 'exercises'));
  }

  /**
   * Loads ranked buckets (daily / last7 / last30 / allTime) for the
   * requested exercise from the precomputed `leaderboards/exercises`
   * snapshot.
   */
  async load(
    exerciseId: string = LEADERBOARD_PUSHUP_ID
  ): Promise<LeaderboardData> {
    return this.loadExercise(exerciseId);
  }

  private async loadExercise(exerciseId: string): Promise<LeaderboardData> {
    const def = findExerciseDefinition(exerciseId);
    if (!def) return emptyLeaderboardData();
    if (!supportsLeaderboard(def.measurement)) return emptyLeaderboardData();
    return this.loadExerciseSnapshot(exerciseId);
  }

  /**
   * Reads the per-exercise snapshot doc at `leaderboards/exercises`
   * and projects the requested exerciseId's pre-ranked buckets into
   * the page's `LeaderboardData` shape.
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
   * by `uid` match.
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
}

/**
 * Returns `true` for measurement types we can aggregate into a meaningful
 * per-period sum: rep counts, hold durations, and distances. `weight`
 * is excluded because a sum of raw reps across mixed loads isn't a
 * useful leaderboard metric.
 */
function supportsLeaderboard(measurement: MeasurementType): boolean {
  return measurement !== 'weight';
}

/**
 * Coerces whatever the Firestore client decoded into a `Date`.
 */
function toDateOrNull(value: unknown): Date | null {
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
