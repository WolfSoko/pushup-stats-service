import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { from, Observable, of, switchMap } from 'rxjs';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  doc,
  getDoc,
  getFirestore,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { isFirebaseConfigured, resolveFirebaseConfig } from './firebase-config';

@Injectable({ providedIn: 'root' })
export class FirebaseUserConfigService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly config = resolveFirebaseConfig();

  private app: FirebaseApp | null = null;
  private firestore: Firestore | null = null;

  get enabled(): boolean {
    return (
      isPlatformBrowser(this.platformId) && isFirebaseConfigured(this.config)
    );
  }

  constructor() {
    if (!this.enabled) return;
    this.app = initializeApp(this.config);
    this.firestore = getFirestore(this.app);
  }

  getConfig(userId: string): Observable<UserConfig> {
    if (!this.firestore) return of({} as UserConfig);
    const ref = doc(this.firestore, 'users', userId, 'config', 'default');
    return from(getDoc(ref)).pipe(
      switchMap((snap) => of((snap.data() ?? {}) as UserConfig))
    );
  }

  updateConfig(
    userId: string,
    patch: UserConfigUpdate
  ): Observable<UserConfig> {
    if (!this.firestore) return of({} as UserConfig);
    const ref = doc(this.firestore, 'users', userId, 'config', 'default');
    return from(setDoc(ref, patch, { merge: true })).pipe(
      switchMap(() => this.getConfig(userId))
    );
  }
}
