import { computed, inject, LOCALE_ID } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { UserContextService } from '@pu-auth/auth';
import { ExerciseFirestoreService } from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import {
  canonicalizePushupType,
  displayPushupType,
  exerciseEntryToUnified,
  type UnifiedEntry,
  type UnifiedEntryFilterKey,
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
    _exerciseService: inject(ExerciseFirestoreService),
    _live: inject(LiveDataStore),
    _appData: inject(AppDataFacade),
    _userContext: inject(UserContextService),
    _locale: inject(LOCALE_ID) as string,
  })),
  withComputed((store) => ({
    rows: computed<UnifiedEntry[]>(() =>
      store._live
        .exerciseEntries()
        .map(exerciseEntryToUnified)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    ),
    entriesLoaded: computed(() => store._live.connected()),
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
        if (row.exerciseId !== 'pushup') continue;
        const value = canonicalizePushupType(row.variantId ?? '') || 'standard';
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
          if (row.exerciseId !== 'pushup') return false;
          const rowKey =
            canonicalizePushupType(row.variantId ?? '') || 'standard';
          if (rowKey !== type) return false;
        }
        if (repsMin !== null && row.reps < repsMin) return false;
        if (repsMax !== null && row.reps > repsMax) return false;
        return true;
      });
    }),
  })),
  withMethods(({ _exerciseService, _appData, _userContext, ...store }) => ({
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
      kind: 'pushup' | 'exercise';
      timestamp: string;
      reps?: number;
      sets?: number[];
      durationSec?: number;
      distanceM?: number;
      source?: string;
      type?: string;
      exerciseId?: string;
      variantId?: string;
    }): Promise<void> {
      patchState(store, { busyAction: 'create', busyId: null, error: null });
      try {
        const exerciseId =
          payload.kind === 'pushup' ? 'pushup' : payload.exerciseId;
        if (!exerciseId) {
          throw new Error(
            'createEntry: exerciseId is required for kind="exercise"'
          );
        }
        const userId = _userContext.userIdSafe();
        if (!userId) {
          throw new Error('createEntry: missing user id');
        }
        await firstValueFrom(
          _exerciseService.createEntry(userId, {
            exerciseId,
            timestamp: payload.timestamp,
            ...(payload.reps !== undefined ? { reps: payload.reps } : {}),
            ...(payload.sets !== undefined ? { sets: payload.sets } : {}),
            ...(payload.durationSec !== undefined
              ? { durationSec: payload.durationSec }
              : {}),
            ...(payload.distanceM !== undefined
              ? { distanceM: payload.distanceM }
              : {}),
            ...(payload.source !== undefined ? { source: payload.source } : {}),
            ...(payload.variantId ? { variantId: payload.variantId } : {}),
          })
        );
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
      reps?: number;
      sets?: number[];
      durationSec?: number;
      distanceM?: number;
      source?: string;
      type?: string;
      variantId?: string | null;
    }): Promise<void> {
      patchState(store, {
        busyAction: 'update',
        busyId: payload.id,
        error: null,
      });
      try {
        const exerciseId =
          payload.kind === 'pushup' ? 'pushup' : payload.exerciseId;
        if (!exerciseId) {
          throw new Error(
            'updateEntry: exerciseId is required for kind="exercise"'
          );
        }
        await firstValueFrom(
          _exerciseService.updateEntry(payload.id, exerciseId, {
            timestamp: payload.timestamp,
            ...(payload.reps !== undefined ? { reps: payload.reps } : {}),
            ...(payload.durationSec !== undefined
              ? { durationSec: payload.durationSec }
              : {}),
            ...(payload.distanceM !== undefined
              ? { distanceM: payload.distanceM }
              : {}),
            ...(payload.sets !== undefined ? { sets: payload.sets } : {}),
            ...(payload.source !== undefined ? { source: payload.source } : {}),
            ...(payload.variantId !== undefined
              ? { variantId: payload.variantId }
              : {}),
          })
        );
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
        await firstValueFrom(_exerciseService.deleteEntry(payload.id));
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
