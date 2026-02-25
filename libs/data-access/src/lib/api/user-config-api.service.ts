import { isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserConfigApiService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  getConfig(userId: string): Observable<UserConfig> {
    return this.http.get<UserConfig>(
      `${this.baseUrl()}/api/users/${encodeURIComponent(userId)}/config`
    );
  }

  updateConfig(
    userId: string,
    patch: UserConfigUpdate
  ): Observable<UserConfig> {
    return this.http.put<UserConfig>(
      `${this.baseUrl()}/api/users/${encodeURIComponent(userId)}/config`,
      patch
    );
  }

  private baseUrl(): string {
    if (!isPlatformServer(this.platformId)) return '';
    const host = process?.env?.['API_HOST'] || '127.0.0.1';
    const port = process?.env?.['API_PORT'] || '8787';
    return `http://${host}:${port}`;
  }
}
