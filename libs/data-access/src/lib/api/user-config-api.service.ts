import { HttpClient } from '@angular/common/http';
import { isPlatformServer } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { FirebaseUserConfigService } from './firebase-user-config.service';

@Injectable({ providedIn: 'root' })
export class UserConfigApiService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly firebase = inject(FirebaseUserConfigService, {
    optional: true,
  });

  getConfig(userId: string): Observable<UserConfig> {
    if (this.firebase?.enabled) return this.firebase.getConfig(userId);
    return this.http.get<UserConfig>(
      `${this.baseUrl()}/api/users/${encodeURIComponent(userId)}/config`
    );
  }

  updateConfig(
    userId: string,
    patch: UserConfigUpdate
  ): Observable<UserConfig> {
    if (this.firebase?.enabled) {
      return this.firebase.updateConfig(userId, patch);
    }
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
