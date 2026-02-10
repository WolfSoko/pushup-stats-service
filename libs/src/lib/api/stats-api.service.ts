import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StatsFilter, StatsResponse } from '@nx-temp/stats-models';

@Injectable({ providedIn: 'root' })
export class StatsApiService {
  private readonly http = inject(HttpClient);

  load(filter: StatsFilter = {}): Observable<StatsResponse> {
    const params = new URLSearchParams();
    if (filter.from) params.set('from', filter.from);
    if (filter.to) params.set('to', filter.to);
    const query = params.toString();

    return this.http.get<StatsResponse>(`/api/stats${query ? `?${query}` : ''}`);
  }
}
