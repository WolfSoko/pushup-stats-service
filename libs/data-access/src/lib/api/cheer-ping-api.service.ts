import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  doc,
  docData,
  DocumentReference,
  Firestore,
} from '@angular/fire/firestore';
import { CheerPing } from '@pu-stats/models';
import { map, Observable, of } from 'rxjs';

/**
 * Read-only access to `cheerPings/{uid}` — the live trigger a dashboard
 * listens to for the cheer fireworks animation. Only `sendCheer` writes
 * this doc; the client never does.
 */
@Injectable({ providedIn: 'root' })
export class CheerPingApiService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(Auth, { optional: true });

  watch(userId: string): Observable<CheerPing | null> {
    const effectiveUserId = this.auth?.currentUser?.uid ?? userId;
    if (!effectiveUserId || !this.firestore) return of(null);

    const ref = doc(
      this.firestore,
      'cheerPings',
      effectiveUserId
    ) as DocumentReference<CheerPing>;
    return docData(ref).pipe(map((ping) => ping ?? null));
  }
}
