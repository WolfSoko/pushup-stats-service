import { isPlatformBrowser } from '@angular/common';
import { computed, inject, PLATFORM_ID, resource } from '@angular/core';
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
    _isBrowser: isPlatformBrowser(inject(PLATFORM_ID)),
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
    typeOptions: computed(() =>
      [
        ...new Set(
          store
            .rows()
            .map((x) => x.type || 'Standard')
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b))
    ),
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
        if (type && (row.type || 'Standard') !== type) return false;
        if (repsMin !== null && row.reps < repsMin) return false;
        if (repsMax !== null && row.reps > repsMax) return false;
        return true;
      });
    }),
  })),
  withMethods(({ _api, _isBrowser, _entriesResource, ...store }) => ({
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
            source: payload.source,
            type: payload.type,
          })
        );
        if (!_isBrowser) _entriesResource.reload();
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
