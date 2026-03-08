import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  doc,
  DocumentReference,
  Firestore,
  getDoc,
  setDoc,
} from '@angular/fire/firestore';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { from, map, Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserConfigApiService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(Auth, { optional: true });

  getConfig(userId: string): Observable<UserConfig> {
    const effectiveUserId = this.resolveUserId(userId);
    if (!effectiveUserId || !this.firestore) {
      return of({ userId } as UserConfig);
    }

    const ref = this.docRef(effectiveUserId);
    return from(getDoc(ref)).pipe(
      map((snapshot) => {
        const data = snapshot.data() as UserConfig | undefined;
        return data ?? ({ userId: effectiveUserId } as UserConfig);
      })
    );
  }

  updateConfig(
    userId: string,
    patch: UserConfigUpdate
  ): Observable<UserConfig> {
    const effectiveUserId = this.resolveUserId(userId);
    if (!effectiveUserId || !this.firestore) {
      return of({ userId, ...patch } as UserConfig);
    }

    const ref = this.docRef(effectiveUserId);
    return from(
      setDoc(
        ref,
        { ...patch, userId: effectiveUserId } as Partial<UserConfig>,
        { merge: true }
      )
    ).pipe(map(() => ({ userId: effectiveUserId, ...patch }) as UserConfig));
  }

  setConfig(userId: string, config: UserConfig): Promise<void> {
    const effectiveUserId = this.resolveUserId(userId);
    if (!effectiveUserId || !this.firestore) {
      return Promise.resolve();
    }

    return setDoc(this.docRef(effectiveUserId), {
      ...config,
      userId: effectiveUserId,
    } as UserConfig);
  }

  private resolveUserId(fallbackUserId: string): string {
    return this.auth?.currentUser?.uid ?? fallbackUserId;
  }

  private docRef(userId: string): DocumentReference<UserConfig> {
    return doc(
      this.requireFirestore(),
      'userConfigs',
      userId
    ) as DocumentReference<UserConfig>;
  }

  private requireFirestore(): Firestore {
    if (!this.firestore) {
      throw new Error('Firestore provider missing');
    }
    return this.firestore;
  }
}
