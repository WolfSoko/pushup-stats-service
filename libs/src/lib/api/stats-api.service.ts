import { HttpClient } from '@angular/common/http';
import { isPlatformServer } from '@angular/common';
import {
  Injectable,
  PLATFORM_ID,
  TransferState,
  inject,
  makeStateKey,
} from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';
import {
  PushupCreate,
  PushupRecord,
  PushupUpdate,
  StatsFilter,
  StatsResponse,
} from '@pu-stats/models';
const PUSHUPS_ENDPOINT = `/api/pushups`;

@Injectable({ providedIn: 'root' })
export class StatsApiService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly transferState = inject(TransferState);

  load(filter: StatsFilter = {}): Observable<StatsResponse> {
    const params = new URLSearchParams();
    if (filter.from) params.set('from', filter.from);
    if (filter.to) params.set('to', filter.to);
    const query = params.toString();
    const key = makeStateKey<StatsResponse>(`stats:${query || 'all'}`);

    if (!isPlatformServer(this.platformId) && this.transferState.hasKey(key)) {
      const cached = this.transferState.get<StatsResponse>(
        key,
        {} as StatsResponse,
      );
      this.transferState.remove(key);
      return of(cached);
    }

    return this.http
      .get<StatsResponse>(
        `${this.baseUrl()}/api/stats${query ? `?${query}` : ''}`,
      )
      .pipe(
        tap((payload) => {
          if (isPlatformServer(this.platformId)) {
            this.transferState.set(key, payload);
          }
        }),
      );
  }

  listPushups(filter: StatsFilter = {}): Observable<PushupRecord[]> {
    return this.http
      .get<PushupRecord[]>(`${this.baseUrl()}${PUSHUPS_ENDPOINT}`)
      .pipe(
        map((rows) =>
          rows.filter((row) => {
            const date = row.timestamp.slice(0, 10);
            return (
              (!filter.from || date >= filter.from) &&
              (!filter.to || date <= filter.to)
            );
          }),
        ),
      );
  }

  createPushup(payload: PushupCreate): Observable<PushupRecord> {
    return this.http.post<PushupRecord>(
      `${this.baseUrl()}${PUSHUPS_ENDPOINT}`,
      payload,
    );
  }

  updatePushup(id: string, payload: PushupUpdate): Observable<PushupRecord> {
    return this.http.put<PushupRecord>(
      `${this.baseUrl()}${PUSHUPS_ENDPOINT}/${id}`,
      payload,
    );
  }

  deletePushup(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(
      `${this.baseUrl()}${PUSHUPS_ENDPOINT}/${id}`,
    );
  }

  private baseUrl(): string {
    return isPlatformServer(this.platformId)
      ? `http://127.0.0.1:${process?.env?.['API_PORT'] || 8787}`
      : '';
  }
}
