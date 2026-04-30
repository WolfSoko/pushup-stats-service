import {
  computed,
  effect,
  inject,
  Injector,
  PLATFORM_ID,
  runInInjectionContext,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import {
  LeaderboardData,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardService,
} from '../api/leaderboard.service';

type LeaderboardState = {
  data: LeaderboardData | null;
  loading: boolean;
  error: string | null;
};

const initialState: LeaderboardState = {
  data: null,
  loading: false,
  error: null,
};

const EMPTY_ENTRIES: LeaderboardEntry[] = [];

export const LeaderboardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    _api: inject(LeaderboardService, { optional: true }),
    _isBrowser: isPlatformBrowser(inject(PLATFORM_ID)),
    _injector: inject(Injector),
  })),
  withComputed((store) => ({
    loaded: computed(() => store.data() !== null),
  })),
  withMethods(({ _api, ...store }) => ({
    async load(options?: { force?: boolean }): Promise<void> {
      if (store.loading()) return;
      if (store.loaded() && !options?.force) return;
      patchState(store, { loading: true, error: null });
      try {
        if (!_api) {
          patchState(store, {
            data: {
              daily: { top: [], current: null },
              weekly: { top: [], current: null },
              monthly: { top: [], current: null },
            },
            loading: false,
          });
          return;
        }
        const data = await _api.load();
        patchState(store, { data, loading: false });
      } catch (err) {
        patchState(store, {
          error: err instanceof Error ? err.message : String(err),
          loading: false,
        });
      }
    },

    entriesForPeriod(
      period: () => LeaderboardPeriod
    ): () => LeaderboardEntry[] {
      return computed(() => {
        const data = store.data();
        if (!data) return EMPTY_ENTRIES;
        return data[period()].top;
      });
    },

    currentUserForPeriod(
      period: () => LeaderboardPeriod
    ): () => LeaderboardEntry | null {
      return computed(() => {
        const data = store.data();
        if (!data) return null;
        return data[period()].current;
      });
    },
  })),
  withHooks({
    onInit(store) {
      // Live-refresh whenever the precomputed `leaderboards/current` doc
      // changes. The snapshot only mutates after a Cloud Function rewrite
      // (typically minutes), so re-running `load({ force: true })` is cheap
      // and avoids a stale leaderboard between manual refreshes.
      if (!store._isBrowser || !store._api) return;
      const api = store._api;
      runInInjectionContext(store._injector, () => {
        effect((onCleanup) => {
          const sub = api.observeSnapshot().subscribe({
            next: () => {
              void store.load({ force: true });
            },
            error: () => {
              /* swallow — leaderboard is non-critical, fall back to one-shot load */
            },
          });
          onCleanup(() => sub.unsubscribe());
        });
      });
    },
  })
);
