import { isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { doc, Firestore, getDoc, setDoc } from '@angular/fire/firestore';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { from, map, Observable } from 'rxjs';
import { buildServerApiBaseUrl } from './base-url.util';

@Injectable({ providedIn: 'root' })
export class UserConfigApiService {
  private readonly http = inject(HttpClient);
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly platformId = inject(PLATFORM_ID);

  getConfig(userId: string): Observable<UserConfig> {
    if (isPlatformServer(this.platformId)) {
      return this.http.get<UserConfig>(
        `${this.baseUrl()}/api/users/${encodeURIComponent(userId)}/config`
      );
    }

    const ref = doc(this.requireFirestore(), 'userConfigs', userId);
    return from(getDoc(ref)).pipe(
      map((snapshot) => {
        const data = snapshot.data() as UserConfig | undefined;
        return data ?? ({ userId } as UserConfig);
      })
    );
  }

  updateConfig(
    userId: string,
    patch: UserConfigUpdate
  ): Observable<UserConfig> {
    if (isPlatformServer(this.platformId)) {
      return this.http.put<UserConfig>(
        `${this.baseUrl()}/api/users/${encodeURIComponent(userId)}/config`,
        patch
      );
    }

    const ref = doc(this.requireFirestore(), 'userConfigs', userId);
    return from(
      setDoc(ref, { ...patch, userId } as Partial<UserConfig>, { merge: true })
    ).pipe(map(() => ({ userId, ...patch }) as UserConfig));
  }

  private baseUrl(): string {
    if (!isPlatformServer(this.platformId)) return '';
    return buildServerApiBaseUrl(this.platformId, 'UserConfigApiService');
  }

  private requireFirestore(): Firestore {
    if (!this.firestore) {
      throw new Error('Firestore provider missing');
    }
    return this.firestore;
  }
}
