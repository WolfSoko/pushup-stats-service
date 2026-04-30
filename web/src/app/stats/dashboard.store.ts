import { isPlatformBrowser } from '@angular/common';
import { computed, inject, PLATFORM_ID, resource } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  signalStore,
  withComputed,
  withMethods,
  withProps,
} from '@ngrx/signals';
import {
  LiveDataStore,
  StatsApiService,
  UserStatsApiService,
} from '@pu-stats/data-access';
import {
  PushupRecord,
  StatsResponse,
  toBerlinIsoDate,
  toLocalIsoDate,
  UserStats,
} from '@pu-stats/models';
import { AdsStore } from '@pu-stats/ads';
import { UserContextService } from '@pu-auth/auth';
import { MotivationStore } from '@pu-stats/motivation';
import { firstValueFrom, of } from 'rxjs';
import { UserConfigStore } from '../core/user-config.store';
import { ShareResult, ShareService } from '../core/share.service';
import { TrainingPlanStore } from '../training-plans/training-plan.store';

const EMPTY_STATS: StatsResponse = {
  meta: {
    from: null,
    to: null,
    entries: 0,
    days: 0,
    total: 0,
    granularity: 'daily',
  },
  series: [],
};

function sortedUniqueDates(rows: PushupRecord[]): string[] {
  return [...new Set(rows.map((x) => x.timestamp.slice(0, 10)))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function daysBetween(a: string, b: string): number {
  const ad = new Date(`${a}T00:00:00`);
  const bd = new Date(`${b}T00:00:00`);
  ad.setHours(0, 0, 0, 0);
  bd.setHours(0, 0, 0, 0);
  return Math.round((bd.getTime() - ad.getTime()) / 86_400_000);
}

function currentIsoWeekKey(): string {
  // Use Berlin date to match server-side period key calculation
  const berlinDate = toBerlinIsoDate(new Date());
  const [y, m, day] = berlinDate.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setHours(0, 0, 0, 0);
  const weekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() + 3 - weekday);
  const isoYear = d.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  firstThursday.setHours(0, 0, 0, 0);
  const ftDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() + 3 - ftDay);
  const week =
    1 +
    Math.round(
      (d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

function currentMonthKey(): string {
  // Use Berlin date to match server-side period key calculation
  const berlinDate = toBerlinIsoDate(new Date());
  return berlinDate.slice(0, 7);
}

export const DashboardStore = signalStore(
  withProps(() => ({
    _api: inject(StatsApiService),
    _userConfig: inject(UserConfigStore),
    _userStatsApi: inject(UserStatsApiService),
    _user: inject(UserContextService),
    _live: inject(LiveDataStore),
    _ads: inject(AdsStore),
    _motivation: inject(MotivationStore),
    _trainingPlan: inject(TrainingPlanStore),
    _share: inject(ShareService),
    _isBrowser: isPlatformBrowser(inject(PLATFORM_ID)),
  })),
  withProps((store) => ({
    // SSR fallback only. In the browser we read entries from `_live.entries()`
    // directly so Firestore real-time updates propagate without an extra REST
    // round-trip. The resource is still reloaded by `refreshAll()` to keep the
    // SSR cache warm.
    entriesResource: resource({
      loader: async () => firstValueFrom(store._api.listPushups({})),
    }),
    allTimeResource: resource({
      loader: async () => firstValueFrom(store._api.load({})),
    }),
    // Real-time listener on `userStats/{userId}`. The Cloud Function
    // aggregator rewrites this doc after each pushup write — `rxResource`
    // ensures the dashboard re-renders without polling or manual reload.
    userStatsResource: rxResource({
      params: () => ({ userId: store._user.userIdSafe() }),
      stream: ({ params }) =>
        params.userId
          ? store._userStatsApi.getUserStats(params.userId)
          : of(null),
    }),
  })),
  withComputed((store) => {
    const allTimeStats = computed(
      () => store.allTimeResource.value() ?? EMPTY_STATS
    );

    // Source of truth for entries: Firestore-backed `LiveDataStore` once it
    // has connected (reactive, real-time). Until then we fall back to the
    // REST resource so SSR and the cold-start hydration window still render
    // data instead of an empty state.
    const entryRows = computed<PushupRecord[]>(() => {
      if (store._isBrowser && store._live.connected()) {
        return store._live.entries();
      }
      return store.entriesResource.value() ?? [];
    });

    /** Precomputed server-side stats (null if not yet available). */
    const userStats = computed<UserStats | null>(
      () => store.userStatsResource.value() ?? null
    );

    const allTimeTotal = computed(
      () => userStats()?.total ?? allTimeStats().meta.total
    );
    const allTimeDays = computed(
      () => userStats()?.totalDays ?? allTimeStats().meta.days
    );
    const allTimeEntries = computed(
      () => userStats()?.totalEntries ?? allTimeStats().meta.entries
    );
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

    const dailyGoal = computed(
      () => planTodayTarget() || store._userConfig.dailyGoal() || 10
    );
    const weeklyGoal = computed(() => store._userConfig.weeklyGoal() || 50);
    const monthlyGoal = computed(() => store._userConfig.monthlyGoal() || 200);

    /** Reps values shown as quick-add buttons in the Schnellaktionen card.
     *  When the user configured any custom buttons, those override the
     *  defaults [10, 20, 30]. */
    const quickAddButtons = computed<number[]>(() => {
      const configured = store._userConfig.quickAdds();
      return configured.length > 0
        ? configured.map((q) => q.reps)
        : [10, 20, 30];
    });

    const goalProgressPercent = computed(() =>
      dailyGoal()
        ? Math.min(100, Math.round((todayTotal() / dailyGoal()) * 100))
        : 0
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

    const lastEntry = computed<PushupRecord | null>(() => {
      const rows = entryRows();
      if (!rows.length) return null;
      return (
        [...rows].sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0] ?? null
      );
    });

    const latestEntries = computed<PushupRecord[]>(() => {
      return [...entryRows()]
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
      const dates = sortedUniqueDates(entryRows());
      if (!dates.length) return 0;

      const today = toBerlinIsoDate(new Date());
      const lastDate = dates[dates.length - 1];

      const diff = daysBetween(lastDate, today);
      if (diff > 1 || diff < 0) return 0;

      let streak = 1;
      for (let i = dates.length - 1; i > 0; i--) {
        if (daysBetween(dates[i - 1], dates[i]) === 1) {
          streak += 1;
        } else {
          break;
        }
      }
      return streak;
    });

    // Live computation from entries — used as the primary source in the
    // browser (always fresh) and as the fallback elsewhere.
    const weekRepsFromEntries = computed(() => {
      const berlinToday = toBerlinIsoDate(new Date());
      const [by, bm, bd] = berlinToday.split('-').map(Number);
      const todayDate = new Date(by, bm - 1, bd);
      const dayOfWeek = (todayDate.getDay() + 6) % 7; // Monday = 0
      const monday = new Date(todayDate);
      monday.setDate(todayDate.getDate() - dayOfWeek);
      const mondayStr = toLocalIsoDate(monday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const sundayStr = toLocalIsoDate(sunday);

      return entryRows()
        .filter((entry) => {
          const day = entry.timestamp.slice(0, 10);
          return day >= mondayStr && day <= sundayStr;
        })
        .reduce((sum, entry) => sum + entry.reps, 0);
    });

    const weekReps = computed(() => {
      if (store._isBrowser && store._live.connected())
        return weekRepsFromEntries();
      const us = userStats();
      if (us && us.weeklyKey === currentIsoWeekKey()) return us.weeklyReps;
      return weekRepsFromEntries();
    });

    const monthRepsFromEntries = computed(() => {
      const prefix = toBerlinIsoDate(new Date()).slice(0, 7);
      return entryRows()
        .filter((entry) => entry.timestamp.startsWith(prefix))
        .reduce((sum, entry) => sum + entry.reps, 0);
    });

    const monthReps = computed(() => {
      if (store._isBrowser && store._live.connected())
        return monthRepsFromEntries();
      const us = userStats();
      if (us && us.monthlyKey === currentMonthKey()) return us.monthlyReps;
      return monthRepsFromEntries();
    });

    const weeklyGoalProgressPercent = computed(() =>
      weeklyGoal()
        ? Math.min(100, Math.round((weekReps() / weeklyGoal()) * 100))
        : 0
    );

    const monthlyGoalProgressPercent = computed(() =>
      monthlyGoal()
        ? Math.min(100, Math.round((monthReps() / monthlyGoal()) * 100))
        : 0
    );

    const weeklyGoalReached = computed(
      () => configuredWeeklyGoal() > 0 && weekReps() >= configuredWeeklyGoal()
    );

    const monthlyGoalReached = computed(
      () =>
        configuredMonthlyGoal() > 0 && monthReps() >= configuredMonthlyGoal()
    );

    const loading = computed(() => {
      if (store._isBrowser) {
        // Treat the dashboard as "loading" only until the Firestore listener
        // has emitted at least once; subsequent updates happen reactively
        // through `_live.entries()` without a loading flicker.
        return !store._live.connected() && entryRows().length === 0;
      }
      const status = store.entriesResource.status();
      return status === 'loading' || status === 'reloading';
    });

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
      allTimeStats,
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
    };
  }),
  withMethods((store) => ({
    refreshAll(): void {
      store.allTimeResource.reload();
      store.entriesResource.reload();
      store.userStatsResource.reload();
    },
    async loadQuote(): Promise<void> {
      await store._motivation.loadQuotes(store._user.userIdSafe());
    },
    shareDay(): Promise<ShareResult> {
      const total = store.todayTotal();
      const streak = store.currentStreak();
      const text =
        streak > 1
          ? $localize`:@@dashboard.share.text.streak:Heute schon ${total}:total: Liegestütze geschafft – Streak: ${streak}:streak: Tage 🔥 Tracke deine Stats kostenlos:`
          : $localize`:@@dashboard.share.text.simple:Heute schon ${total}:total: Liegestütze geschafft! 💪 Tracke deine Stats kostenlos:`;
      return store._share.share({
        title: $localize`:@@dashboard.share.title:Pushup Tracker`,
        text,
        url: 'https://pushup-stats.de',
      });
    },
  }))
);
