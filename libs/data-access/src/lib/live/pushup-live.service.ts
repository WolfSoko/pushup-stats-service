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

    const fs = this.firestore;
    const user = toSignal(authState(this.auth));

    effect((onCleanup) => {
      const u = user();
      if (!u) {
        this.connectedState.set(false);
        return;
      }
      const q = query(
        collection(fs, 'pushups'),
        where('userId', '==', u.uid),
        orderBy('timestamp', 'asc')
      );
      const unsub = onSnapshot(
        q,
        () => {
          this.connectedState.set(true);
          this.tick.update((v) => v + 1);
        },
        () => this.connectedState.set(false)
      );
      onCleanup(unsub);
    });
  }
}
