import { computed, inject, resource } from '@angular/core';
import {
  signalStore,
  withComputed,
  withMethods,
  withProps,
} from '@ngrx/signals';
import { UserContextService } from '@pu-auth/auth';
import { UserConfigApiService } from '@pu-stats/data-access';
import { QuickAddConfig, UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';

/**
 * Root-level store for user config (daily/weekly/monthly goals, display name,
 * consent, ui flags). Single source of truth — consumed by the app toolbar,
 * dashboard and settings page so that edits made in one place propagate
 * reactively to the others without requiring a full reload.
 */
export const UserConfigStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({
    _api: inject(UserConfigApiService),
    _user: inject(UserContextService),
  })),
  withProps((store) => ({
    configResource: resource({
      params: () => ({ userId: store._user.userIdSafe() }),
      loader: async ({ params }) => {
        if (!params.userId) return null;
        return firstValueFrom(store._api.getConfig(params.userId));
      },
    }),
  })),
  withComputed((store) => ({
    config: computed<UserConfig | null>(
      () => store.configResource.value() ?? null
    ),
    dailyGoal: computed(() => store.configResource.value()?.dailyGoal ?? 0),
    weeklyGoal: computed(() => store.configResource.value()?.weeklyGoal ?? 0),
    monthlyGoal: computed(() => store.configResource.value()?.monthlyGoal ?? 0),
    quickAdds: computed<QuickAddConfig[]>(
      () => store.configResource.value()?.ui?.quickAdds ?? []
    ),
  })),
  withMethods((store) => ({
    async save(patch: UserConfigUpdate): Promise<UserConfig> {
      const userId = store._user.userIdSafe();
      const result = await firstValueFrom(
        store._api.updateConfig(userId, patch)
      );
      store.configResource.reload();
      return result;
    },
    reload(): void {
      store.configResource.reload();
    },
  }))
);
