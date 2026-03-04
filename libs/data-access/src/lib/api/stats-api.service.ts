import { isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  inject,
  Injectable,
  makeStateKey,
  PLATFORM_ID,
  TransferState,
} from '@angular/core';
import {
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  switchMap,
  tap,
} from 'rxjs';
import {
  PushupCreate,
  PushupRecord,
  PushupUpdate,
  StatsFilter,
  StatsResponse,
} from '@pu-stats/models';
import { buildServerApiBaseUrl } from './base-url.util';
import { PushupFirestoreService } from './pushup-firestore.service';
import { UserConfigFirestoreService } from './user-config-firestore.service';

const PUSHUPS_ENDPOINT = `/api/pushups`;
const STATS_ENDPOINT = `/api/stats`;

@Injectable({ providedIn: 'root' })
export class StatsApiService {
  private readonly http = inject(HttpClient);
  private readonly pushupFirestore = inject(PushupFirestoreService, {
    optional: true,
  });
  private readonly userConfigFirestore = inject(UserConfigFirestoreService, {
    optional: true,
  });
  private readonly platformId = inject(PLATFORM_ID);
  private readonly transferState = inject(TransferState);

  load(filter: StatsFilter = {}): Observable<StatsResponse> {
    if (!isPlatformServer(this.platformId)) {
      return this.listPushups(filter).pipe(
        switchMap((rows) =>
          from(this.resolveDailyGoal(this.resolveUserId())).pipe(
            map((goal) => this.toStatsResponse(rows, filter, goal))
          )
        )
      );
    }

    const params = new URLSearchParams();
    if (filter.from) params.set('from', filter.from);
    if (filter.to) params.set('to', filter.to);
    const query = params.toString();
    const key = makeStateKey<StatsResponse>(`stats:${query || 'all'}`);

    if (this.transferState.hasKey(key)) {
      const cached = this.transferState.get<StatsResponse>(
        key,
        {} as StatsResponse
      );
      this.transferState.remove(key);
      return of(cached);
    }

    return this.http
      .get<StatsResponse>(
        `${this.baseUrl()}${STATS_ENDPOINT}${query ? `?${query}` : ''}`
      )
      .pipe(
        tap((payload) => {
          if (isPlatformServer(this.platformId)) {
            this.transferState.set(key, payload);
          }
        })
      );
  }

  listPushups(filter: StatsFilter = {}): Observable<PushupRecord[]> {
    if (isPlatformServer(this.platformId)) {
      return this.http
        .get<PushupRecord[]>(`${this.baseUrl()}${PUSHUPS_ENDPOINT}`)
        .pipe(map((rows) => this.applyDateFilter(rows, filter)));
    }

    const userId = this.resolveUserId();
    return this.requirePushupFirestore()
      .listPushups(userId)
      .pipe(map((rows) => this.applyDateFilter(rows, filter)));
  }

  createPushup(payload: PushupCreate): Observable<PushupRecord> {
    if (isPlatformServer(this.platformId)) {
      return this.http.post<PushupRecord>(
        `${this.baseUrl()}${PUSHUPS_ENDPOINT}`,
        payload
      );
    }

    return this.requirePushupFirestore().createPushup(
      this.resolveUserId(),
      payload
    );
  }

  updatePushup(id: string, payload: PushupUpdate): Observable<PushupRecord> {
    if (isPlatformServer(this.platformId)) {
      return this.http.put<PushupRecord>(
        `${this.baseUrl()}${PUSHUPS_ENDPOINT}/${id}`,
        payload
      );
    }

    return this.requirePushupFirestore()
      .updatePushup(id, payload)
      .pipe(
        map(() => ({ _id: id, ...(payload as any) } as PushupRecord))
      );
  }

  deletePushup(id: string): Observable<{ ok: true }> {
    if (isPlatformServer(this.platformId)) {
      return this.http.delete<{ ok: true }>(
        `${this.baseUrl()}${PUSHUPS_ENDPOINT}/${id}`
      );
    }

    return this.requirePushupFirestore().deletePushup(id);
  }

  private baseUrl(): string {
    if (!isPlatformServer(this.platformId)) return '';
    return buildServerApiBaseUrl(this.platformId, 'StatsApiService');
  }

  private resolveUserId(): string {
    return 'default';
  }

  private requirePushupFirestore(): PushupFirestoreService {
    if (!this.pushupFirestore) {
      throw new Error('PushupFirestoreService provider missing');
    }
    return this.pushupFirestore;
  }

  private applyDateFilter(
    rows: PushupRecord[],
    filter: StatsFilter
  ): PushupRecord[] {
    return rows.filter((row) => {
      const date = row.timestamp.slice(0, 10);
      return (
        (!filter.from || date >= filter.from) &&
        (!filter.to || date <= filter.to)
      );
    });
  }

  private async resolveDailyGoal(userId: string): Promise<number> {
    try {
      if (!this.userConfigFirestore) return 100;
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
