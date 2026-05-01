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
import { EMPTY, Observable } from 'rxjs';

export type LeaderboardPeriod = 'daily' | 'last7' | 'last30';

export type LeaderboardEntry = {
  alias: string;
  reps: number;
  rank: number;
  isCurrent?: boolean;
  /**
   * UID is present iff the user opted into BOTH the leaderboard
   * (`ui.hideFromLeaderboard === false`) AND a public profile
   * (`ui.publicProfile === true`). When set, the frontend renders the
   * row as a link to `/u/<uid>`; when missing, the row stays plain text.
   * Anonymous-aliased rows never carry a UID.
   */
  uid?: string;
};

export type LeaderboardBucket = {
  top: LeaderboardEntry[];
  current: LeaderboardEntry | null;
};

export type LeaderboardData = Record<LeaderboardPeriod, LeaderboardBucket>;

const TOP_N = 10;
const TZ = 'Europe/Berlin';

type PushupRow = {
  userId: string;
  reps: number;
  timestamp: string;
};

type CachedBuckets = Partial<LeaderboardData>;

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(Auth, { optional: true });

  /**
   * Real-time stream of the precomputed `leaderboards/current` document.
   *
   * Used by `LeaderboardStore` to reload aggregates whenever the Cloud
   * Function rewrites the snapshot, giving the leaderboard live updates
   * without a manual refresh. The store only cares about *change*
   * notifications, not payload shape — so we forward whatever `docData`
   * emits (the doc data, or `undefined` when the doc does not exist), and
   * fall back to `EMPTY` (no emissions) when Firestore is unavailable.
   */
  observeSnapshot(): Observable<unknown> {
    if (!this.firestore) return EMPTY;
    return docData(doc(this.firestore, 'leaderboards', 'current'));
  }

  async load(): Promise<LeaderboardData> {
    const currentUserId = this.auth?.currentUser?.uid ?? null;
    const start = this.last30StartDateKey();
    const rows = await this.fetchRows(start);

    const fallback: LeaderboardData = {
      daily: this.aggregate(rows, 'daily', currentUserId),
      last7: this.aggregate(rows, 'last7', currentUserId),
      last30: this.aggregate(rows, 'last30', currentUserId),
    };

    const cached = (await this.loadSnapshot(currentUserId)) ?? {};

    // Per-bucket merge: during the rollout from the old weekly/monthly schema
    // the snapshot may still lack the new fields. In that case use the
    // client-computed fallback instead of an empty array.
    return {
      daily: this.mergeBucket(cached.daily, fallback.daily),
      last7: this.mergeBucket(cached.last7, fallback.last7),
      last30: this.mergeBucket(cached.last30, fallback.last30),
    };
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
      periods?: Partial<
        Record<
          LeaderboardPeriod,
          Array<{ alias: string; reps: number; uid?: string }>
        >
      >;
    };

    const periods = data?.periods;
    if (!periods) return null;

    const mapTop = (
      arr: Array<{ alias: string; reps: number; uid?: string }>
    ) =>
      arr.slice(0, TOP_N).map((entry, i) => ({
        alias: entry.alias,
        reps: entry.reps,
        rank: i + 1,
        isCurrent:
          !!currentUserId && entry.alias === this.toAlias(currentUserId),
        ...(entry.uid ? { uid: entry.uid } : {}),
      }));

    // Only include keys that are actually present on the snapshot. An
    // explicit empty array is preserved (server says "no entries"); a
    // missing key drops out so the merger uses the client-side fallback.
    const result: CachedBuckets = {};
    if (Array.isArray(periods.daily)) {
      result.daily = { top: mapTop(periods.daily), current: null };
    }
    if (Array.isArray(periods.last7)) {
      result.last7 = { top: mapTop(periods.last7), current: null };
    }
    if (Array.isArray(periods.last30)) {
      result.last30 = { top: mapTop(periods.last30), current: null };
    }
    return result;
  }

  private async fetchRows(startKey: string): Promise<PushupRow[]> {
    if (!this.firestore) return [];

    try {
      const ref = collection(this.firestore, 'pushups');
      const q = query(
        ref,
        where('timestamp', '>=', startKey),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);

      return snap.docs
        .map((d) => d.data() as Partial<PushupRow>)
        .filter(
          (d): d is PushupRow =>
            !!d.userId && !!d.timestamp && Number.isFinite(d.reps)
        )
        .map((d) => ({
          userId: d.userId,
          timestamp: d.timestamp,
          reps: Number(d.reps),
        }));
    } catch {
      return [];
    }
  }

  private aggregate(
    rows: PushupRow[],
    period: LeaderboardPeriod,
    currentUserId: string | null
  ): LeaderboardBucket {
    // Window keys are computed in Europe/Berlin to match the server-side
    // bucketing (`berlinDateParts`). Comparing with UTC days would shift
    // entries logged near local midnight by ±1 day vs the snapshot.
    const today = this.berlinDateKey(new Date());
    const windowStart =
      period === 'daily'
        ? today
        : this.shiftBerlinDate(today, period === 'last7' ? -6 : -29);

    const totals = new Map<string, number>();

    for (const row of rows) {
      const key = this.berlinDateKey(new Date(row.timestamp));
      if (key < windowStart || key > today) continue;
      totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.reps);
    }

    const ranked = [...totals.entries()]
      .map(([userId, reps]) => ({
        userId,
        alias: this.toAlias(userId),
        reps,
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
