import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Observable } from 'rxjs';
import { StatsFilter, StatsResponse } from '@nx-temp/stats-models';

@Injectable({ providedIn: 'root' })
export class StatsApiService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  load(filter: StatsFilter = {}): Observable<StatsResponse> {
    const params = new URLSearchParams();
    if (filter.from) params.set('from', filter.from);
    if (filter.to) params.set('to', filter.to);
    const query = params.toString();

    const base =
      isPlatformServer(this.platformId)
        ? `http://127.0.0.1:${(typeof process !== 'undefined' && process.env?.['PORT']) || '8787'}`
        : '';

    return this.http.get<StatsResponse>(`${base}/api/stats${query ? `?${query}` : ''}`);
  }
}
