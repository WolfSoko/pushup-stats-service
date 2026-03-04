import { isPlatformBrowser } from '@angular/common';
import {
  effect,
  Injectable,
  PLATFORM_ID,
  Signal,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, authState } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from '@angular/fire/firestore';
import { PushupRecord } from '@pu-stats/models';

/**
 * Browser-only live data stream for pushups via Firestore real-time updates.
 */
@Injectable({ providedIn: 'root' })
export class PushupLiveDataService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(Auth, { optional: true });
  private readonly firestore = inject(Firestore, { optional: true });

  private readonly connectedState = signal(false);
  private readonly entriesState = signal<PushupRecord[]>([]);

  readonly connected: Signal<boolean> = this.connectedState.asReadonly();
  readonly entries: Signal<PushupRecord[]> = this.entriesState.asReadonly();

  constructor() {
    if (!isPlatformBrowser(this.platformId) || !this.auth || !this.firestore) {
      return;
    }

    const fs = this.firestore;
    const user = toSignal(authState(this.auth));

    effect((onCleanup) => {
      const u = user();
      if (!u) {
        this.connectedState.set(false);
        this.entriesState.set([]);
        return;
      }
      const q = query(
        collection(fs, 'pushups'),
        where('userId', '==', u.uid),
        orderBy('timestamp', 'asc')
      );
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          this.connectedState.set(true);
          this.entriesState.set(
            snapshot.docs.map((d) => ({ _id: d.id, ...d.data() } as PushupRecord))
          );
        },
        () => this.connectedState.set(false)
      );
      onCleanup(unsub);
    });
  }
}
