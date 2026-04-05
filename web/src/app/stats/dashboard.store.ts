import { computed, inject, resource } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import {
  LiveDataStore,
  StatsApiService,
  UserConfigApiService,
} from '@pu-stats/data-access';
import { PushupRecord, StatsResponse, toLocalIsoDate } from '@pu-stats/models';
import { AdsStore } from '@pu-stats/ads';
import { UserContextService } from '@pu-auth/auth';
import { MotivationStore } from '@pu-stats/motivation';
import { firstValueFrom } from 'rxjs';

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

export const DashboardStore = signalStore(
  withState({
    dailyGoal: 100,
    weeklyGoal: 700,
    monthlyGoal: 3000,
  }),
  withProps(() => ({
    _api: inject(StatsApiService),
    _userConfigApi: inject(UserConfigApiService),
    _user: inject(UserContextService),
    _live: inject(LiveDataStore),
    _ads: inject(AdsStore),
    _motivation: inject(MotivationStore),
  })),
  withProps((store) => ({
    entriesResource: resource({
      loader: async () => firstValueFrom(store._api.listPushups({})),
    }),
    allTimeResource: resource({
      loader: async () => firstValueFrom(store._api.load({})),
    }),
    userConfigResource: resource({
      params: () => ({ userId: store._user.userIdSafe() }),
      loader: async ({ params }) =>
        firstValueFrom(store._userConfigApi.getConfig(params.userId)),
    }),
  })),
  withComputed((store) => {
    const allTimeStats = computed(
      () => store.allTimeResource.value() ?? EMPTY_STATS
    );

    const entryRows = computed<PushupRecord[]>(
      () => store.entriesResource.value() ?? []
    );

    const allTimeTotal = computed(() => allTimeStats().meta.total);
    const allTimeDays = computed(() => allTimeStats().meta.days);
    const allTimeEntries = computed(() => allTimeStats().meta.entries);
    const allTimeAvg = computed(() =>
      allTimeDays() ? (allTimeTotal() / allTimeDays()).toFixed(1) : '0'
    );

    const todayTotal = computed(() => {
      const today = toLocalIsoDate(new Date());
      return entryRows()
        .filter((entry) => entry.timestamp.slice(0, 10) === today)
        .reduce((sum, entry) => sum + entry.reps, 0);
    });

    const goalProgressPercent = computed(() =>
      store.dailyGoal()
        ? Math.min(100, Math.round((todayTotal() / store.dailyGoal()) * 100))
        : 0
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
      const dates = sortedUniqueDates(entryRows());
      if (!dates.length) return 0;

      const today = toLocalIsoDate(new Date());
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

    const weekReps = computed(() => {
      const today = new Date();
      const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0
      const monday = new Date(today);
      monday.setDate(today.getDate() - dayOfWeek);
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

    const monthReps = computed(() => {
      const today = new Date();
      const yearStr = String(today.getFullYear());
      const monthStr = String(today.getMonth() + 1).padStart(2, '0');
      const prefix = `${yearStr}-${monthStr}`;

      return entryRows()
        .filter((entry) => entry.timestamp.startsWith(prefix))
        .reduce((sum, entry) => sum + entry.reps, 0);
    });

    const weeklyGoalProgressPercent = computed(() =>
      store.weeklyGoal()
        ? Math.min(100, Math.round((weekReps() / store.weeklyGoal()) * 100))
        : 0
    );

    const monthlyGoalProgressPercent = computed(() =>
      store.monthlyGoal()
        ? Math.min(100, Math.round((monthReps() / store.monthlyGoal()) * 100))
        : 0
    );

    const loading = computed(() => {
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
      weeklyGoalProgressPercent,
      monthlyGoalProgressPercent,
      todayTotal,
      goalProgressPercent,
      lastEntry,
      latestEntries,
      loading,
      liveConnected,
      adClient,
      adSlotDashboardInline,
      dashboardInlineAdsEnabled,
      todayQuote,
    };
  }),
  withMethods((store) => ({
    refreshAll(): void {
      store.allTimeResource.reload();
      store.entriesResource.reload();
    },
    async loadQuote(): Promise<void> {
      await store._motivation.loadQuotes(store._user.userIdSafe());
    },
    setDailyGoal(goal: number): void {
      patchState(store, { dailyGoal: goal });
    },
    setWeeklyGoal(goal: number): void {
      patchState(store, { weeklyGoal: goal });
    },
    setMonthlyGoal(goal: number): void {
      patchState(store, { monthlyGoal: goal });
    },
  }))
);
