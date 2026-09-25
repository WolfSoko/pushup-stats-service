import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { doc, docData, Firestore, getDoc } from '@angular/fire/firestore';
import { findExerciseDefinition } from '@pu-stats/models';
import { EMPTY, map, Observable } from 'rxjs';
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

/**
 * Where a board's pre-ranked periods live: the Firestore snapshot doc and
 * how to pick this board out of it. The XP board has its own doc; every
 * exercise board is one slot of `leaderboards/exercises`.
 */
export interface BoardSource {
  readonly docId: 'exercises' | 'xp';
  pickPeriods(data: Record<string, unknown>): SnapshotPeriods | undefined;
}

export function boardSource(boardId: string): BoardSource | null {
  if (boardId === LEADERBOARD_XP_ID) {
    return {
      docId: 'xp',
      pickPeriods: (data) => data['periods'] as SnapshotPeriods | undefined,
    };
  }
  const def = findExerciseDefinition(boardId);
  if (!def || !supportsLeaderboard(def.measurement)) return null;
  return {
    docId: 'exercises',
    pickPeriods: (data) =>
      (
        data['byExercise'] as
          | Record<string, { periods?: SnapshotPeriods }>
          | undefined
      )?.[boardId]?.periods,
  };
}

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(Auth, { optional: true });
  private readonly pending = inject(PendingRequestsService);

  /**
   * Ranked buckets for a board (a catalog exercise id or
   * {@link LEADERBOARD_XP_ID}) from its precomputed snapshot doc.
   */
  async load(
    boardId: string = LEADERBOARD_PUSHUP_ID
  ): Promise<LeaderboardData> {
    const source = boardSource(boardId);
    if (!source || !this.firestore) return emptyLeaderboardData();
    try {
      const snap = await this.pending.track(
        getDoc(doc(this.firestore, 'leaderboards', source.docId))
      );
      if (!snap.exists()) return emptyLeaderboardData();
      return this.project(source, snap.data());
    } catch (err) {
      console.warn(
        `[LeaderboardService] leaderboards/${source.docId} read failed for ${boardId}:`,
        err
      );
      return emptyLeaderboardData();
    }
  }

  /**
   * Live stream of a board, projected from each emission of its snapshot
   * doc — no second read per update.
   */
  observe(boardId: string): Observable<LeaderboardData> {
    const source = boardSource(boardId);
    if (!source || !this.firestore) return EMPTY;
    return docData(doc(this.firestore, 'leaderboards', source.docId)).pipe(
      map((data) => this.project(source, data))
    );
  }

  private project(source: BoardSource, raw: unknown): LeaderboardData {
    const data = (raw ?? {}) as Record<string, unknown>;
    const updatedAt = toDateOrNull(data['updatedAt']);
    const periods = source.pickPeriods(data);
    if (!periods) return { ...emptyLeaderboardData(), updatedAt };
    return projectSnapshotPeriods(
      periods,
      this.auth?.currentUser?.uid ?? null,
      updatedAt
    );
  }
}
