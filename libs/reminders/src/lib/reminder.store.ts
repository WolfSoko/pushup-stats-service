import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserConfigApiService } from '@pu-stats/data-access';
import { ReminderConfig } from '@pu-stats/models';
import { ReminderPermissionService } from './reminder-permission.service';

export type { ReminderConfig };

type ReminderState = {
  config: ReminderConfig | null;
  loading: boolean;
  error: Error | null;
};

const initialState: ReminderState = {
  config: null,
  loading: false,
  error: null,
};

const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  enabled: false,
  intervalMinutes: 60,
  quietHours: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
  language: 'de',
};

export const ReminderStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    _api: inject(UserConfigApiService),
    _permissionService: inject(ReminderPermissionService),
  })),
  withComputed((store) => ({
    permissionStatus: computed(() => store._permissionService.status()),
  })),
  withMethods(({ _api, _permissionService: _ps, ...store }) => ({
    async loadConfig(userId: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const config = await firstValueFrom(_api.getConfig(userId));
        patchState(store, {
          config: config?.reminder ?? null,
          loading: false,
        });
      } catch (err) {
        patchState(store, {
          error: err instanceof Error ? err : new Error(String(err)),
          loading: false,
        });
      }
    },

    async saveConfig(userId: string, config: ReminderConfig): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        await firstValueFrom(_api.updateConfig(userId, { reminder: config }));
        patchState(store, { config, loading: false });
      } catch (err) {
        patchState(store, {
          error: err instanceof Error ? err : new Error(String(err)),
          loading: false,
        });
      }
    },

    async resetConfig(userId: string): Promise<void> {
      const reset: ReminderConfig = { ...DEFAULT_REMINDER_CONFIG };
      patchState(store, { loading: true, error: null });
      try {
        await firstValueFrom(_api.updateConfig(userId, { reminder: reset }));
        patchState(store, { config: reset, loading: false });
      } catch (err) {
        patchState(store, {
          error: err instanceof Error ? err : new Error(String(err)),
          loading: false,
        });
      }
    },
  }))
);
