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
  type ComplexGoalEntry,
  type ComplexGoals,
  DEFAULT_SNAP_QUALITY,
  legacyNumericGoalToEntries,
  QuickAddConfig,
  SnapQuality,
  sumRepsTarget,
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
 *
 * **Goals migration.** The `goals` signal returns a unified
 * {@link ComplexGoals} shape regardless of which schema the Firestore doc
 * still uses: if `goals.daily/weekly/monthly` is present we surface it
 * directly, otherwise we synthesise a single-entry list from the legacy
 * `dailyGoal`/`weeklyGoal`/`monthlyGoal` numbers. Callers that still read
 * the legacy numeric signals (`dailyGoal()`, …) keep working because those
 * compute as `sumRepsTarget(goals.X)` when complex goals are configured.
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
  withComputed((store) => {
    /**
     * Unified `goals` view that migrates legacy numeric fields on read.
     * If the doc carries a `goals.{scope}` array we return it verbatim
     * (the user has saved through the new page at least once);
     * otherwise we wrap the legacy `dailyGoal`/`weeklyGoal`/`monthlyGoal`
     * value in a single pushup-reps entry so consumers see a consistent
     * shape no matter which schema is on disk.
     */
    const goals = computed<ComplexGoals>(() => {
      const cfg = store.configResource.value();
      if (!cfg) return { daily: [], weekly: [], monthly: [] };
      const daily =
        cfg.goals?.daily ??
        legacyNumericGoalToEntries(cfg.dailyGoal, 'legacy-daily');
      const weekly =
        cfg.goals?.weekly ??
        legacyNumericGoalToEntries(cfg.weeklyGoal, 'legacy-weekly');
      const monthly =
        cfg.goals?.monthly ??
        legacyNumericGoalToEntries(cfg.monthlyGoal, 'legacy-monthly');
      return { daily, weekly, monthly };
    });

    return {
      config: computed<UserConfig | null>(
        () => store.configResource.value() ?? null
      ),
      /**
       * True once the config resource has emitted at least once (either a
       * real config doc or `null` for unauthenticated users). Lets callers
       * distinguish "still loading" from "user never configured a daily
       * goal" — both expose `dailyGoal() === 0` otherwise.
       */
      loaded: computed(() => store.configResource.value() !== undefined),
      /**
       * True when the user has explicitly saved through the dedicated
       * goals page (the Firestore doc carries the new `goals` field).
       * Legacy `dailyGoal`-only documents return `false` even though
       * `goals()` will still surface the migrated single-entry view.
       * The toolbar consults this to keep the old `X / Y` display for
       * legacy users and only switch to the aggregated `X%` view for
       * users who actually configured complex goals.
       */
      goalsConfigured: computed(
        () => store.configResource.value()?.goals !== undefined
      ),
      goals,
      dailyGoalEntries: computed<ComplexGoalEntry[]>(() => goals().daily ?? []),
      weeklyGoalEntries: computed<ComplexGoalEntry[]>(
        () => goals().weekly ?? []
      ),
      monthlyGoalEntries: computed<ComplexGoalEntry[]>(
        () => goals().monthly ?? []
      ),
      /**
       * Legacy single-number goals. Prefer the rep-sum of {@link goals}
       * when complex entries are configured so consumers that haven't
       * migrated automatically pick up the new structure as a single
       * aggregate target.
       */
      dailyGoal: computed(() => {
        const list = goals().daily ?? [];
        const sum = sumRepsTarget(list);
        if (sum > 0) return sum;
        return store.configResource.value()?.dailyGoal ?? 0;
      }),
      weeklyGoal: computed(() => {
        const list = goals().weekly ?? [];
        const sum = sumRepsTarget(list);
        if (sum > 0) return sum;
        return store.configResource.value()?.weeklyGoal ?? 0;
      }),
      monthlyGoal: computed(() => {
        const list = goals().monthly ?? [];
        const sum = sumRepsTarget(list);
        if (sum > 0) return sum;
        return store.configResource.value()?.monthlyGoal ?? 0;
      }),
      quickAdds: computed<QuickAddConfig[]>(
        () => store.configResource.value()?.ui?.quickAdds ?? []
      ),
      snapQuality: computed<SnapQuality>(
        () =>
          store.configResource.value()?.ui?.snapQuality ?? DEFAULT_SNAP_QUALITY
      ),
    };
  }),
  withMethods((store) => ({
    async save(patch: UserConfigUpdate): Promise<UserConfig> {
      const userId = store._user.userIdSafe();
      const result = await firstValueFrom(
        store._api.updateConfig(userId, patch)
      );
      store.configResource.reload();
      return result;
    },
    /**
     * Persists the entire complex-goal structure, plus the derived legacy
     * single-number fields so backwards-compat consumers (Cloud Functions,
     * dashboard cards before this commit) stay in sync without a follow-up
     * read.
     */
    async saveGoals(goals: ComplexGoals): Promise<UserConfig> {
      const userId = store._user.userIdSafe();
      const daily = goals.daily ?? [];
      const weekly = goals.weekly ?? [];
      const monthly = goals.monthly ?? [];
      const patch: UserConfigUpdate = {
        goals: { daily, weekly, monthly },
        dailyGoal: sumRepsTarget(daily),
        weeklyGoal: sumRepsTarget(weekly),
        monthlyGoal: sumRepsTarget(monthly),
      };
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
