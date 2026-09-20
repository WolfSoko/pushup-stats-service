import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { UserContextService } from '@pu-auth/auth';
import { UserAchievementsApiService } from '@pu-stats/data-access';
import { invitedCount } from '@pu-stats/models';
import { of } from 'rxjs';

import { UserConfigStore } from '../core/user-config.store';
import {
  buildAchievementCollection,
  type AchievementCollectionView,
} from './achievement-collection';

const EMPTY: AchievementCollectionView = {
  groups: [],
  earnedCount: 0,
  totalCount: 0,
  next: null,
};

/**
 * The owner's badge collection.
 *
 * Both halves already exist server-side: `userAchievements/{uid}` carries
 * what was earned plus the plan-day counter, and the invite count lives on
 * the user's config. Nothing here needs a new write path.
 */
export const AchievementsStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({
    _api: inject(UserAchievementsApiService),
    _user: inject(UserContextService),
    _config: inject(UserConfigStore),
  })),
  withProps((store) => ({
    progressResource: rxResource({
      params: () => ({ userId: store._user.userIdSafe() }),
      stream: ({ params }) =>
        params.userId ? store._api.watchProgress(params.userId) : of(null),
    }),
  })),
  withComputed((store) => ({
    loading: computed(() => store.progressResource.isLoading()),
    collection: computed<AchievementCollectionView>(() => {
      const progress = store.progressResource.value();
      if (!progress) return EMPTY;
      return buildAchievementCollection({
        earned: progress.earned,
        planDayTotal: progress.planDayTotal,
        invitedCount: invitedCount(store._config.config()?.referral),
      });
    }),
  }))
);
