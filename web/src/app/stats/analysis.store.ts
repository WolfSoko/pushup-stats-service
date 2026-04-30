import { computed, inject, LOCALE_ID, resource } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { firstValueFrom, of } from 'rxjs';
import { StatsApiService, UserStatsApiService } from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import {
  createWeekRange,
  inferRangeMode,
  PushupRecord,
  StatsGranularity,
  StatsResponse,
  StatsSeriesEntry,
  toLocalIsoDate,
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
  avgSetsPerEntry?: number;
}

export interface TypeBreakdownDatum {
  label: string;
  value: number;
  avgSetSize: number;
}

type AnalysisState = {
  from: string;
  to: string;
  dayChartMode: '24h' | '14h' | undefined;
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

function expandToWeekRange(
  from: string,
  to: string
): { from: string; to: string } {
  const fromDate = new Date(`${from}T00:00:00`);
  const day = fromDate.getDay() || 7;
  fromDate.setDate(fromDate.getDate() - (day - 1));

  const toDate = new Date(`${to}T00:00:00`);
  const toDay = toDate.getDay() || 7;
  toDate.setDate(toDate.getDate() + (7 - toDay));

  return {
    from: toLocalIsoDate(fromDate),
    to: toLocalIsoDate(toDate),
  };
}

function expandToMonthRange(
  from: string,
  to: string
): { from: string; to: string } {
  const fromDate = new Date(`${from}T00:00:00`);
  fromDate.setDate(1);

  const toDate = new Date(`${to}T00:00:00`);
  toDate.setMonth(toDate.getMonth() + 1, 0);

  return {
    from: toLocalIsoDate(fromDate),
    to: toLocalIsoDate(toDate),
  };
}

export const AnalysisStore = signalStore(
  withState<AnalysisState>(() => {
    const defaultRange = createWeekRange();
    return {
      from: defaultRange.from,
      to: defaultRange.to,
      dayChartMode: undefined as '24h' | '14h' | undefined,
    };
  }),
  withProps(() => {
    const api = inject(StatsApiService);
    const userStatsApi = inject(UserStatsApiService);
    const user = inject(UserContextService);
    const locale = inject(LOCALE_ID);
    return {
      _api: api,
      _userStatsApi: userStatsApi,
      _user: user,
      _locale: locale,
    };
  }),
  withComputed((store) => {
    const filter = computed(() => ({
      from: store.from() || undefined,
      to: store.to() || undefined,
      ...(store.dayChartMode() ? { dayChartMode: store.dayChartMode() } : {}),
    }));

    const rangeMode = computed(() => inferRangeMode(store.from(), store.to()));

    const weekFilter = computed(() => {
      const from = store.from();
      const to = store.to();
      if (!from || !to) return { from, to };
      return expandToWeekRange(from, to);
    });
    const monthFilter = computed(() => {
      const from = store.from();
      const to = store.to();
      if (!from || !to) return { from, to };
      return expandToMonthRange(from, to);
    });

    return { filter, rangeMode, weekFilter, monthFilter };
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

    // Real-time listener on `userStats/{userId}` so server-side aggregation
    // updates (heatmap, best entries) flow into the analysis page without
    // requiring a manual reload.
    const userStatsResource = rxResource({
      params: () => ({ userId: store._user.userIdSafe() }),
      stream: ({ params }) =>
        params.userId
          ? store._userStatsApi.getUserStats(params.userId)
          : of(null),
    });

    const weekEntriesResource = resource({
      params: () => store.weekFilter(),
      loader: async ({ params }) =>
        firstValueFrom(store._api.listPushups(params)),
    });

    const monthEntriesResource = resource({
      params: () => store.monthFilter(),
      loader: async ({ params }) =>
        firstValueFrom(store._api.listPushups(params)),
    });

    return {
      statsResource,
      entriesResource,
      userStatsResource,
      weekEntriesResource,
      monthEntriesResource,
    };
  }),
  withComputed((store) => {
    const stats = computed(() => store.statsResource.value() ?? EMPTY_STATS);
    const chartSeries = computed<StatsSeriesEntry[]>(() => stats().series);
    const granularity = computed<StatsGranularity>(
      () => stats().meta.granularity
    );
    /** Resolved dayChartMode: user's explicit toggle, or API's resolved value from user config. */
    const resolvedDayChartMode = computed<'24h' | '14h'>(
      () => store.dayChartMode() ?? stats().meta.dayChartMode ?? '14h'
    );
    const rows = computed(() => store.entriesResource.value() ?? []);

    const weekRows = computed(() => store.weekEntriesResource.value() ?? []);
    const weekTrend = computed<TrendPoint[]>(() => {
      const byWeek = new Map<
        string,
        { total: number; entryCount: number; setsCount: number }
      >();
      for (const row of weekRows()) {
        const date = new Date(row.timestamp);
        const year = isoWeekYear(date);
        const week = String(isoWeek(date)).padStart(2, '0');
        const key = `${year}-W${week}`;
        const entry = byWeek.get(key) ?? {
          total: 0,
          entryCount: 0,
          setsCount: 0,
        };
        entry.total += row.reps;
        entry.entryCount += 1;
        entry.setsCount += row.sets?.length ?? 0;
        byWeek.set(key, entry);
      }
      return [...byWeek.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-8)
        .map(([label, { total, entryCount, setsCount }]) => ({
          label,
          total,
          avgSetsPerEntry: entryCount
            ? Math.round((setsCount / entryCount) * 10) / 10
            : 0,
        }));
    });

    const monthRows = computed(() => store.monthEntriesResource.value() ?? []);
    const monthTrend = computed<TrendPoint[]>(() => {
      const byMonth = new Map<
        string,
        { total: number; entryCount: number; setsCount: number }
      >();
      for (const row of monthRows()) {
        const date = new Date(row.timestamp);
        const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const entry = byMonth.get(label) ?? {
          total: 0,
          entryCount: 0,
          setsCount: 0,
        };
        entry.total += row.reps;
        entry.entryCount += 1;
        entry.setsCount += row.sets?.length ?? 0;
        byMonth.set(label, entry);
      }
      return [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([label, { total, entryCount, setsCount }]) => ({
          label,
          total,
          avgSetsPerEntry: entryCount
            ? Math.round((setsCount / entryCount) * 10) / 10
            : 0,
        }));
    });

    const typeBreakdown = computed<TypeBreakdownDatum[]>(() => {
      const byType = new Map<string, { reps: number; allSets: number[] }>();
      for (const row of rows()) {
        const type = (row.type || 'Standard').trim() || 'Standard';
        const entry = byType.get(type) ?? { reps: 0, allSets: [] };
        entry.reps += row.reps;
        if (row.sets?.length) entry.allSets.push(...row.sets);
        byType.set(type, entry);
      }
      return [...byType.entries()]
        .sort((a, b) => b[1].reps - a[1].reps)
        .map(([label, { reps, allSets }]) => ({
          label,
          value: reps,
          avgSetSize: allSets.length
            ? Math.round(
                (allSets.reduce((s, v) => s + v, 0) / allSets.length) * 10
              ) / 10
            : 0,
        }));
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

    /** Average reps per individual set across all entries with sets data. */
    const avgSetSize = computed(() => {
      const allSets = rows().flatMap((r) => r.sets ?? []);
      if (!allSets.length) return 0;
      return (
        Math.round((allSets.reduce((s, v) => s + v, 0) / allSets.length) * 10) /
        10
      );
    });

    /** Distribution of entries by number of sets (e.g. "3 sets" → 40%). */
    const setsDistribution = computed<
      Array<{ setCount: number; count: number; percent: number }>
    >(() => {
      const entriesWithSets = rows().filter((r) => r.sets?.length);
      if (!entriesWithSets.length) return [];
      const byCount = new Map<number, number>();
      for (const row of entriesWithSets) {
        const setCount = row.sets!.length;
        byCount.set(setCount, (byCount.get(setCount) ?? 0) + 1);
      }
      const total = entriesWithSets.length;
      return [...byCount.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([setCount, count]) => ({
          setCount,
          count,
          percent: Math.round((count / total) * 100),
        }));
    });

    /** Maximum reps in a single set across all entries. */
    const bestSingleSet = computed(() => {
      const allSets = rows().flatMap((r) => r.sets ?? []);
      if (!allSets.length) return 0;
      return Math.max(...allSets);
    });

    const weekTrendSubtitle = computed(() => {
      const { from, to } = store.weekFilter();
      if (!from || !to) return '';
      const fromDate = new Date(`${from}T00:00:00`);
      const toDate = new Date(`${to}T00:00:00`);
      const sameYear = fromDate.getFullYear() === toDate.getFullYear();
      const fmtFrom = new Intl.DateTimeFormat(store._locale, {
        day: 'numeric',
        month: 'short',
        ...(sameYear ? {} : { year: 'numeric' }),
      });
      const fmtTo = new Intl.DateTimeFormat(store._locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return `${fmtFrom.format(fromDate)} – ${fmtTo.format(toDate)}`;
    });

    const monthTrendSubtitle = computed(() => {
      const { from, to } = store.monthFilter();
      if (!from || !to) return '';
      const fromDate = new Date(`${from}T00:00:00`);
      const toDate = new Date(`${to}T00:00:00`);
      const sameMonth =
        fromDate.getMonth() === toDate.getMonth() &&
        fromDate.getFullYear() === toDate.getFullYear();
      if (sameMonth) {
        return new Intl.DateTimeFormat(store._locale, {
          month: 'long',
          year: 'numeric',
        }).format(fromDate);
      }
      const sameYear = fromDate.getFullYear() === toDate.getFullYear();
      const fmtFrom = new Intl.DateTimeFormat(store._locale, {
        month: 'long',
        ...(sameYear ? {} : { year: 'numeric' }),
      });
      const fmtTo = new Intl.DateTimeFormat(store._locale, {
        month: 'long',
        year: 'numeric',
      });
      return `${fmtFrom.format(fromDate)} – ${fmtTo.format(toDate)}`;
    });

    return {
      stats,
      chartSeries,
      granularity,
      rows,
      weekTrend,
      monthTrend,
      weekTrendSubtitle,
      monthTrendSubtitle,
      typeBreakdown,
      bestSingleEntry,
      bestDay,
      longestStreak,
      currentStreak,
      userStats,
      heatmapData,
      avgSetSize,
      setsDistribution,
      bestSingleSet,
      resolvedDayChartMode,
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
    setDayChartMode(dayChartMode: '24h' | '14h'): void {
      patchState(store, { dayChartMode });
    },
    refreshAll(): void {
      store.statsResource.reload();
      store.entriesResource.reload();
      store.userStatsResource.reload();
      store.weekEntriesResource.reload();
      store.monthEntriesResource.reload();
    },
  }))
);
