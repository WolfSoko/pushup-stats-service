import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, TransferState, inject, makeStateKey } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Observable, of, tap } from 'rxjs';
import { StatsFilter, StatsResponse } from '@nx-temp/stats-models';

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
      const cached = this.transferState.get<StatsResponse>(key, {} as StatsResponse);
      this.transferState.remove(key);
      return of(cached);
    }

    const base =
      isPlatformServer(this.platformId)
        ? `http://127.0.0.1:${(typeof process !== 'undefined' && process.env?.['PORT']) || '8787'}`
        : '';

    return this.http.get<StatsResponse>(`${base}/api/stats${query ? `?${query}` : ''}`).pipe(
      tap((payload) => {
        if (isPlatformServer(this.platformId)) {
          this.transferState.set(key, payload);
        }
      }),
    );
  }
}
