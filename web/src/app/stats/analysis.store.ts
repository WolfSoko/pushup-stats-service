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
import {
  LiveDataStore,
  StatsApiService,
  UserStatsApiService,
} from '@pu-stats/data-access';
import { UserContextService } from '@pu-auth/auth';
import {
  canonicalizePushupType,
  createWeekRange,
  displayPushupType,
  exerciseEntryToUnified,
  inferRangeMode,
  PushupRecord,
  pushupRecordToUnified,
  StatsGranularity,
  StatsResponse,
  StatsSeriesEntry,
  toLocalIsoDate,
  UnifiedEntry,
  UnifiedEntryFilterKey,
  unifiedEntryFilterKey,
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
  /** Canonical pushup type id — stable across locales. */
  id: string;
  label: string;
  value: number;
  avgSetSize: number;
}

type AnalysisState = {
  from: string;
  to: string;
  dayChartMode: '24h' | '14h' | undefined;
  /**
   * Active exercise-kind filter for the type-pie. Empty array and
   * `['pushup']` render the pushup-variant breakdown; any other
   * non-empty subset switches to kind-mode (pushups collapsed into
   * one bucket, each `exerciseId` as its own slice). Streaks/best-day
   * KPIs stay pushup-only.
   */
  kinds: ReadonlyArray<UnifiedEntryFilterKey>;
  // Reactive dependency for the fixed-window trend filters: bumped only
  // when the local calendar day actually changes, so a polling interval
  // can call `tickClock()` aggressively without forcing
  // `weekFilter`/`monthFilter` to emit new params each minute (which would
  // otherwise re-trigger the trend resource loaders and flicker the empty
  // CTA back to false during the reload).
  clockTick: number;
  lastDayKey: string;
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

const TREND_WEEKS = 8;
const TREND_MONTHS = 6;

/** Monday of the ISO week containing the given date (local time, midnight). */
function startOfIsoWeek(date: Date): Date {
  const day = date.getDay() || 7;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - (day - 1)
  );
}

