import { computed, DestroyRef, inject, PLATFORM_ID } from '@angular/core';
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
    _destroyRef: inject(DestroyRef),
  })),
  withComputed((store) => ({
    loaded: computed(() => store.data() !== null),
  })),
  withMethods(({ _api, ...store }) => {
    // Tracks whether a `load()` is currently awaiting `_api.load()`. The
    // `loading` signal flips synchronously inside the same tick, but using a
    // dedicated closure flag makes the "did another caller try to force a
    // reload while we were busy?" check explicit and decoupled from the
    // public state.
    let inFlight = false;
    let reloadPending = false;

    async function performLoad(): Promise<void> {
      inFlight = true;
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
      } finally {
        inFlight = false;
      }
    }

    return {
      async load(options?: { force?: boolean }): Promise<void> {
        // A previous load is mid-flight. If the caller insists on freshness
        // (snapshot live-reload, manual user refresh), remember that we owe
        // them another run after the current one finishes — otherwise live
        // updates that arrive during a slow load would be silently dropped.
        if (inFlight) {
          if (options?.force) reloadPending = true;
          return;
        }
        if (store.loaded() && !options?.force) return;

        await performLoad();

        if (reloadPending) {
          reloadPending = false;
          await performLoad();
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
    };
  }),
  withHooks({
    onInit(store) {
      // Live-refresh whenever the precomputed `leaderboards/current` doc
      // changes. The snapshot only mutates after a Cloud Function rewrite
      // (typically minutes), so re-running `load({ force: true })` is cheap
      // and avoids a stale leaderboard between manual refreshes.
      //
      // We subscribe directly (not via `effect`) so the listener attaches
      // synchronously at construction — tests can assert behaviour without
      // having to flush effects, and the cleanup is hooked into `DestroyRef`
      // for symmetric tear-down.
      if (!store._isBrowser || !store._api) return;
      const sub = store._api.observeSnapshot().subscribe({
        next: () => {
          void store.load({ force: true });
        },
        error: () => {
          /* swallow — leaderboard is non-critical, fall back to one-shot load */
        },
      });
      store._destroyRef.onDestroy(() => sub.unsubscribe());
    },
  })
);
