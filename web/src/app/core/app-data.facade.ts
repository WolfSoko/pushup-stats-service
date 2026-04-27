import { computed, inject, Injectable, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserContextService } from '@pu-auth/auth';
import { StatsApiService } from '@pu-stats/data-access';
import { AdaptiveQuickAddService } from '@pu-stats/quick-add';
import { UserConfigStore } from './user-config.store';

/**
 * Facade that consolidates app-level data resources.
 * Avoids cluttering the root component with multiple resource() calls.
 */
@Injectable({ providedIn: 'root' })
export class AppDataFacade {
  private readonly user = inject(UserContextService);
  private readonly statsApi = inject(StatsApiService);
  private readonly adaptiveQuickAdd = inject(AdaptiveQuickAddService);
  private readonly userConfig = inject(UserConfigStore);

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

  readonly quickAddSuggestions = computed(() => {
    const configured = this.userConfig.quickAdds();
    if (configured.length > 0) {
      return configured
        .filter((q) => q.inSpeedDial)
        .map((q) => q.reps)
        .slice(0, 3);
    }
    return this.adaptiveQuickAdd.compute(
      this.recentEntriesResource.value() ?? []
    );
  });

  readonly dailyGoal = computed(() => this.userConfig.dailyGoal() || 100);

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

  readonly remainingToGoal = computed(() =>
    Math.max(0, this.userConfig.dailyGoal() - this.todayProgress())
  );

  readonly goalReached = computed(() => {
    const goal = this.userConfig.dailyGoal();
    return goal > 0 && this.todayProgress() >= goal;
  });

  reloadAfterMutation(): void {
    this.recentEntriesResource.reload();
    this.dailyProgressResource.reload();
  }
}
