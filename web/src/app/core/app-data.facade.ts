import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  resource,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserContextService } from '@pu-auth/auth';
import { LiveDataStore, StatsApiService } from '@pu-stats/data-access';
import { toBerlinIsoDate } from '@pu-stats/models';
import { AdaptiveQuickAddService } from '@pu-stats/quick-add';
import { UserConfigStore } from './user-config.store';

/**
 * Facade that consolidates app-level data resources.
 *
 * In the browser the facade derives all entry-based signals from
 * `LiveDataStore.entries()` so Firestore real-time updates propagate to
 * consumers without an explicit reload. The REST `resource()`s are kept as
 * SSR / cold-start fallbacks and reloaded on mutation only to keep the SSR
 * cache warm.
 */
@Injectable({ providedIn: 'root' })
export class AppDataFacade {
  private readonly user = inject(UserContextService);
  private readonly statsApi = inject(StatsApiService);
  private readonly adaptiveQuickAdd = inject(AdaptiveQuickAddService);
  private readonly userConfig = inject(UserConfigStore);
  private readonly live = inject(LiveDataStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

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

  /** Last 7 days of entries — derived live from Firestore in the browser. */
  private readonly recentEntries = computed(() => {
    if (this.isBrowser && this.live.connected()) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const cutoff = sevenDaysAgo.toISOString().slice(0, 10);
      return this.live
        .entries()
        .filter((e) => e.timestamp.slice(0, 10) >= cutoff);
    }
    return this.recentEntriesResource.value() ?? [];
  });

  readonly quickAddSuggestions = computed(() => {
    const configured = this.userConfig.quickAdds();
    if (configured.length > 0) {
      return configured
        .filter((q) => q.inSpeedDial)
        .map((q) => q.reps)
        .slice(0, 3);
    }
    return this.adaptiveQuickAdd.compute(this.recentEntries());
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

  readonly todayProgress = computed(() => {
    if (this.isBrowser && this.live.connected()) {
      const berlinToday = toBerlinIsoDate(new Date());
      return this.live
        .entries()
        .filter((e) => e.timestamp.slice(0, 10) === berlinToday)
        .reduce((sum, e) => sum + e.reps, 0);
    }
    return this.dailyProgressResource.value() ?? 0;
  });

  readonly remainingToGoal = computed(() =>
    Math.max(0, this.userConfig.dailyGoal() - this.todayProgress())
  );

  readonly goalReached = computed(() => {
    const goal = this.userConfig.dailyGoal();
    return goal > 0 && this.todayProgress() >= goal;
  });

  /**
   * Refreshes the SSR / cold-start fallback resources. In the browser, live
   * updates flow automatically through `LiveDataStore` so this is mostly a
   * no-op — kept for callers that need the SSR cache invalidated and for
   * defence-in-depth if the Firestore listener ever drops.
   */
  reloadAfterMutation(): void {
    this.recentEntriesResource.reload();
    this.dailyProgressResource.reload();
  }
}
