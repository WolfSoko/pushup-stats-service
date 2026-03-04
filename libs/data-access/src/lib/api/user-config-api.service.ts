import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { doc, Firestore, getDoc, setDoc } from '@angular/fire/firestore';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { from, map, Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserConfigApiService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(Auth, { optional: true });

  getConfig(userId: string): Observable<UserConfig> {
    if (!this.auth?.currentUser || !this.firestore) {
      return of({ userId } as UserConfig);
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
    if (!this.auth?.currentUser || !this.firestore) {
      return of({ userId, ...patch } as UserConfig);
    }

    const ref = doc(this.requireFirestore(), 'userConfigs', userId);
    return from(
      setDoc(ref, { ...patch, userId } as Partial<UserConfig>, { merge: true })
    ).pipe(map(() => ({ userId, ...patch }) as UserConfig));
  }

  private requireFirestore(): Firestore {
    if (!this.firestore) {
      throw new Error('Firestore provider missing');
    }
    return this.firestore;
  }
}
