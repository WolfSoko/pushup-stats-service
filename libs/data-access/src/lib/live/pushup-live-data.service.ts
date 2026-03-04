import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  Signal,
  inject,
  signal,
} from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  collectionData,
  orderBy,
  query,
  where,
} from '@angular/fire/firestore';
import { PushupRecord } from '@pu-stats/models';
import { EMPTY, switchMap } from 'rxjs';

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

    const destroyRef = inject(DestroyRef);
    const firestore = this.firestore;

    const sub = authState(this.auth)
      .pipe(
        switchMap((user) => {
          if (!user) {
            this.connectedState.set(false);
            this.entriesState.set([]);
            return EMPTY;
          }
          const q = query(
            collection(firestore, 'pushups'),
            where('userId', '==', user.uid),
            orderBy('timestamp', 'asc')
          );
          return collectionData<PushupRecord>(q, { idField: '_id' });
        })
      )
      .subscribe({
        next: (records) => {
          this.connectedState.set(true);
          this.entriesState.set(records);
        },
        error: () => {
          this.connectedState.set(false);
        },
      });

    destroyRef.onDestroy(() => sub.unsubscribe());
  }
}
