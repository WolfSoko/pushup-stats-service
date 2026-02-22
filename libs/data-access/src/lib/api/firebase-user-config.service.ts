import './firebase-process-polyfill';

import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { from, Observable, of, switchMap } from 'rxjs';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { isFirebaseConfigured, resolveFirebaseConfig } from './firebase-config';

@Injectable({ providedIn: 'root' })
export class FirebaseUserConfigService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly config = resolveFirebaseConfig();

  private app: FirebaseApp | null = null;
  private firestore: Firestore | null = null;
  private firestoreReady: Promise<void> | null = null;
  private firestoreApi: {
    doc: typeof import('firebase/firestore').doc;
    getDoc: typeof import('firebase/firestore').getDoc;
    getFirestore: typeof import('firebase/firestore').getFirestore;
    setDoc: typeof import('firebase/firestore').setDoc;
  } | null = null;

  get enabled(): boolean {
    return (
      isPlatformBrowser(this.platformId) && isFirebaseConfigured(this.config)
    );
  }

  constructor() {
    if (!this.enabled) return;
    this.app = initializeApp(this.config);
  }

  private async ensureFirestore(): Promise<void> {
    if (!this.enabled || this.firestore) return;
    if (!this.firestoreReady) {
      this.firestoreReady = (async () => {
        const module = await import('firebase/firestore');
        this.firestoreApi = {
          doc: module.doc,
          getDoc: module.getDoc,
          getFirestore: module.getFirestore,
          setDoc: module.setDoc,
        };
        this.firestore = module.getFirestore(this.app as FirebaseApp);
      })();
    }
    await this.firestoreReady;
  }

  getConfig(userId: string): Observable<UserConfig> {
    if (!this.enabled) return of({} as UserConfig);
    return from(this.ensureFirestore()).pipe(
      switchMap(() => {
        if (!this.firestore || !this.firestoreApi) return of({} as UserConfig);
        const ref = this.firestoreApi.doc(
          this.firestore,
          'users',
          userId,
          'config',
          'default'
        );
        return from(this.firestoreApi.getDoc(ref)).pipe(
          switchMap((snap) => of((snap.data() ?? {}) as UserConfig))
        );
      })
    );
  }

  updateConfig(
    userId: string,
    patch: UserConfigUpdate
  ): Observable<UserConfig> {
    if (!this.enabled) return of({} as UserConfig);
    return from(this.ensureFirestore()).pipe(
      switchMap(() => {
        if (!this.firestore || !this.firestoreApi) return of({} as UserConfig);
        const ref = this.firestoreApi.doc(
          this.firestore,
          'users',
          userId,
          'config',
          'default'
        );
        return from(this.firestoreApi.setDoc(ref, patch, { merge: true })).pipe(
          switchMap(() => this.getConfig(userId))
        );
      })
    );
  }
}
