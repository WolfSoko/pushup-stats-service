import { isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { Observable } from 'rxjs';
import { buildServerApiBaseUrl } from './base-url.util';

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
    return buildServerApiBaseUrl(this.platformId, 'UserConfigApiService');
  }
}
