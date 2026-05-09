import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  inject,
  LOCALE_ID,
  PLATFORM_ID,
  resource,
} from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ExerciseFirestoreService,
  LiveDataStore,
  StatsApiService,
} from '@pu-stats/data-access';
import {
  canonicalizePushupType,
  displayPushupType,
  exerciseEntryToUnified,
  pushupRecordToUnified,
  UnifiedEntry,
  UnifiedEntryFilterKey,
  unifiedEntryFilterKey,
} from '@pu-stats/models';
import { AppDataFacade } from '../core/app-data.facade';

export interface PushupTypeFilterOption {
  /** Canonical filter key (catalog `id` for catalog matches, trimmed
   * raw string for custom user-typed types). */
  value: string;
  /** Locale-aware display string for the dropdown. */
  label: string;
}

export interface ExerciseKindFilterOption {
  value: UnifiedEntryFilterKey;
  label: string;
}

type EntriesState = {
  from: string;
  to: string;
  source: string;
  type: string;
  /**
   * Active exercise-kind filter (multi-select). Empty array = show all
   * exercises. Pushup entries collapse into the single `'pushup'`
   * bucket; non-pushup entries use their `exerciseId`. Pushup variant
   * filtering keeps using {@link EntriesState.type}.
   */
  kinds: ReadonlyArray<UnifiedEntryFilterKey>;
  repsMin: number | null;
  repsMax: number | null;
  busyAction: 'create' | 'update' | 'delete' | null;
  busyId: string | null;
  error: string | null;
};

const initialState: EntriesState = {
  from: '',
  to: '',
  source: '',
  type: '',
  kinds: [],
  repsMin: null,
  repsMax: null,
  busyAction: null,
  busyId: null,
  error: null,
};

