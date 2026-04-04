import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
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
  })),
  withComputed((store) => ({
    loaded: computed(() => store.data() !== null),
  })),
  withMethods(({ _api, ...store }) => ({
    async load(): Promise<void> {
      if (store.loading()) return;
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

    entriesForPeriod(period: () => LeaderboardPeriod): () => LeaderboardEntry[] {
      return computed(() => {
        const data = store.data();
        if (!data) return EMPTY_ENTRIES;
        return data[period()].top;
      });
    },

    currentUserForPeriod(period: () => LeaderboardPeriod): () => LeaderboardEntry | null {
      return computed(() => {
        const data = store.data();
        if (!data) return null;
        return data[period()].current;
      });
    },
  }))
);
