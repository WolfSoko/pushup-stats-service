import { computed, DestroyRef, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  patchState,
  signalStore,
  withComputed,
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
import { createKeyedBusyState } from '@pu-stats/ui';
import type { Subscription } from 'rxjs';

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
    /** Per exercise, so only the chip the user tapped shows a spinner. */
    busy: createKeyedBusyState<string>(),
  })),
  withComputed((store) => ({
    loaded: computed(() => Object.keys(store.data()).length > 0),
  })),
  withMethods(({ _api, busy, _isBrowser, _destroyRef, ...store }) => {
    // Tracks loads currently awaiting `_api.load(exerciseId)`, keyed by
    // exerciseId. The `loading` signal reflects "any load in flight" —
    // simpler than a per-exerciseId loading map and matches the
    // visible UI state (one global spinner per page).
    const inFlight = new Set<string>();
    // Exercises that should be re-fetched as soon as their current load
    // finishes — e.g. a snapshot live-reload fired while a slow load
    // was already running. Dropping these would silently lose updates.
    const reloadPending = new Set<string>();
    // One live listener per board, opened after its first load: a board
    // nobody opened costs no listener, and each snapshot rebuild lands
    // in the cache straight from the emitted doc.
    const live = new Map<string, Subscription>();
    _destroyRef.onDestroy(() => live.forEach((sub) => sub.unsubscribe()));

    function watch(boardId: string): void {
      if (!_api || !_isBrowser || live.has(boardId)) return;
      live.set(
        boardId,
        _api.observe(boardId).subscribe({
          next: (data) =>
            patchState(store, { data: { ...store.data(), [boardId]: data } }),
          error: () => {
            /* swallow — leaderboard is non-critical, keep the one-shot load */
          },
        })
      );
    }

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
        const data = await busy.run(exerciseId, () => _api.load(exerciseId));
        patchState(store, {
          data: { ...store.data(), [exerciseId]: data },
          loading: inFlight.size > 1,
        });
        watch(exerciseId);
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
  })
);
