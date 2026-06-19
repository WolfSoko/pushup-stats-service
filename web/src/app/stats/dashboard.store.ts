import { isPlatformBrowser } from '@angular/common';
import { computed, inject, LOCALE_ID, PLATFORM_ID } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  signalStore,
  withComputed,
  withMethods,
  withProps,
} from '@ngrx/signals';
import { UserStatsApiService } from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import {
  exerciseEntryToUnified,
  type UnifiedEntry,
  type UserStats,
} from '@pu-stats/models';
import { daysBetween, toBerlinIsoDate } from '@pu-stats/date';
import { AdsStore } from '@pu-stats/ads';
import { UserContextService } from '@pu-auth/auth';
import { MotivationStore } from '@pu-stats/motivation';
import { of } from 'rxjs';
import { UserConfigStore } from '../core/user-config.store';
import { ShareResult, ShareService } from '../core/share.service';
import { TrainingPlanStore } from '../training-plans/training-plan.store';
import {
  type QuickAddButtonViewModel,
  buildQuickAddButtons,
} from './dashboard/quick-add-view-model';
import {
  computeStreakFromEntries,
  currentIsoWeekKey,
  currentMonthKey,
  goalPercent,
  type RepEntry,
  sumRepsInMonth,
  sumRepsInWeek,
} from './dashboard/dashboard-math';
import { buildShareDayPayload } from './dashboard/dashboard-share';

