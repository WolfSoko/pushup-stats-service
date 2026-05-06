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
import { LiveDataStore, StatsApiService } from '@pu-stats/data-access';
import { canonicalizePushupType, displayPushupType } from '@pu-stats/models';
import { AppDataFacade } from '../core/app-data.facade';

export interface PushupTypeFilterOption {
  /** Canonical filter key (catalog `id` for catalog matches, trimmed
   * raw string for custom user-typed types). */
  value: string;
  /** Locale-aware display string for the dropdown. */
  label: string;
}

type EntriesState = {
  from: string;
  to: string;
  source: string;
  type: string;
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
    rows: computed(() =>
      store._isBrowser
        ? store._live.entries()
        : (store._entriesResource.value() ?? [])
    ),
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
      // Canonicalize first so legacy "Diamond" and new "diamond" docs
      // collapse into one filter option. The dropdown then renders the
      // localized label while the selected value remains the canonical
      // key that drives `filteredRows`.
      const seen = new Map<string, PushupTypeFilterOption>();
      for (const row of store.rows()) {
        const value = canonicalizePushupType(row.type) || 'standard';
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
    filteredRows: computed(() => {
      const source = store.source();
      const type = store.type();
      const repsMin = store.repsMin();
      const repsMax = store.repsMax();
      const from = store.from();
      const to = store.to();

      return store.rows().filter((row) => {
        const date = row.timestamp.slice(0, 10);
        if (from && date < from) return false;
        if (to && date > to) return false;
        if (source && row.source !== source) return false;
        if (type) {
          const rowKey = canonicalizePushupType(row.type) || 'standard';
          if (rowKey !== type) return false;
        }
        if (repsMin !== null && row.reps < repsMin) return false;
        if (repsMax !== null && row.reps > repsMax) return false;
        return true;
      });
    }),
  })),
  withMethods(({ _api, _appData, _isBrowser, _entriesResource, ...store }) => ({
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
      id: string;
      timestamp: string;
      reps: number;
      sets?: number[];
      source?: string;
      type?: string;
    }): Promise<void> {
      patchState(store, {
        busyAction: 'update',
        busyId: payload.id,
        error: null,
      });
      try {
        await firstValueFrom(
          _api.updatePushup(payload.id, {
            timestamp: payload.timestamp,
            reps: payload.reps,
            ...(payload.sets !== undefined ? { sets: payload.sets } : {}),
            source: payload.source,
            type: payload.type,
          })
        );
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
    async deleteEntry(id: string): Promise<void> {
      patchState(store, { busyAction: 'delete', busyId: id, error: null });
      try {
        await firstValueFrom(_api.deletePushup(id));
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
  }))
);
