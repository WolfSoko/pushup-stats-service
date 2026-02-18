import { HttpClient } from '@angular/common/http';
import { isPlatformServer } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';

@Injectable({ providedIn: 'root' })
export class UserConfigApiService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  getConfig(userId: string): Observable<UserConfig> {
    return this.http.get<UserConfig>(
      `${this.baseUrl()}/api/users/${encodeURIComponent(userId)}/config`,
    );
  }

  updateConfig(
    userId: string,
    patch: UserConfigUpdate,
  ): Observable<UserConfig> {
    return this.http.put<UserConfig>(
      `${this.baseUrl()}/api/users/${encodeURIComponent(userId)}/config`,
      patch,
    );
  }

  private baseUrl(): string {
    return isPlatformServer(this.platformId)
      ? `http://127.0.0.1:${process?.env?.['API_PORT'] || '8787'}`
      : '';
  }
}
