import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StatsFilter, StatsResponse } from '@nx-temp/stats-models';

@Injectable({ providedIn: 'root' })
export class StatsApiService {
  private readonly http = inject(HttpClient);

  load(_filter: StatsFilter = {}): Observable<StatsResponse> {
    return this.http.get<StatsResponse>('/api/stats');
  }
}