export const DashboardStore = signalStore(
  withProps(() => ({
    _userConfig: inject(UserConfigStore),
    _userStatsApi: inject(UserStatsApiService),
    _user: inject(UserContextService),
    _live: inject(LiveDataStore),
    _ads: inject(AdsStore),
    _motivation: inject(MotivationStore),
    _trainingPlan: inject(TrainingPlanStore),
    _share: inject(ShareService),
    _localeId: inject(LOCALE_ID) as string,
    _isBrowser: isPlatformBrowser(inject(PLATFORM_ID)),
  })),
  withProps((store) => ({
    // Real-time listener on the per-exercise pushup aggregate
    // `userStats/{userId}/perExercise/pushup`. Post-cutover this is the
    // source for pushup totals/streak/heatmap (the
    // `updateExerciseStatsOnEntryWrite` trigger rewrites it after each
    // pushup `exerciseEntries` write); `rxResource` re-renders without
    // polling. Same `UserStats` shape as the legacy `userStats/{userId}`
    // doc, so downstream bindings are unchanged.
    userStatsResource: rxResource({
      params: () => ({ userId: store._user.userIdSafe() }),
      stream: ({ params }) =>
        params.userId
          ? store._userStatsApi.getPerExerciseStats(params.userId, 'pushup')
          : of(null),
    }),
  })),
  withComputed((store) => {
    const entryRows = computed<RepEntry[]>(() =>
      store._live
        .exerciseEntries()
        .filter((e) => e.exerciseId === 'pushup')
        .map((e) => ({ timestamp: e.timestamp, reps: e.reps ?? 0 }))
    );

    /** Precomputed server-side stats (null if not yet available). */
    const userStats = computed<UserStats | null>(
      () => store.userStatsResource.value() ?? null
    );

    const allTimeTotal = computed(() => userStats()?.total ?? 0);
    const allTimeDays = computed(() => userStats()?.totalDays ?? 0);
    const allTimeEntries = computed(() => userStats()?.totalEntries ?? 0);
    const allTimeAvg = computed(() =>
      allTimeDays() ? (allTimeTotal() / allTimeDays()).toFixed(1) : '0'
    );

    const todayTotal = computed(() => {
      const berlinToday = toBerlinIsoDate(new Date());
      const liveTotal = entryRows()
        .filter((entry) => entry.timestamp.slice(0, 10) === berlinToday)
        .reduce((sum, entry) => sum + entry.reps, 0);
      // In the browser, live entries are always fresher than server-precomputed
      // userStats: the Cloud Function that aggregates UserStats runs after the
      // pushup write, so a fresh fetch of UserStats can still return stale
      // numbers right after a SpeedDial / Quick-Add insertion.
      if (store._isBrowser && store._live.connected()) return liveTotal;
      const us = userStats();
      if (us && us.dailyKey === berlinToday) return us.dailyReps;
      return liveTotal;
    });

    /** Today's plan target — if a plan is active and today is not a
     *  rest day, this overrides the user-configured `dailyGoal`. */
    const planTodayTarget = computed(() => {
      if (!store._trainingPlan.hasActivePlan()) return 0;
      const day = store._trainingPlan.todayDay();
      if (!day || day.kind === 'rest') return 0;
      return day.targetReps;
    });

    const planActive = computed(() => store._trainingPlan.hasActivePlan());
    const planTodayKind = computed(
      () => store._trainingPlan.todayDay()?.kind ?? null
    );
    const planDayIndex = computed(() => store._trainingPlan.currentDayIndex());
    const planTotalDays = computed(
      () => store._trainingPlan.activeCatalog()?.totalDays ?? 0
    );

    /** True when an active plan prescribes a rest day for today. The
     *  Zielfortschritt card uses this to swap the X/Y count for a
     *  highlighted "Ruhetag" badge — the plan goal trumps the user's
     *  configured daily target on rest days. */
    const isPlanRestDay = computed(
      () => planActive() && planTodayKind() === 'rest'
    );

    /** The user's manually configured daily goal, independent of any
     *  active plan override. Surfaced separately so the rest-day UI
     *  can show it as a smaller secondary hint under the prominent
     *  "Ruhetag" label. */
    const userConfiguredDailyGoal = computed(() =>
      store._userConfig.dailyGoal()
    );

    const dailyGoal = computed(
      () => planTodayTarget() || store._userConfig.dailyGoal() || 10
    );
    const weeklyGoal = computed(() => store._userConfig.weeklyGoal() || 50);
    const monthlyGoal = computed(() => store._userConfig.monthlyGoal() || 200);

    const quickAddButtons = computed<QuickAddButtonViewModel[]>(() =>
      buildQuickAddButtons(store._userConfig.quickAdds())
    );

    const goalProgressPercent = computed(() =>
      goalPercent(todayTotal(), dailyGoal())
    );

    /** Effective daily goal = plan target if active, else configured. */
    const configuredDailyGoal = computed(
      () => planTodayTarget() || store._userConfig.dailyGoal()
    );
    const configuredWeeklyGoal = computed(() => store._userConfig.weeklyGoal());
    const configuredMonthlyGoal = computed(() =>
      store._userConfig.monthlyGoal()
    );
    const dailyGoalConfigured = computed(() => configuredDailyGoal() > 0);
    const remainingToGoal = computed(() =>
      Math.max(0, configuredDailyGoal() - todayTotal())
    );
    const goalReached = computed(
      () => configuredDailyGoal() > 0 && todayTotal() >= configuredDailyGoal()
    );

    const unifiedRows = computed<UnifiedEntry[]>(() =>
      store._live.exerciseEntries().map(exerciseEntryToUnified)
    );

    const lastEntry = computed<UnifiedEntry | null>(() => {
      const rows = unifiedRows();
      if (!rows.length) return null;
      return (
        [...rows].sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0] ?? null
      );
    });

    const latestEntries = computed<UnifiedEntry[]>(() => {
      return [...unifiedRows()]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(0, 5);
    });

    const currentStreak = computed(() => {
      const us = userStats();
      if (us) {
        if (!us.lastEntryDate) return 0;
        const diff = daysBetween(us.lastEntryDate, toBerlinIsoDate(new Date()));
        return diff >= 0 && diff <= 1 ? us.currentStreak : 0;
      }
      // Fallback: client-side computation
      return computeStreakFromEntries(entryRows(), toBerlinIsoDate(new Date()));
    });

    const weekReps = computed(() => {
      // In the browser live entries are always fresher than the
      // server-precomputed period totals (the aggregator runs after the
      // write), so prefer the live sum when connected.
      if (store._isBrowser && store._live.connected())
        return sumRepsInWeek(entryRows(), toBerlinIsoDate(new Date()));
      const us = userStats();
      if (us && us.weeklyKey === currentIsoWeekKey()) return us.weeklyReps;
      return sumRepsInWeek(entryRows(), toBerlinIsoDate(new Date()));
    });

    const monthReps = computed(() => {
      if (store._isBrowser && store._live.connected())
        return sumRepsInMonth(entryRows(), toBerlinIsoDate(new Date()));
      const us = userStats();
      if (us && us.monthlyKey === currentMonthKey()) return us.monthlyReps;
      return sumRepsInMonth(entryRows(), toBerlinIsoDate(new Date()));
    });

    const weeklyGoalProgressPercent = computed(() =>
      goalPercent(weekReps(), weeklyGoal())
    );

    const monthlyGoalProgressPercent = computed(() =>
      goalPercent(monthReps(), monthlyGoal())
    );

    const weeklyGoalReached = computed(
      () => configuredWeeklyGoal() > 0 && weekReps() >= configuredWeeklyGoal()
    );

    const monthlyGoalReached = computed(
      () =>
        configuredMonthlyGoal() > 0 && monthReps() >= configuredMonthlyGoal()
    );

    const loading = computed(
      () => !store._live.connected() && entryRows().length === 0
    );

    const liveConnected = computed(() => store._live.connected());

    const adClient = computed(() => store._ads.adClient());
    const adSlotDashboardInline = computed(() =>
      store._ads.dashboardInlineSlot()
    );
    const dashboardInlineAdsEnabled = computed(() =>
      store._ads.dashboardInlineEnabled()
    );

    const todayQuote = store._motivation.todayQuote;

    return {
      allTimeTotal,
      allTimeDays,
      allTimeEntries,
      allTimeAvg,
      entryRows,
      currentStreak,
      weekReps,
      monthReps,
      dailyGoal,
      weeklyGoal,
      monthlyGoal,
      quickAddButtons,
      weeklyGoalProgressPercent,
      monthlyGoalProgressPercent,
      weeklyGoalReached,
      monthlyGoalReached,
      todayTotal,
      goalProgressPercent,
      dailyGoalConfigured,
      remainingToGoal,
      goalReached,
      lastEntry,
      latestEntries,
      loading,
      liveConnected,
      adClient,
      adSlotDashboardInline,
      dashboardInlineAdsEnabled,
      todayQuote,
      planActive,
      planTodayTarget,
      planTodayKind,
      planDayIndex,
      planTotalDays,
      isPlanRestDay,
      userConfiguredDailyGoal,
    };
  }),
  withMethods((store) => ({
    refreshAll(): void {
      store.userStatsResource.reload();
    },
    async loadQuote(): Promise<void> {
      await store._motivation.loadQuotes(store._user.userIdSafe());
    },
    shareDay(): Promise<ShareResult> {
      return store._share.share(
        buildShareDayPayload({
          total: store.todayTotal(),
          streak: store.currentStreak(),
          uid: store._user.userIdSafe(),
          publicProfile: store._userConfig.config()?.ui?.publicProfile === true,
          localeId: store._localeId,
        })
      );
    },
  }))
);
