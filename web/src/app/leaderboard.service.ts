import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  collection,
  doc,
  Firestore,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from '@angular/fire/firestore';

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly';

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

  async load(): Promise<LeaderboardData> {
    const currentUserId = this.auth?.currentUser?.uid ?? null;
    const start = this.startOfMonthIso();
    const rows = await this.fetchRows(start);

    const fallback = {
      daily: this.aggregate(rows, 'daily', currentUserId),
      weekly: this.aggregate(rows, 'weekly', currentUserId),
      monthly: this.aggregate(rows, 'monthly', currentUserId),
    };

    const cached = await this.loadSnapshot(currentUserId);
    if (!cached) return fallback;

    return {
      daily: { top: cached.daily.top, current: fallback.daily.current },
      weekly: { top: cached.weekly.top, current: fallback.weekly.current },
      monthly: { top: cached.monthly.top, current: fallback.monthly.current },
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
      weekly: { top: mapTop(periods.weekly), current: null },
      monthly: { top: mapTop(periods.monthly), current: null },
    };
  }

  private async fetchRows(startIso: string): Promise<PushupRow[]> {
    if (!this.firestore) return [];
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
  }

  private aggregate(
    rows: PushupRow[],
    period: LeaderboardPeriod,
    currentUserId: string | null
  ): LeaderboardBucket {
    const bucket = this.bucketOf(new Date(), period);
    const totals = new Map<string, number>();

    for (const row of rows) {
      const key = this.bucketOf(new Date(row.timestamp), period);
      if (key !== bucket) continue;
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

  private startOfMonthIso(): string {
    const now = new Date();
    const from = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)
    );
    return from.toISOString();
  }

  private bucketOf(date: Date, period: LeaderboardPeriod): string {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');

    if (period === 'daily') return `${yyyy}-${mm}-${dd}`;
    if (period === 'monthly') return `${yyyy}-${mm}`;

    const week = this.isoWeek(date);
    return `${yyyy}-W${String(week).padStart(2, '0')}`;
  }

  private isoWeek(date: Date): number {
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
