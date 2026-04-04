import { isPlatformBrowser } from '@angular/common';
import { effect, inject, PLATFORM_ID } from '@angular/core';
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
import {
  patchState,
  signalStore,
  withHooks,
  withProps,
  withState,
} from '@ngrx/signals';

type LiveDataState = {
  entries: PushupRecord[];
  connected: boolean;
  updateTick: number;
};

export const LiveDataStore = signalStore(
  { providedIn: 'root' },
  withState<LiveDataState>({
    entries: [],
    connected: false,
    updateTick: 0,
  }),
  withProps(() => ({
    _isBrowser: isPlatformBrowser(inject(PLATFORM_ID)),
    _auth: isPlatformBrowser(inject(PLATFORM_ID))
      ? inject(Auth, { optional: true })
      : null,
    _firestore: isPlatformBrowser(inject(PLATFORM_ID))
      ? inject(Firestore, { optional: true })
      : null,
  })),
  withHooks({
    onInit(store) {
      if (!store._isBrowser || !store._auth || !store._firestore) {
        return;
      }

      const fs = store._firestore;
      const user = toSignal(authState(store._auth));

      effect((onCleanup) => {
        const u = user();
        if (!u) {
          patchState(store, { connected: false, entries: [], updateTick: 0 });
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
            patchState(store, {
              connected: true,
              entries: snapshot.docs.map(
                (d) => ({ _id: d.id, ...d.data() }) as PushupRecord
              ),
              updateTick: store.updateTick() + 1,
            });
          },
          () => patchState(store, { connected: false })
        );
        onCleanup(unsub);
      });
    },
  })
);
