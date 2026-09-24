import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

export type AppUpdateStatus = 'current' | 'ready' | 'unrecoverable';

export const AppUpdateStore = signalStore(
  { providedIn: 'root' },
  withState({
    status: 'current' as AppUpdateStatus,
    dismissed: false,
    routeBlocksUpdate: false,
  }),
  withComputed((store) => ({
    updatePending: computed(() => store.status() !== 'current'),
    bannerVisible: computed(() => {
      if (store.routeBlocksUpdate()) return false;
      if (store.status() === 'unrecoverable') return true;
      return store.status() === 'ready' && !store.dismissed();
    }),
  })),
  withMethods((store) => ({
    markReady(): void {
      // A broken cache outranks a fresh version: the unrecoverable notice
      // must not be downgraded into a dismissible one.
      if (store.status() === 'unrecoverable') return;
      patchState(store, { status: 'ready', dismissed: false });
    },
    markUnrecoverable(): void {
      patchState(store, { status: 'unrecoverable', dismissed: false });
    },
    dismiss(): void {
      if (store.status() !== 'ready') return;
      patchState(store, { dismissed: true });
    },
    setRouteBlocksUpdate(routeBlocksUpdate: boolean): void {
      patchState(store, { routeBlocksUpdate });
    },
  }))
);
