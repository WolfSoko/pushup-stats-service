import { inject, Injectable } from '@angular/core';
import {
  collection,
  Firestore,
  getDocs,
  orderBy,
  query,
  where,
} from '@angular/fire/firestore';

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly';

export type LeaderboardEntry = {
  alias: string;
  reps: number;
};

export type LeaderboardData = Record<LeaderboardPeriod, LeaderboardEntry[]>;

type PushupRow = {
  userId: string;
  reps: number;
  timestamp: string;
};

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly firestore = inject(Firestore, { optional: true });

  async load(): Promise<LeaderboardData> {
    const start = this.startOfMonthIso();
    const rows = await this.fetchRows(start);
    return {
      daily: this.aggregate(rows, 'daily'),
      weekly: this.aggregate(rows, 'weekly'),
      monthly: this.aggregate(rows, 'monthly'),
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
    period: LeaderboardPeriod
  ): LeaderboardEntry[] {
    const bucket = this.bucketOf(new Date(), period);
    const totals = new Map<string, number>();

    for (const row of rows) {
      const key = this.bucketOf(new Date(row.timestamp), period);
      if (key !== bucket) continue;
      totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.reps);
    }

    return [...totals.entries()]
      .map(([userId, reps]) => ({ alias: this.toAlias(userId), reps }))
      .sort((a, b) => b.reps - a.reps)
      .slice(0, 10);
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
