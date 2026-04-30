import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  signalStore,
  withComputed,
  withMethods,
  withProps,
} from '@ngrx/signals';
import { UserContextService } from '@pu-auth/auth';
import { UserConfigApiService } from '@pu-stats/data-access';
import {
  DEFAULT_SNAP_QUALITY,
  QuickAddConfig,
  SnapQuality,
  UserConfig,
  UserConfigUpdate,
} from '@pu-stats/models';
import { firstValueFrom, of } from 'rxjs';

/**
 * Root-level store for user config (daily/weekly/monthly goals, display name,
 * consent, ui flags). Single source of truth — consumed by the app toolbar,
 * dashboard and settings page so that edits made in one place propagate
 * reactively to the others without requiring a full reload.
 *
 * Backed by a Firestore real-time listener (`docData()`), so config changes
 * made anywhere — settings page, another device, server-side — propagate to
 * every consumer without a manual reload.
 */
export const UserConfigStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({
    _api: inject(UserConfigApiService),
    _user: inject(UserContextService),
  })),
  withProps((store) => ({
    configResource: rxResource({
      params: () => ({ userId: store._user.userIdSafe() }),
      stream: ({ params }) => {
        if (!params.userId) return of(null);
        return store._api.getConfig(params.userId);
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
    snapQuality: computed<SnapQuality>(
      () =>
        store.configResource.value()?.ui?.snapQuality ?? DEFAULT_SNAP_QUALITY
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
