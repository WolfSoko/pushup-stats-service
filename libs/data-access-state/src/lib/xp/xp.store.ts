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
  userXp: UserXp | null;
  /** XP booked per entry id, mirrored from the ledger. */
  ledger: ReadonlyMap<string, number>;
  /** True once the aggregate listener delivered its first snapshot. */
  loaded: boolean;
};

const EMPTY_LEDGER: ReadonlyMap<string, number> = new Map();

export const XpStore = signalStore(
  { providedIn: 'root' },
  withState<XpState>({
    config: null,
    userXp: null,
    ledger: EMPTY_LEDGER,
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
  withComputed((store) => ({
    totalXp: computed(() => store.userXp()?.total ?? 0),
    progress: computed(() => levelProgress(store.userXp()?.total ?? 0)),
  })),
  withMethods((store) => ({
    rateFor(exerciseId: string): number {
      return xpRateFor(exerciseId, store.config());
    },
    /** What an entry is worth at today's rates — the success dialog's number. */
    previewXp(entry: XpEntryInput): number {
      return xpForEntry(entry, xpRateFor(entry.exerciseId, store.config()));
    },
    /**
     * Booked XP of an entry, falling back to today's rate while the
     * trigger has not booked it yet.
     */
    xpOfEntry(entryId: string, entry: XpEntryInput): number {
      const booked = store.ledger().get(entryId);
      return (
        booked ?? xpForEntry(entry, xpRateFor(entry.exerciseId, store.config()))
      );
    },
  })),
  withHooks({
    onInit(store) {
      if (!store._isBrowser) return;
      const configSub = store._api
        .watchConfig()
        .subscribe({ next: (config) => patchState(store, { config }) });
      store._destroyRef.onDestroy(() => configSub.unsubscribe());

      if (!store._auth) return;
      const user = toSignal(authState(store._auth));
      effect((onCleanup) => {
        const uid = user()?.uid ?? null;
        patchState(store, {
          userXp: null,
          ledger: EMPTY_LEDGER,
          loaded: false,
        });
        if (!uid) return;
        const subs = [
          store._api.watchUserXp(uid).subscribe({
            next: (userXp) => patchState(store, { userXp, loaded: true }),
            error: () => patchState(store, { loaded: true }),
          }),
          store._api
            .watchLedger(uid)
            .subscribe({ next: (ledger) => patchState(store, { ledger }) }),
        ];
        onCleanup(() => subs.forEach((s) => s.unsubscribe()));
      });
    },
  })
);
