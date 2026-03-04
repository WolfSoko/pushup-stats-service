import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  switchMap,
  throwError,
} from 'rxjs';
import {
  PushupCreate,
  PushupRecord,
  PushupUpdate,
  StatsFilter,
  StatsResponse,
} from '@pu-stats/models';
import { PushupFirestoreService } from './pushup-firestore.service';
import { UserConfigFirestoreService } from './user-config-firestore.service';

@Injectable({ providedIn: 'root' })
export class StatsApiService {
  private readonly auth = inject(Auth, { optional: true });
  private readonly pushupFirestore = inject(PushupFirestoreService, {
    optional: true,
  });
  private readonly userConfigFirestore = inject(UserConfigFirestoreService, {
    optional: true,
  });

  load(filter: StatsFilter = {}): Observable<StatsResponse> {
    return this.listPushups(filter).pipe(
      switchMap((rows) =>
        from(this.resolveDailyGoal(this.resolveUserId())).pipe(
          map((goal) => this.toStatsResponse(rows, filter, goal))
        )
      )
    );
  }

  listPushups(filter: StatsFilter = {}): Observable<PushupRecord[]> {
    const userId = this.resolveUserId();
    if (!userId || !this.pushupFirestore) {
      return of([]);
    }
    return this.pushupFirestore.listPushups(userId, filter);
  }

  createPushup(payload: PushupCreate): Observable<PushupRecord> {
    const userId = this.resolveUserId();
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }
    return this.requirePushupFirestore().createPushup(userId, payload);
  }

  updatePushup(id: string, payload: PushupUpdate): Observable<void> {
    const userId = this.resolveUserId();
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }
    return this.requirePushupFirestore().updatePushup(id, payload);
  }

  deletePushup(id: string): Observable<{ ok: true }> {
    const userId = this.resolveUserId();
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }
    return this.requirePushupFirestore().deletePushup(id);
  }

  private resolveUserId(): string | null {
    return this.auth?.currentUser?.uid ?? null;
  }

  private requirePushupFirestore(): PushupFirestoreService {
    if (!this.pushupFirestore) {
      throw new Error('PushupFirestoreService provider missing');
    }
    return this.pushupFirestore;
  }

  private async resolveDailyGoal(userId: string | null): Promise<number> {
    try {
      if (!userId || !this.userConfigFirestore) return 100;
      const cfg = await firstValueFrom(
        this.userConfigFirestore.getConfig(userId)
      );
      if (cfg?.dailyGoal && Number.isFinite(cfg.dailyGoal)) {
        return Math.max(1, cfg.dailyGoal);
      }
      return 100;
    } catch {
      return 100;
    }
  }

  private toStatsResponse(
    rows: PushupRecord[],
    filter: StatsFilter,
    dailyGoal: number
  ): StatsResponse {
    const totals = new Map<string, number>();
    for (const row of rows) {
      const day = row.timestamp.slice(0, 10);
      totals.set(day, (totals.get(day) ?? 0) + row.reps);
    }

    const sortedDays = [...totals.keys()].sort((a, b) => a.localeCompare(b));
    let cumulative = 0;
    const series = sortedDays.map((day) => {
      const total = totals.get(day) ?? 0;
      cumulative += total;
      return {
        bucket: day,
        total,
        dayIntegral: Math.round((cumulative / dailyGoal) * 100) / 100,
      };
    });

    const from = filter.from ?? sortedDays[0] ?? null;
    const to = filter.to ?? sortedDays[sortedDays.length - 1] ?? null;
    const total = rows.reduce((sum, row) => sum + row.reps, 0);

    return {
      meta: {
        from,
        to,
        entries: rows.length,
        days: sortedDays.length,
        total,
        granularity: 'daily',
      },
      series,
    };
  }
}
