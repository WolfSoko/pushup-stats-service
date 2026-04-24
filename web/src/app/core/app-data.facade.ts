import { computed, inject, Injectable, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserContextService } from '@pu-auth/auth';
import { StatsApiService, UserConfigApiService } from '@pu-stats/data-access';
import { AdaptiveQuickAddService } from '@pu-stats/quick-add';

/**
 * Facade that consolidates app-level data resources.
 * Avoids cluttering the root component with multiple resource() calls.
 */
@Injectable({ providedIn: 'root' })
export class AppDataFacade {
  private readonly user = inject(UserContextService);
  private readonly statsApi = inject(StatsApiService);
  private readonly userConfigApi = inject(UserConfigApiService);
  private readonly adaptiveQuickAdd = inject(AdaptiveQuickAddService);

  readonly recentEntriesResource = resource({
    params: () => ({ userId: this.user.userIdSafe() }),
    loader: async ({ params }) => {
      if (!params.userId) return [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const from = sevenDaysAgo.toISOString().slice(0, 10);
      return firstValueFrom(this.statsApi.listPushups({ from }));
    },
  });

  readonly quickAddSuggestions = computed(() =>
    this.adaptiveQuickAdd.compute(this.recentEntriesResource.value() ?? [])
  );

  readonly userGoalResource = resource({
    params: () => ({ userId: this.user.userIdSafe() }),
    loader: async ({ params }) => {
      if (!params.userId) return { dailyGoal: 100 };
      return firstValueFrom(this.userConfigApi.getConfig(params.userId));
    },
  });

  readonly dailyGoal = computed(
    () => this.userGoalResource.value()?.dailyGoal ?? 100
  );

  readonly dailyProgressResource = resource({
    params: () => ({ userId: this.user.userIdSafe() }),
    loader: async ({ params }) => {
      if (!params.userId) return 0;
      const today = new Date().toISOString().slice(0, 10);
      const stats = await firstValueFrom(
        this.statsApi.load({ from: today, to: today })
      );
      return stats?.meta?.total ?? 0;
    },
  });

  readonly todayProgress = computed(
    () => this.dailyProgressResource.value() ?? 0
  );

  readonly remainingToGoal = computed(() => {
    const configuredGoal = this.userGoalResource.value()?.dailyGoal ?? 0;
    return Math.max(0, configuredGoal - this.todayProgress());
  });

  readonly goalReached = computed(() => {
    const configuredGoal = this.userGoalResource.value()?.dailyGoal ?? 0;
    return configuredGoal > 0 && this.todayProgress() >= configuredGoal;
  });

  reloadAfterQuickAdd(): void {
    this.recentEntriesResource.reload();
    this.dailyProgressResource.reload();
  }
}
