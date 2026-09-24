import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { doc, docData, Firestore, getDoc } from '@angular/fire/firestore';
import { findExerciseDefinition } from '@pu-stats/models';
import { EMPTY, Observable } from 'rxjs';
import { PendingRequestsService } from '../pending-requests.service';
import {
  emptyLeaderboardData,
  projectSnapshotPeriods,
  supportsLeaderboard,
  toDateOrNull,
  type SnapshotPeriods,
} from './leaderboard-snapshot';

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

/**
 * Sentinel id for the cross-exercise XP ranking. Not a catalog id, so it
 * can never collide with an exercise; served from `leaderboards/xp`.
 */
export const LEADERBOARD_XP_ID = 'xp';

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(Auth, { optional: true });
  private readonly pending = inject(PendingRequestsService);

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

  /** Real-time stream of the precomputed `leaderboards/xp` document. */
  observeXpSnapshot(): Observable<unknown> {
    if (!this.firestore) return EMPTY;
    return docData(doc(this.firestore, 'leaderboards', 'xp'));
  }

  /**
   * Loads ranked buckets (daily / last7 / last30 / allTime) for the
   * requested exercise from the precomputed `leaderboards/exercises`
   * snapshot, or the XP ranking from `leaderboards/xp` for
   * {@link LEADERBOARD_XP_ID}.
   */
  async load(
    exerciseId: string = LEADERBOARD_PUSHUP_ID
  ): Promise<LeaderboardData> {
    if (exerciseId === LEADERBOARD_XP_ID) return this.loadXpSnapshot();
    const def = findExerciseDefinition(exerciseId);
    if (!def) return emptyLeaderboardData();
    if (!supportsLeaderboard(def.measurement)) return emptyLeaderboardData();
    return this.readSnapshot('exercises', exerciseId, (data) => {
      const byExercise = data['byExercise'] as
        | Record<string, { periods?: SnapshotPeriods }>
        | undefined;
      return byExercise?.[exerciseId]?.periods;
    });
  }

  private loadXpSnapshot(): Promise<LeaderboardData> {
    return this.readSnapshot(
      'xp',
      LEADERBOARD_XP_ID,
      (data) => data['periods'] as SnapshotPeriods | undefined
    );
  }

  private async readSnapshot(
    docId: 'exercises' | 'xp',
    exerciseId: string,
    pickPeriods: (data: Record<string, unknown>) => SnapshotPeriods | undefined
  ): Promise<LeaderboardData> {
    if (!this.firestore) return emptyLeaderboardData();
    const currentUserId = this.auth?.currentUser?.uid ?? null;
    try {
      const snap = await this.pending.track(
        getDoc(doc(this.firestore, 'leaderboards', docId))
      );
      if (!snap.exists()) return emptyLeaderboardData();
      const data = (snap.data() ?? {}) as Record<string, unknown>;
      const updatedAt = toDateOrNull(data['updatedAt']);
      const periods = pickPeriods(data);
      if (!periods) return { ...emptyLeaderboardData(), updatedAt };
      return projectSnapshotPeriods(periods, currentUserId, updatedAt);
    } catch (err) {
      console.warn(
        `[LeaderboardService] leaderboards/${docId} read failed for ${exerciseId}:`,
        err
      );
      return emptyLeaderboardData();
    }
  }
}
