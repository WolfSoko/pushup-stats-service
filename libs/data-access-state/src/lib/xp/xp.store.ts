import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, authState } from '@angular/fire/auth';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { XpApiService } from '@pu-stats/data-access';
import {
  levelProgress,
  xpForEntry,
  xpRateFor,
  type UserXp,
  type XpConfig,
  type XpEntryInput,
} from '@pu-stats/models';

type XpState = {
  config: XpConfig | null;
  /** True once the rates listener delivered its first snapshot. */
  configLoaded: boolean;
  userXp: UserXp | null;
  /** True once the aggregate listener delivered its first snapshot. */
  loaded: boolean;
};

/**
 * App-wide XP state: the admin rates and the signed-in user's aggregate —
 * two single-doc listeners. The per-entry ledger is only needed by the
 * analysis page, which listens to its own date range.
 */
export const XpStore = signalStore(
  { providedIn: 'root' },
  withState<XpState>({
    config: null,
    configLoaded: false,
    userXp: null,
    loaded: false,
  }),
  withProps(() => {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    return {
      _isBrowser: isBrowser,
      _auth: isBrowser ? inject(Auth, { optional: true }) : null,
      _api: inject(XpApiService),
      _destroyRef: inject(DestroyRef),
    };
  }),
  withComputed((store) => {
    const progress = computed(() => levelProgress(store.userXp()?.total ?? 0));
    return { progress, totalXp: computed(() => progress().totalXp) };
  }),
  withMethods((store) => ({
    /** What an entry is worth at today's rates. */
    previewXp(entry: XpEntryInput): number {
      return xpForEntry(entry, xpRateFor(entry.exerciseId, store.config()));
    },
  })),
  withHooks({
    onInit(store) {
      if (!store._isBrowser) return;
      const configSub = store._api.watchConfig().subscribe({
        next: (config) => patchState(store, { config, configLoaded: true }),
        error: () => patchState(store, { configLoaded: true }),
      });
      store._destroyRef.onDestroy(() => configSub.unsubscribe());

      if (!store._auth) return;
      const user = toSignal(authState(store._auth));
      effect((onCleanup) => {
        const uid = user()?.uid ?? null;
        patchState(store, { userXp: null, loaded: false });
        if (!uid) return;
        const sub = store._api.watchUserXp(uid).subscribe({
          next: (userXp) => patchState(store, { userXp, loaded: true }),
          error: () => patchState(store, { loaded: true }),
        });
        onCleanup(() => sub.unsubscribe());
      });
    },
  })
);