export const EntriesStore = signalStore(
  withState(initialState),
  withProps(() => ({
    _api: inject(StatsApiService),
    _exerciseService: inject(ExerciseFirestoreService),
    _live: inject(LiveDataStore),
    _appData: inject(AppDataFacade),
    _isBrowser: isPlatformBrowser(inject(PLATFORM_ID)),
    _locale: inject(LOCALE_ID) as string,
  })),
  withProps((store) => ({
    _entriesResource: resource({
      params: () => ({
        from: store.from() || undefined,
        to: store.to() || undefined,
      }),
      loader: async ({ params }) =>
        firstValueFrom(store._api.listPushups(params)),
    }),
  })),
  withComputed((store) => ({
    /**
     * Unified rows from both Firestore collections. Browser uses the
     * live snapshots from {@link LiveDataStore}; SSR falls back to the
     * pushup REST endpoint (exerciseEntries are skipped on SSR since
     * the History page doesn't drive SEO).
     */
    rows: computed<UnifiedEntry[]>(() => {
      if (store._isBrowser) {
        const pushups = store._live.entries().map(pushupRecordToUnified);
        const exercises = store._live
          .exerciseEntries()
          .map(exerciseEntryToUnified);
        return [...pushups, ...exercises].sort((a, b) =>
          a.timestamp.localeCompare(b.timestamp)
        );
      }
      const ssrPushups = (store._entriesResource.value() ?? []).map(
        pushupRecordToUnified
      );
      return ssrPushups;
    }),
    /**
     * True once the entries data source has produced its first result.
     * In the browser this gates on the live Firestore listener (which
     * starts with an empty array before the first snapshot arrives,
     * so an unguarded empty-state CTA flickers on every cold load).
     * On the server it gates on the REST resource resolving.
     */
    entriesLoaded: computed(() =>
      store._isBrowser
        ? store._live.connected()
        : store._entriesResource.status() === 'resolved'
    ),
  })),
  withComputed((store) => ({
    sourceOptions: computed(() =>
      [
        ...new Set(
          store
            .rows()
            .map((x) => x.source)
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b))
    ),
    typeOptions: computed<PushupTypeFilterOption[]>(() => {
      const seen = new Map<string, PushupTypeFilterOption>();
      for (const row of store.rows()) {
        if (row.kind !== 'pushup') continue;
        const value = canonicalizePushupType(row.variantType) || 'standard';
        if (seen.has(value)) continue;
        seen.set(value, {
          value,
          label: displayPushupType(value, store._locale),
        });
      }
      return [...seen.values()].sort((a, b) =>
        a.label.localeCompare(b.label, store._locale)
      );
    }),
    /**
     * Distinct exercise-kind keys present in the current row set, used
     * to populate the new "Übung" multi-select. The locale-aware
     * `label` is filled in by the caller (see
     * `EntriesPageComponent.kindFilterOptions`) since `$localize` calls
     * belong to the Angular DI/template layer, not this signal store.
     */
    kindOptionsRaw: computed<UnifiedEntryFilterKey[]>(() => {
      const seen = new Set<UnifiedEntryFilterKey>();
      for (const row of store.rows()) {
        seen.add(unifiedEntryFilterKey(row));
      }
      return [...seen].sort((a, b) => {
        // Pushup first (legacy), then catalog ids alphabetically.
        if (a === 'pushup') return -1;
        if (b === 'pushup') return 1;
        return a.localeCompare(b);
      });
    }),
    filteredRows: computed<UnifiedEntry[]>(() => {
      const source = store.source();
      const type = store.type();
      const kinds = store.kinds();
      const repsMin = store.repsMin();
      const repsMax = store.repsMax();
      const from = store.from();
      const to = store.to();
      const kindSet = kinds.length > 0 ? new Set(kinds) : null;

      return store.rows().filter((row) => {
        const date = row.timestamp.slice(0, 10);
        if (from && date < from) return false;
        if (to && date > to) return false;
        if (source && row.source !== source) return false;
        if (kindSet && !kindSet.has(unifiedEntryFilterKey(row))) return false;
        if (type) {
          // The variant dropdown is pushup-only; selecting it
          // implicitly hides every non-pushup row regardless of the
          // exercise-kind filter.
          if (row.kind !== 'pushup') return false;
          const rowKey = canonicalizePushupType(row.variantType) || 'standard';
          if (rowKey !== type) return false;
        }
        if (repsMin !== null && row.reps < repsMin) return false;
        if (repsMax !== null && row.reps > repsMax) return false;
        return true;
      });
    }),
  })),
  withMethods(
    ({
      _api,
      _exerciseService,
      _appData,
      _isBrowser,
      _entriesResource,
      ...store
    }) => ({
      setFrom(value: string): void {
        patchState(store, { from: value });
      },
      setTo(value: string): void {
        patchState(store, { to: value });
      },
      setSource(value: string): void {
        patchState(store, { source: value });
      },
      setType(value: string): void {
        patchState(store, { type: value });
      },
      setKinds(value: ReadonlyArray<UnifiedEntryFilterKey>): void {
        patchState(store, { kinds: value });
      },
      setRepsMin(value: number | null): void {
        patchState(store, { repsMin: value });
      },
      setRepsMax(value: number | null): void {
        patchState(store, { repsMax: value });
      },
      async createEntry(payload: {
        timestamp: string;
        reps: number;
        sets?: number[];
        source?: string;
        type?: string;
      }): Promise<void> {
        patchState(store, { busyAction: 'create', busyId: null, error: null });
        try {
          await firstValueFrom(_api.createPushup(payload));
          if (!_isBrowser) _entriesResource.reload();
          _appData.reloadAfterMutation();
        } catch (err) {
          patchState(store, {
            error: err instanceof Error ? err.message : String(err),
          });
        } finally {
          patchState(store, { busyAction: null, busyId: null });
        }
      },
      async updateEntry(payload: {
        kind: 'pushup' | 'exercise';
        id: string;
        exerciseId?: string;
        timestamp: string;
        reps: number;
        sets?: number[];
        source?: string;
        type?: string;
        variantId?: string;
      }): Promise<void> {
        patchState(store, {
          busyAction: 'update',
          busyId: payload.id,
          error: null,
        });
        try {
          if (payload.kind === 'pushup') {
            await firstValueFrom(
              _api.updatePushup(payload.id, {
                timestamp: payload.timestamp,
                reps: payload.reps,
                ...(payload.sets !== undefined ? { sets: payload.sets } : {}),
                source: payload.source,
                type: payload.type,
              })
            );
          } else {
            if (!payload.exerciseId) {
              throw new Error(
                'updateEntry: exerciseId is required for kind="exercise"'
              );
            }
            await firstValueFrom(
              _exerciseService.updateEntry(payload.id, payload.exerciseId, {
                timestamp: payload.timestamp,
                reps: payload.reps,
                ...(payload.sets !== undefined ? { sets: payload.sets } : {}),
                ...(payload.source !== undefined
                  ? { source: payload.source }
                  : {}),
                ...(payload.variantId !== undefined
                  ? { variantId: payload.variantId }
                  : {}),
              })
            );
          }
          if (!_isBrowser) _entriesResource.reload();
          _appData.reloadAfterMutation();
        } catch (err) {
          patchState(store, {
            error: err instanceof Error ? err.message : String(err),
          });
        } finally {
          patchState(store, { busyAction: null, busyId: null });
        }
      },
      async deleteEntry(payload: {
        kind: 'pushup' | 'exercise';
        id: string;
      }): Promise<void> {
        patchState(store, {
          busyAction: 'delete',
          busyId: payload.id,
          error: null,
        });
        try {
          if (payload.kind === 'pushup') {
            await firstValueFrom(_api.deletePushup(payload.id));
          } else {
            await firstValueFrom(_exerciseService.deleteEntry(payload.id));
          }
          if (!_isBrowser) _entriesResource.reload();
          _appData.reloadAfterMutation();
        } catch (err) {
          patchState(store, {
            error: err instanceof Error ? err.message : String(err),
          });
        } finally {
          patchState(store, { busyAction: null, busyId: null });
        }
      },
    })
  )
);
