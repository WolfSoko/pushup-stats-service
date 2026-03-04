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
import { EMPTY, switchMap } from 'rxjs';

/**
 * Browser-only live update ticker for pushups via Firestore real-time updates.
 */
@Injectable({ providedIn: 'root' })
export class PushupLiveService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(Auth, { optional: true });
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly tick = signal(0);
  private readonly connectedState = signal(false);

  readonly updateTick: Signal<number> = this.tick.asReadonly();
  readonly connected: Signal<boolean> = this.connectedState.asReadonly();

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
            return EMPTY;
          }
          const q = query(
            collection(firestore, 'pushups'),
            where('userId', '==', user.uid),
            orderBy('timestamp', 'asc')
          );
          return collectionData(q);
        })
      )
      .subscribe({
        next: () => {
          this.connectedState.set(true);
          this.tick.update((v) => v + 1);
        },
        error: () => {
          this.connectedState.set(false);
        },
      });

    destroyRef.onDestroy(() => sub.unsubscribe());
  }
}
