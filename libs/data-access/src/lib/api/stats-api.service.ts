import { isPlatformServer } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
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
import { UserConfigApiService } from './user-config-api.service';
import { DEMO_USER_ID } from '../demo-user.token';

@Injectable({ providedIn: 'root' })
export class StatsApiService {
  private readonly auth = inject(Auth, { optional: true });
  private readonly platformId = inject(PLATFORM_ID);
  private readonly demoUserId = inject(DEMO_USER_ID);
  private readonly pushupFirestore = inject(PushupFirestoreService, {
    optional: true,
  });
  private readonly userConfigApi = inject(UserConfigApiService, {
    optional: true,
  });

  load(filter: StatsFilter = {}): Observable<StatsResponse> {
    return this.listPushups(filter).pipe(
      switchMap((rows) => {
        if (filter.dayChartMode) {
          return of(this.toStatsResponse(rows, filter, filter.dayChartMode));
        }
        return from(this.resolveUserChartSettings(this.resolveUserId())).pipe(
          map(({ dayChartMode }) =>
            this.toStatsResponse(rows, filter, dayChartMode)
          )
        );
      })
    );
  }

  listPushups(filter: StatsFilter = {}): Observable<PushupRecord[]> {
    if (!this.pushupFirestore) {
      return of([]);
    }
    // SSR with no authenticated user: serve demo data for SEO preview
    if (isPlatformServer(this.platformId) && !this.auth?.currentUser) {
      return this.pushupFirestore.listPushups(this.demoUserId, filter);
    }
    if (!this.auth?.currentUser) {
      return of([]);
    }
    const userId = this.resolveUserId();
    return this.pushupFirestore.listPushups(userId, filter);
  }

  createPushup(payload: PushupCreate): Observable<PushupRecord> {
    if (!this.auth?.currentUser) {
      return throwError(
        () => new Error('Authentication required to create pushup')
      );
    }
    return this.requirePushupFirestore().createPushup(
      this.resolveUserId(),
      payload
    );
  }

  updatePushup(id: string, payload: PushupUpdate): Observable<void> {
    if (!this.auth?.currentUser) {
      return throwError(
        () => new Error('Authentication required to update pushup')
      );
    }
    return this.requirePushupFirestore().updatePushup(id, payload);
  }

  deletePushup(id: string): Observable<{ ok: true }> {
    if (!this.auth?.currentUser) {
      return throwError(
        () => new Error('Authentication required to delete pushup')
      );
    }
    return this.requirePushupFirestore().deletePushup(id);
  }

  private resolveUserId(): string {
    return this.auth?.currentUser?.uid ?? '';
  }

  private requirePushupFirestore(): PushupFirestoreService {
    if (!this.pushupFirestore) {
      throw new Error('PushupFirestoreService provider missing');
    }
    return this.pushupFirestore;
  }

  private async resolveUserChartSettings(userId: string): Promise<{
    dayChartMode: '24h' | '14h';
  }> {
    try {
      if (!this.auth?.currentUser || !this.userConfigApi) {
        return { dayChartMode: '14h' };
      }
      const cfg = await firstValueFrom(this.userConfigApi.getConfig(userId));
      const dayChartMode = cfg?.ui?.dayChartMode === '24h' ? '24h' : '14h';
      return { dayChartMode };
    } catch {
      return { dayChartMode: '14h' };
    }
  }

  private toStatsResponse(
    rows: PushupRecord[],
    filter: StatsFilter,
    dayChartMode: '24h' | '14h'
  ): StatsResponse {
    const from = filter.from ?? null;
    const to = filter.to ?? null;
    const isDayRange = !!from && !!to && from === to;

    if (isDayRange) {
      const hourTotals = Array.from({ length: 24 }, () => 0);
      for (const row of rows) {
        const hour = new Date(row.timestamp).getHours();
        if (hour >= 0 && hour <= 23) hourTotals[hour] += row.reps;
      }

      let cumulative = 0;
      const series =
        dayChartMode === '24h'
          ? hourTotals.map((total, hour) => {
              cumulative += total;
              return {
                bucket: `${from}T${String(hour).padStart(2, '0')}:00:00`,
                total,
                dayIntegral: cumulative,
              };
            })
          : (() => {
              const result: StatsResponse['series'] = [];
              const nightTotal = hourTotals
                .slice(0, 8)
                .reduce((sum, value) => sum + value, 0);
              cumulative += nightTotal;
              result.push({
                bucket: `${from}T00:00:00`,
                bucketLabel: '00-07',
                total: nightTotal,
                dayIntegral: cumulative,
              });

              for (let hour = 8; hour <= 21; hour++) {
                const total = hourTotals[hour] ?? 0;
                cumulative += total;
                result.push({
                  bucket: `${from}T${String(hour).padStart(2, '0')}:00:00`,
                  total,
                  dayIntegral: cumulative,
                });
              }

              return result;
            })();

      const total = rows.reduce((sum, row) => sum + row.reps, 0);

      return {
        meta: {
          from,
          to,
          entries: rows.length,
          days: from ? 1 : 0,
          total,
          granularity: 'hourly',
          dayChartMode,
        },
        series,
      };
    }

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
        dayIntegral: cumulative,
      };
    });

    const total = rows.reduce((sum, row) => sum + row.reps, 0);

    return {
      meta: {
        from: filter.from ?? sortedDays[0] ?? null,
        to: filter.to ?? sortedDays[sortedDays.length - 1] ?? null,
        entries: rows.length,
        days: sortedDays.length,
        total,
        granularity: 'daily',
      },
      series,
    };
  }
}
