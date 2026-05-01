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
};

export type LeaderboardBucket = {
  top: LeaderboardEntry[];
  current: LeaderboardEntry | null;
};

export type LeaderboardData = Record<LeaderboardPeriod, LeaderboardBucket>;

const TOP_N = 10;

type PushupRow = {
  userId: string;
  reps: number;
  timestamp: string;
};

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
    const start = this.last30StartIso();
    const rows = await this.fetchRows(start);

    const fallback = {
      daily: this.aggregate(rows, 'daily', currentUserId),
      last7: this.aggregate(rows, 'last7', currentUserId),
      last30: this.aggregate(rows, 'last30', currentUserId),
    };

    const cached = await this.loadSnapshot(currentUserId);
    if (!cached) return fallback;

    return {
      daily: {
        top: cached.daily.top,
        current:
          cached.daily.top.find((entry) => entry.isCurrent) ??
          fallback.daily.current,
      },
      last7: {
        top: cached.last7.top,
        current:
          cached.last7.top.find((entry) => entry.isCurrent) ??
          fallback.last7.current,
      },
      last30: {
        top: cached.last30.top,
        current:
          cached.last30.top.find((entry) => entry.isCurrent) ??
          fallback.last30.current,
      },
    };
  }

  private async loadSnapshot(
    currentUserId: string | null
  ): Promise<LeaderboardData | null> {
    if (!this.firestore) return null;

    const snap = await getDoc(doc(this.firestore, 'leaderboards', 'current'));
    if (!snap.exists()) return null;

    const data = snap.data() as {
      periods?: Partial<
        Record<LeaderboardPeriod, Array<{ alias: string; reps: number }>>
      >;
    };

    const periods = data?.periods;
    if (!periods) return null;

    const mapTop = (arr: Array<{ alias: string; reps: number }> | undefined) =>
      (Array.isArray(arr) ? arr : []).slice(0, TOP_N).map((entry, i) => ({
        alias: entry.alias,
        reps: entry.reps,
        rank: i + 1,
        isCurrent:
          !!currentUserId && entry.alias === this.toAlias(currentUserId),
      }));

    return {
      daily: { top: mapTop(periods.daily), current: null },
      last7: { top: mapTop(periods.last7), current: null },
      last30: { top: mapTop(periods.last30), current: null },
    };
  }

  private async fetchRows(startIso: string): Promise<PushupRow[]> {
    if (!this.firestore) return [];

    try {
      const ref = collection(this.firestore, 'pushups');
      const q = query(
        ref,
        where('timestamp', '>=', startIso),
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
    const today = this.utcDateKey(new Date());
    const windowStart =
      period === 'daily'
        ? today
        : this.utcDateKey(
            this.shiftDays(new Date(), period === 'last7' ? -6 : -29)
          );

    const totals = new Map<string, number>();

    for (const row of rows) {
      const key = this.utcDateKey(new Date(row.timestamp));
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

  private last30StartIso(): string {
    // Trailing 30-day window: today + 29 prior days. Reach back one extra day
    // to guarantee coverage across timezone boundaries.
    const now = new Date();
    const from = this.shiftDays(now, -30);
    return new Date(
      Date.UTC(
        from.getUTCFullYear(),
        from.getUTCMonth(),
        from.getUTCDate(),
        0,
        0,
        0
      )
    ).toISOString();
  }

  private utcDateKey(date: Date): string {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private shiftDays(date: Date, deltaDays: number): Date {
    const anchor = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      12,
      0,
      0
    );
    return new Date(anchor + deltaDays * 86_400_000);
  }
}
