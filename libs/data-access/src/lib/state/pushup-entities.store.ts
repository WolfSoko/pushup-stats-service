import { computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  PushupCreate,
  PushupRecord,
  PushupUpdate,
  StatsFilter,
} from '@pu-stats/models';
import { StatsApiService } from '../api/stats-api.service';

type PushupEntitiesState = {
  entityMap: Record<string, PushupRecord>;
  ids: string[];
  filter: StatsFilter;
  loading: boolean;
  error: string | null;
  busyAction: 'create' | 'update' | 'delete' | null;
  busyId: string | null;
};

const initialState: PushupEntitiesState = {
  entityMap: {},
  ids: [],
  filter: {},
  loading: false,
  error: null,
  busyAction: null,
  busyId: null,
};

function normalizeRows(rows: PushupRecord[]): {
  entityMap: Record<string, PushupRecord>;
  ids: string[];
} {
  const sorted = [...rows].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );
  const entityMap: Record<string, PushupRecord> = {};
  const ids: string[] = [];

  for (const row of sorted) {
    if (!row._id) continue;
    entityMap[row._id] = row;
    ids.push(row._id);
  }

  return { entityMap, ids };
}

export const PushupEntitiesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    entries: computed(() =>
      store
        .ids()
        .map((id) => store.entityMap()[id])
        .filter(Boolean)
    ),
    entriesDesc: computed(() =>
      [...store.ids()]
        .reverse()
        .map((id) => store.entityMap()[id])
        .filter(Boolean)
    ),
    sourceOptions: computed(
      () =>
        [
          ...new Set(
            store
              .ids()
              .map((id) => store.entityMap()[id]?.source)
              .filter(Boolean)
          ),
        ].sort((a, b) => String(a).localeCompare(String(b))) as string[]
    ),
    typeOptions: computed(
      () =>
        [
          ...new Set(
            store
              .ids()
              .map((id) => store.entityMap()[id]?.type || 'Standard')
              .filter(Boolean)
          ),
        ].sort((a, b) => String(a).localeCompare(String(b))) as string[]
    ),
  })),
  withMethods((store) => {
    const api = inject(StatsApiService);

    const loadWithFilter = async (filter: StatsFilter) => {
      patchState(store, { loading: true, error: null, filter });
      try {
        const rows = await firstValueFrom(api.listPushups(filter));
        const normalized = normalizeRows(rows ?? []);
        patchState(store, {
          ...normalized,
          loading: false,
        });
      } catch {
        patchState(store, {
          loading: false,
          error: 'Einträge konnten nicht geladen werden.',
        });
      }
    };

    return {
      async load(filter: StatsFilter = {}) {
        await loadWithFilter(filter);
      },

      async reload() {
        await loadWithFilter(store.filter());
      },

      setFilter(filter: StatsFilter) {
        patchState(store, { filter });
      },

      async setFilterAndLoad(filter: StatsFilter) {
        await loadWithFilter(filter);
      },

      async create(payload: PushupCreate) {
        patchState(store, { busyAction: 'create', busyId: null });
        try {
          await firstValueFrom(api.createPushup(payload));
          await loadWithFilter(store.filter());
        } finally {
          patchState(store, { busyAction: null, busyId: null });
        }
      },

      async update(id: string, payload: PushupUpdate) {
        patchState(store, { busyAction: 'update', busyId: id });
        try {
          await firstValueFrom(api.updatePushup(id, payload));
          await loadWithFilter(store.filter());
        } finally {
          patchState(store, { busyAction: null, busyId: null });
        }
      },

      async remove(id: string) {
        patchState(store, { busyAction: 'delete', busyId: id });
        try {
          await firstValueFrom(api.deletePushup(id));
          await loadWithFilter(store.filter());
        } finally {
          patchState(store, { busyAction: null, busyId: null });
        }
      },
    };
  })
);
