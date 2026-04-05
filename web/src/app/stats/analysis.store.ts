import { computed, inject, resource } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { StatsApiService, UserStatsApiService } from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import {
  createWeekRange,
  inferRangeMode,
  PushupRecord,
  StatsGranularity,
  StatsResponse,
  StatsSeriesEntry,
  UserStats,
} from '@pu-stats/models';

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

interface TrendPoint {
  label: string;
  total: number;
}

type AnalysisState = {
  from: string;
  to: string;
};

function isoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function isoWeekYear(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  return d.getUTCFullYear();
}

function daysBetween(a: string, b: string): number {
  const ad = new Date(`${a}T00:00:00`).getTime();
  const bd = new Date(`${b}T00:00:00`).getTime();
  return Math.round((bd - ad) / 86_400_000);
}

function sortedUniqueDates(rows: PushupRecord[]): string[] {
  return [...new Set(rows.map((x) => x.timestamp.slice(0, 10)))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export const AnalysisStore = signalStore(
  withState<AnalysisState>(() => {
    const defaultRange = createWeekRange();
    return {
      from: defaultRange.from,
      to: defaultRange.to,
    };
  }),
  withProps(() => {
    const api = inject(StatsApiService);
    const userStatsApi = inject(UserStatsApiService);
    const user = inject(UserContextService);
    return { _api: api, _userStatsApi: userStatsApi, _user: user };
  }),
  withComputed((store) => {
    const filter = computed(() => ({
      from: store.from() || undefined,
      to: store.to() || undefined,
    }));

    const rangeMode = computed(() => inferRangeMode(store.from(), store.to()));

    return { filter, rangeMode };
  }),
  withProps((store) => {
    const statsResource = resource({
      params: () => store.filter(),
      loader: async ({ params }) => firstValueFrom(store._api.load(params)),
    });

    const entriesResource = resource({
      params: () => store.filter(),
      loader: async ({ params }) =>
        firstValueFrom(store._api.listPushups(params)),
    });

    const userStatsResource = resource({
      params: () => ({ userId: store._user.userIdSafe() }),
      loader: async ({ params }) =>
        firstValueFrom(store._userStatsApi.getUserStats(params.userId)),
    });

    return { statsResource, entriesResource, userStatsResource };
  }),
  withComputed((store) => {
    const stats = computed(() => store.statsResource.value() ?? EMPTY_STATS);
    const chartSeries = computed<StatsSeriesEntry[]>(() => stats().series);
    const granularity = computed<StatsGranularity>(
      () => stats().meta.granularity
    );
    const rows = computed(() => store.entriesResource.value() ?? []);

    const weekTrend = computed(() => {
      const byWeek = new Map<string, number>();
      for (const row of rows()) {
        const date = new Date(row.timestamp);
        const year = isoWeekYear(date);
        const week = String(isoWeek(date)).padStart(2, '0');
        const key = `${year}-W${week}`;
        byWeek.set(key, (byWeek.get(key) ?? 0) + row.reps);
      }
      return [...byWeek.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-8)
        .map(([label, total]) => ({ label, total }));
    });

    const monthTrend = computed<TrendPoint[]>(() => {
      const byMonth = new Map<string, number>();
      for (const row of rows()) {
        const date = new Date(row.timestamp);
        const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        byMonth.set(label, (byMonth.get(label) ?? 0) + row.reps);
      }
      return [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([label, total]) => ({ label, total }));
    });

    const typeBreakdown = computed(() => {
      const byType = new Map<string, number>();
      for (const row of rows()) {
        const type = (row.type || 'Standard').trim() || 'Standard';
        byType.set(type, (byType.get(type) ?? 0) + row.reps);
      }
      return [...byType.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value }));
    });

    const bestSingleEntry = computed<PushupRecord | null>(() => {
      if (!rows().length) return null;
      return [...rows()].sort((a, b) => b.reps - a.reps)[0] ?? null;
    });

    const bestDay = computed<{ date: string; total: number } | null>(() => {
      const byDay = new Map<string, number>();
      for (const row of rows()) {
        const key = row.timestamp.slice(0, 10);
        byDay.set(key, (byDay.get(key) ?? 0) + row.reps);
      }
      if (!byDay.size) return null;
      const [date, total] = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
      return { date, total };
    });

    const longestStreak = computed(() => {
      const dates = sortedUniqueDates(rows());
      if (!dates.length) return 0;
      let best = 1;
      let current = 1;
      for (let i = 1; i < dates.length; i++) {
        if (daysBetween(dates[i - 1], dates[i]) === 1) current += 1;
        else current = 1;
        best = Math.max(best, current);
      }
      return best;
    });

    const currentStreak = computed(() => {
      const dates = sortedUniqueDates(rows());
      if (!dates.length) return 0;
      let streak = 1;
      for (let i = dates.length - 1; i > 0; i--) {
        if (daysBetween(dates[i - 1], dates[i]) === 1) streak += 1;
        else break;
      }
      return streak;
    });

    /** Precomputed server-side stats (null if not yet available). */
    const userStats = computed<UserStats | null>(
      () => store.userStatsResource.value() ?? null
    );

    /** Server-side heatmap data (weekday-hour → cumulative reps). */
    const heatmapData = computed<Record<string, number>>(
      () => userStats()?.heatmap ?? {}
    );

    return {
      stats,
      chartSeries,
      granularity,
      rows,
      weekTrend,
      monthTrend,
      typeBreakdown,
      bestSingleEntry,
      bestDay,
      longestStreak,
      currentStreak,
      userStats,
      heatmapData,
    };
  }),
  withMethods((store) => ({
    setRange(from: string, to: string): void {
      patchState(store, { from, to });
    },
    setFrom(from: string): void {
      patchState(store, { from });
    },
    setTo(to: string): void {
      patchState(store, { to });
    },
  }))
);
