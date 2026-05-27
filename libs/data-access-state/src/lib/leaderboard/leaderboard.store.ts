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
  LEADERBOARD_PUSHUP_ID,
  LeaderboardData,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardService,
} from '@pu-stats/data-access';

type LeaderboardState = {
  /**
   * Per-exercise cache of ranked buckets. Keys are exerciseIds
   * (`LEADERBOARD_PUSHUP_ID` for the legacy pushup leaderboard, every
   * other catalog id for `exerciseEntries`-backed rankings).
   * Switching between exercises is cheap once their entry is populated;
   * the live-snapshot reload only invalidates the pushup entry because
   * that's the only one the Cloud Function ranker writes.
   */
  data: Record<string, LeaderboardData>;
  loading: boolean;
  error: string | null;
};

const initialState: LeaderboardState = {
  data: {},
  loading: false,
  error: null,
};

const EMPTY_ENTRIES: LeaderboardEntry[] = [];
const EMPTY_DATA: LeaderboardData = {
  daily: { top: [], current: null },
  last7: { top: [], current: null },
  last30: { top: [], current: null },
  allTime: { top: [], current: null },
  updatedAt: null,
};

export const LeaderboardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    _api: inject(LeaderboardService, { optional: true }),
    _isBrowser: isPlatformBrowser(inject(PLATFORM_ID)),
    _destroyRef: inject(DestroyRef),
  })),
  withComputed((store) => ({
    loaded: computed(() => Object.keys(store.data()).length > 0),
  })),
  withMethods(({ _api, ...store }) => {
    // Tracks loads currently awaiting `_api.load(exerciseId)`, keyed by
    // exerciseId. The `loading` signal reflects "any load in flight" —
    // simpler than a per-exerciseId loading map and matches the
    // visible UI state (one global spinner per page).
    const inFlight = new Set<string>();
    // Exercises that should be re-fetched as soon as their current load
    // finishes — e.g. a snapshot live-reload fired while a slow load
    // was already running. Dropping these would silently lose updates.
    const reloadPending = new Set<string>();

    async function performLoad(exerciseId: string): Promise<void> {
      inFlight.add(exerciseId);
      patchState(store, { loading: true, error: null });
      try {
        if (!_api) {
          patchState(store, {
            data: { ...store.data(), [exerciseId]: EMPTY_DATA },
            loading: inFlight.size > 1,
          });
          return;
        }
        const data = await _api.load(exerciseId);
        patchState(store, {
          data: { ...store.data(), [exerciseId]: data },
          loading: inFlight.size > 1,
        });
      } catch (err) {
        patchState(store, {
          error: err instanceof Error ? err.message : String(err),
          loading: inFlight.size > 1,
        });
      } finally {
        inFlight.delete(exerciseId);
      }
    }

    return {
      /**
       * Ensures the per-exercise leaderboard is loaded. No-op when the
       * exerciseId already has cached data unless `force: true`. The
       * live-snapshot subscription uses `force` to invalidate stale
       * caches; UI navigation between exercises typically doesn't.
       */
      async load(
        exerciseId: string = LEADERBOARD_PUSHUP_ID,
        options?: { force?: boolean }
      ): Promise<void> {
        // A previous load for this exerciseId is mid-flight. If the
        // caller insists on freshness, queue a follow-up — otherwise
        // collapsing into the in-flight call is fine.
        if (inFlight.has(exerciseId)) {
          if (options?.force) reloadPending.add(exerciseId);
          return;
        }
        if (store.data()[exerciseId] && !options?.force) return;

        await performLoad(exerciseId);

        if (reloadPending.has(exerciseId)) {
          reloadPending.delete(exerciseId);
          await performLoad(exerciseId);
        }
      },

      entriesForPeriod(
        exerciseId: () => string,
        period: () => LeaderboardPeriod
      ): () => LeaderboardEntry[] {
        return computed(() => {
          const bucket = store.data()[exerciseId()];
          if (!bucket) return EMPTY_ENTRIES;
          return bucket[period()].top;
        });
      },

      currentUserForPeriod(
        exerciseId: () => string,
        period: () => LeaderboardPeriod
      ): () => LeaderboardEntry | null {
        return computed(() => {
          const bucket = store.data()[exerciseId()];
          if (!bucket) return null;
          return bucket[period()].current;
        });
      },

      /**
       * Reactive selector for the wall-clock timestamp at which the
       * currently displayed buckets were produced. `null` until the
       * exercise has been loaded at least once — the template hides the
       * freshness line in that case so an empty cache doesn't surface
       * "Zuletzt aktualisiert: —".
       */
      lastUpdatedFor(exerciseId: () => string): () => Date | null {
        return computed(() => store.data()[exerciseId()]?.updatedAt ?? null);
      },
    };
  }),
  withHooks({
    onInit(store) {
      // Live-refresh whenever either precomputed leaderboard doc
      // changes. We subscribe directly (not via `effect`) so the
      // listeners attach synchronously at construction — tests can
      // assert behaviour without flushing effects, and cleanup is
      // hooked into `DestroyRef` for symmetric tear-down.
      if (!store._isBrowser || !store._api) return;

      // `leaderboards/current` mutates only after the pushup ranker
      // rewrites it (every 15 min + on every pushups write).
      const pushupSub = store._api.observeSnapshot().subscribe({
        next: () => {
          void store.load(LEADERBOARD_PUSHUP_ID, { force: true });
        },
        error: () => {
          /* swallow — leaderboard is non-critical, fall back to one-shot load */
        },
      });
      store._destroyRef.onDestroy(() => pushupSub.unsubscribe());

      // `leaderboards/exercises` mutates after the per-exercise ranker
      // rewrites it. Without this subscription a user who opens the
      // page before the first post-deploy snapshot exists would cache
      // an empty bucket and never see it refill, because
      // `load(exerciseId)` short-circuits on cache hits. Force-reload
      // every already-cached non-pushup exerciseId on each emission so
      // the visible leaderboard stays fresh; the pushup sub above
      // owns the pushup bucket's invalidation.
      const exerciseSub = store._api.observeExerciseSnapshot().subscribe({
        next: () => {
          const cachedExerciseIds = Object.keys(store.data()).filter(
            (id) => id !== LEADERBOARD_PUSHUP_ID
          );
          for (const exerciseId of cachedExerciseIds) {
            void store.load(exerciseId, { force: true });
          }
        },
        error: () => {
          /* swallow — same rationale as the pushup sub */
        },
      });
      store._destroyRef.onDestroy(() => exerciseSub.unsubscribe());
    },
  })
);