/** First day of the calendar month containing the given date. */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export const AnalysisStore = signalStore(
  withState<AnalysisState>(() => {
    const defaultRange = createWeekRange();
    return {
      from: defaultRange.from,
      to: defaultRange.to,
      dayChartMode: undefined as '24h' | '14h' | undefined,
      kinds: [] as ReadonlyArray<UnifiedEntryFilterKey>,
      clockTick: 0,
      // Seed with today so the first `tickClock()` after construction is a
      // no-op; otherwise the 5-minute polling interval would force a
      // spurious reload of weekEntriesResource/monthEntriesResource on
      // its first iteration even when the calendar day hasn't changed.
      lastDayKey: toLocalIsoDate(new Date()),
    };
  }),
  withProps(() => {
    const api = inject(StatsApiService);
    const userStatsApi = inject(UserStatsApiService);
    const user = inject(UserContextService);
    const live = inject(LiveDataStore);
    const locale = inject(LOCALE_ID);
    return {
      _api: api,
      _userStatsApi: userStatsApi,
      _user: user,
      _live: live,
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

    // Trends always span a fixed window ending today, independent of the
    // page filter: 8 ISO weeks for weekTrend, 6 calendar months for
    // monthTrend. This is intentional — users want to read recent
    // momentum, not a slice of an arbitrary filter range. The
    // `clockTick` signal is read so a session kept open across midnight
    // re-evaluates the window when `tickClock()` fires.
    const currentMonday = computed(() => {
      store.clockTick();
      return startOfIsoWeek(new Date());
    });
    const currentMonthStart = computed(() => {
      store.clockTick();
      return startOfMonth(new Date());
    });

    const weekFilter = computed(() => {
      const monday = currentMonday();
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const from = new Date(monday);
      from.setDate(monday.getDate() - 7 * (TREND_WEEKS - 1));
      return {
        from: toLocalIsoDate(from),
        to: toLocalIsoDate(sunday),
      };
    });
    const monthFilter = computed(() => {
      const start = currentMonthStart();
      const from = new Date(
        start.getFullYear(),
        start.getMonth() - (TREND_MONTHS - 1),
        1
      );
      const to = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      return {
        from: toLocalIsoDate(from),
        to: toLocalIsoDate(to),
      };
    });

    return {
      filter,
      rangeMode,
      weekFilter,
      monthFilter,
      currentMonday,
      currentMonthStart,
    };
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

    // Pushup rows come from the REST resource (works on SSR); exercise
    // entries come from the live Firestore snapshot, so SSR yields
    // pushups only.
    const unifiedRows = computed<UnifiedEntry[]>(() => {
      const from = store.from();
      const to = store.to();
      const inRange = (timestamp: string): boolean => {
        const date = timestamp.slice(0, 10);
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
      };
      const pushups = rows()
        .filter((r) => inRange(r.timestamp))
        .map(pushupRecordToUnified);
      const exercises = store._live
        .exerciseEntries()
        .filter((e) => inRange(e.timestamp))
        .map(exerciseEntryToUnified);
      return [...pushups, ...exercises];
    });

    /** Distinct kind keys with at least one entry in the visible range. */
    const kindOptionsRaw = computed<UnifiedEntryFilterKey[]>(() => {
      const seen = new Set<UnifiedEntryFilterKey>();
      for (const row of unifiedRows()) {
        seen.add(unifiedEntryFilterKey(row));
      }
      return [...seen].sort((a, b) => {
        if (a === 'pushup') return -1;
        if (b === 'pushup') return 1;
        return a.localeCompare(b);
      });
    });

    const weekRows = computed(() => store.weekEntriesResource.value() ?? []);
    const weekTrend = computed<TrendPoint[]>(() => {
      // Pre-seed TREND_WEEKS ISO weeks (oldest → newest) so a sparse
      // history still produces a fixed-length trend with explicit zero
      // rows; otherwise users would silently see fewer than 8 buckets.
      const monday = store.currentMonday();
      const byWeek = new Map<
        string,
        { total: number; entryCount: number; setsCount: number }
      >();
      for (let i = TREND_WEEKS - 1; i >= 0; i--) {
        const d = new Date(monday);
        d.setDate(monday.getDate() - i * 7);
        const key = `${isoWeekYear(d)}-W${String(isoWeek(d)).padStart(2, '0')}`;
        byWeek.set(key, { total: 0, entryCount: 0, setsCount: 0 });
      }
      for (const row of weekRows()) {
        const date = new Date(row.timestamp);
        const key = `${isoWeekYear(date)}-W${String(isoWeek(date)).padStart(2, '0')}`;
        const entry = byWeek.get(key);
        if (!entry) continue;
        entry.total += row.reps;
        entry.entryCount += 1;
        entry.setsCount += row.sets?.length ?? 0;
      }
      return [...byWeek.entries()].map(
        ([label, { total, entryCount, setsCount }]) => ({
          label,
          total,
          avgSetsPerEntry: entryCount
            ? Math.round((setsCount / entryCount) * 10) / 10
            : undefined,
        })
      );
    });

    const monthRows = computed(() => store.monthEntriesResource.value() ?? []);
    const monthTrend = computed<TrendPoint[]>(() => {
      const monthStart = store.currentMonthStart();
      const byMonth = new Map<
        string,
        { total: number; entryCount: number; setsCount: number }
      >();
      for (let i = TREND_MONTHS - 1; i >= 0; i--) {
        const d = new Date(
          monthStart.getFullYear(),
          monthStart.getMonth() - i,
          1
        );
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMonth.set(key, { total: 0, entryCount: 0, setsCount: 0 });
      }
      for (const row of monthRows()) {
        const date = new Date(row.timestamp);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const entry = byMonth.get(key);
        if (!entry) continue;
        entry.total += row.reps;
        entry.entryCount += 1;
        entry.setsCount += row.sets?.length ?? 0;
      }
      return [...byMonth.entries()].map(
        ([label, { total, entryCount, setsCount }]) => ({
          label,
          total,
          avgSetsPerEntry: entryCount
            ? Math.round((setsCount / entryCount) * 10) / 10
            : undefined,
        })
      );
    });

    const typeBreakdown = computed<TypeBreakdownDatum[]>(() => {
      const kinds = store.kinds();
      const kindSet = kinds.length > 0 ? new Set<string>(kinds) : null;
      const onlyPushup =
        !kindSet || (kindSet.size === 1 && kindSet.has('pushup'));

      if (onlyPushup) {
        const byType = new Map<string, { reps: number; allSets: number[] }>();
        for (const row of rows()) {
          const key = canonicalizePushupType(row.type) || 'standard';
          const entry = byType.get(key) ?? { reps: 0, allSets: [] };
          entry.reps += row.reps;
          if (row.sets?.length) entry.allSets.push(...row.sets);
          byType.set(key, entry);
        }
        return [...byType.entries()]
          .sort((a, b) => b[1].reps - a[1].reps)
          .map(([key, { reps, allSets }]) => ({
            id: key,
            label: displayPushupType(key, store._locale),
            value: reps,
            avgSetSize: allSets.length
              ? Math.round(
                  (allSets.reduce((s, v) => s + v, 0) / allSets.length) * 10
                ) / 10
              : 0,
          }));
      }

      // Reps-only view: `time` and `distance-time` exercises surface
      // with `value = 0` until per-measurement charts land. Label is
      // emitted as the bare key — `$localize` for kind names lives in
      // the page component.
      const byKind = new Map<string, { reps: number; allSets: number[] }>();
      for (const row of unifiedRows()) {
        const key = unifiedEntryFilterKey(row);
        if (kindSet && !kindSet.has(key)) continue;
        const bucket = byKind.get(key) ?? { reps: 0, allSets: [] };
        bucket.reps += row.reps;
        if (row.sets?.length) bucket.allSets.push(...row.sets);
        byKind.set(key, bucket);
      }
      return [...byKind.entries()]
        .sort((a, b) => b[1].reps - a[1].reps)
        .map(([key, { reps, allSets }]) => ({
          id: key,
          // Caller maps id → localised label.
          label: key,
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

    return {
      stats,
      chartSeries,
      granularity,
      rows,
      unifiedRows,
      kindOptionsRaw,
      weekTrend,
      monthTrend,
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
    setKinds(kinds: ReadonlyArray<UnifiedEntryFilterKey>): void {
      patchState(store, { kinds });
    },
    refreshAll(): void {
      store.statsResource.reload();
      store.entriesResource.reload();
      store.userStatsResource.reload();
      store.weekEntriesResource.reload();
      store.monthEntriesResource.reload();
    },
    tickClock(): void {
      const todayKey = toLocalIsoDate(new Date());
      if (todayKey === store.lastDayKey()) return;
      patchState(store, {
        clockTick: store.clockTick() + 1,
        lastDayKey: todayKey,
      });
    },
  }))
);
