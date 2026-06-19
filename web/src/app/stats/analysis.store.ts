import { computed, inject, LOCALE_ID } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { of } from 'rxjs';
import { UserStatsApiService } from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import { UserContextService } from '@pu-auth/auth';
import {
  exerciseEntryToUnified,
  type ExerciseDefinition,
  findExerciseDefinition,
  type MeasurementType,
  type StatsGranularity,
  type UnifiedEntry,
  unifiedEntryCategoryId,
  type UnifiedEntryFilterKey,
  unifiedEntryFilterKey,
  type UserStats,
} from '@pu-stats/models';
import {
  createWeekRange,
  inferRangeMode,
  toLocalIsoDate,
} from '@pu-stats/date';
import type {
  AnalysisView,
  CategoryComparison,
  CategorySummary,
  ChartFeedEntry,
  TrendPoint,
  TypeBreakdownDatum,
} from './analysis/analysis.types';
import {
  buildCategoryComparison,
  buildCategorySummaries,
} from './analysis/category-volume';
import {
  buildViewChartEntries,
  buildViewChartSeries,
  buildViewPaceSeries,
  computeViewMeasurement,
} from './analysis/chart-series';
import {
  computeAvgSetSize,
  computeBestDay,
  computeBestSingleEntry,
  computeBestSingleSet,
  computeSetsDistribution,
  computeTypeBreakdown,
} from './analysis/entry-stats';
import {
  buildMonthTrend,
  buildWeekTrend,
  computeCurrentStreak,
  computeLongestStreak,
  startOfIsoWeek,
  startOfMonth,
  TREND_MONTHS,
  TREND_WEEKS,
} from './analysis/trend-math';

type AnalysisState = {
  from: string;
  to: string;
  dayChartMode: '24h' | '14h' | undefined;
  /**
   * Active exercise-kind filter for the type-pie. In overview the
   * empty array (default) and `['pushup']` render the pushup-variant
   * breakdown; any other non-empty subset switches to kind-mode
   * (pushups collapsed into one bucket, each `exerciseId` as its own
   * slice). Streaks and best-day KPIs are no longer pushup-only —
   * they live on {@link AnalysisStore.viewFilteredRows} and follow
   * {@link AnalysisState.activeView} instead.
   */
  kinds: ReadonlyArray<UnifiedEntryFilterKey>;
  /**
   * Active per-category view tab. `'overview'` (default) keeps the
   * page-wide aggregate behaviour; any other value scopes
   * {@link AnalysisStore.viewFilteredRows} and all downstream KPIs,
   * trends and the type-pie to entries from that category.
   */
  activeView: AnalysisView;
  // Reactive dependency for the fixed-window trend filters: bumped only
  // when the local calendar day actually changes, so a polling interval
  // can call `tickClock()` aggressively without forcing
  // `weekFilter`/`monthFilter` to emit new params each minute (which would
  // otherwise re-trigger the trend resource loaders and flicker the empty
  // CTA back to false during the reload).
  clockTick: number;
  lastDayKey: string;
};

export const AnalysisStore = signalStore(
  withState<AnalysisState>(() => {
    const defaultRange = createWeekRange();
    return {
      from: defaultRange.from,
      to: defaultRange.to,
      dayChartMode: undefined as '24h' | '14h' | undefined,
      kinds: [] as ReadonlyArray<UnifiedEntryFilterKey>,
      activeView: 'overview' as AnalysisView,
      clockTick: 0,
      // Seed with today so the first `tickClock()` after construction is a
      // no-op; otherwise the 5-minute polling interval would force a
      // spurious reload of weekEntriesResource/monthEntriesResource on
      // its first iteration even when the calendar day hasn't changed.
      lastDayKey: toLocalIsoDate(new Date()),
    };
  }),
  withProps(() => {
    const userStatsApi = inject(UserStatsApiService);
    const user = inject(UserContextService);
    const live = inject(LiveDataStore);
    const locale = inject(LOCALE_ID);
    return {
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

    return {
      userStatsResource,
    };
  }),
  withComputed((store) => {
    /** Resolved dayChartMode: user's explicit toggle or default. */
    const resolvedDayChartMode = computed<'24h' | '14h'>(
      () => store.dayChartMode() ?? '14h'
    );

    const unifiedRows = computed<UnifiedEntry[]>(() => {
      const from = store.from();
      const to = store.to();
      return store._live
        .exerciseEntries()
        .filter((e) => {
          const date = e.timestamp.slice(0, 10);
          if (from && date < from) return false;
          if (to && date > to) return false;
          return true;
        })
        .map(exerciseEntryToUnified);
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

    // Resolver chain for `unifiedEntryCategoryId`: the standard catalog
    // first, then the user's custom definitions from `LiveDataStore`.
    // Custom definitions are keyed by id so a sparse list is fine for
    // typical user-defined counts (well under a hundred per user).
    //
    // Entries whose `exerciseId` is absent from both layers still drop
    // out of every per-category tab — the resolver returns `null` and
    // no tab matches. That's intentional: the overview tab continues
    // to surface their volume, and resurrecting them under an "Andere"
    // bucket would mask catalog/definition drift.
    const resolveDefinition = computed<
      (id: string) => ExerciseDefinition | null
    >(() => {
      const userDefs = store._live.exerciseDefinitions();
      if (!userDefs.length) return findExerciseDefinition;
      const byId = new Map<string, ExerciseDefinition>(
        userDefs.map((d) => [d.id, d])
      );
      return (id: string) => findExerciseDefinition(id) ?? byId.get(id) ?? null;
    });

    const viewFilteredRows = computed<UnifiedEntry[]>(() => {
      const view = store.activeView();
      if (view === 'overview') return unifiedRows();
      const resolver = resolveDefinition();
      return unifiedRows().filter(
        (row) => unifiedEntryCategoryId(row, resolver) === view
      );
    });

    /**
     * Granularity of {@link viewChartSeries}. Tracked separately from
     * the REST-derived {@link granularity} (which lags the resource
     * during cold-start / filter changes) so the chart's axis mode,
     * dayChartMode toggle visibility and sets-stacking bucket-keying
     * stay locked to the bucketing actually produced for the view.
     */
    const viewGranularity = computed<StatsGranularity>(() => {
      const from = store.from();
      const to = store.to();
      return !!from && !!to && from === to ? 'hourly' : 'daily';
    });

    const viewMeasurement = computed<MeasurementType | 'mixed' | null>(() =>
      computeViewMeasurement(viewFilteredRows())
    );

    const viewChartSeries = computed(() =>
      buildViewChartSeries(viewFilteredRows(), {
        from: store.from(),
        isDayRange: viewGranularity() === 'hourly',
        dayChartMode: resolvedDayChartMode(),
        measurement: viewMeasurement(),
      })
    );

    const viewPaceSeries = computed(() =>
      buildViewPaceSeries(viewFilteredRows(), viewChartSeries(), {
        from: store.from(),
        isDayRange: viewGranularity() === 'hourly',
        dayChartMode: resolvedDayChartMode(),
        measurement: viewMeasurement(),
      })
    );

    const viewChartEntries = computed<ChartFeedEntry[]>(() =>
      buildViewChartEntries(viewFilteredRows(), viewMeasurement())
    );

    /**
     * Per-category roll-up for the overview tab. Always operates on
     * the full unified row set in the current date range — independent
     * of {@link AnalysisStore.activeView} — because the cards/chart in
     * the overview show every group side-by-side.
     *
     * `lastDayKey` is read so `todayReps` re-evaluates after a
     * `tickClock()` crosses midnight without forcing an extra signal.
     */
    const categorySummaries = computed<CategorySummary[]>(() =>
      buildCategorySummaries(
        unifiedRows(),
        resolveDefinition(),
        store.lastDayKey()
      )
    );

    const categoryComparison = computed<CategoryComparison>(() =>
      buildCategoryComparison(categorySummaries())
    );

    // Trend rows mirror the activeView filter so the 8-week and
    // 6-month windows reflect the same category as the rest of the
    // page. The live feed carries the full history, so we just clip
    // to the trend window client-side.
    const trendUnifiedRows = (window: {
      from: string;
      to: string;
    }): UnifiedEntry[] => {
      return store._live
        .exerciseEntries()
        .filter((e) => {
          const date = e.timestamp.slice(0, 10);
          if (date < window.from) return false;
          if (date > window.to) return false;
          return true;
        })
        .map(exerciseEntryToUnified);
    };

    const applyViewFilter = (rows: UnifiedEntry[]): UnifiedEntry[] => {
      const view = store.activeView();
      if (view === 'overview') return rows;
      const resolver = resolveDefinition();
      return rows.filter(
        (row) => unifiedEntryCategoryId(row, resolver) === view
      );
    };

    const weekTrend = computed<TrendPoint[]>(() =>
      buildWeekTrend(
        applyViewFilter(trendUnifiedRows(store.weekFilter())),
        store.currentMonday()
      )
    );

    const monthTrend = computed<TrendPoint[]>(() =>
      buildMonthTrend(
        applyViewFilter(trendUnifiedRows(store.monthFilter())),
        store.currentMonthStart()
      )
    );

    const typeBreakdown = computed<TypeBreakdownDatum[]>(() =>
      computeTypeBreakdown(viewFilteredRows(), {
        view: store.activeView(),
        kinds: store.kinds(),
        locale: store._locale,
      })
    );

    const bestSingleEntry = computed<UnifiedEntry | null>(() =>
      computeBestSingleEntry(viewFilteredRows())
    );

    const bestDay = computed<{ date: string; total: number } | null>(() =>
      computeBestDay(viewFilteredRows())
    );

    const longestStreak = computed(() =>
      computeLongestStreak(viewFilteredRows())
    );

    const currentStreak = computed(() =>
      computeCurrentStreak(viewFilteredRows())
    );

    /** Precomputed server-side stats (null if not yet available). */
    const userStats = computed<UserStats | null>(
      () => store.userStatsResource.value() ?? null
    );

    /** Server-side heatmap data (weekday-hour → cumulative reps). */
    const heatmapData = computed<Record<string, number>>(
      () => userStats()?.heatmap ?? {}
    );

    const avgSetSize = computed(() => computeAvgSetSize(viewFilteredRows()));

    const setsDistribution = computed(() =>
      computeSetsDistribution(viewFilteredRows())
    );

    const bestSingleSet = computed(() =>
      computeBestSingleSet(viewFilteredRows())
    );

    return {
      viewChartSeries,
      viewChartEntries,
      viewGranularity,
      viewMeasurement,
      viewPaceSeries,
      unifiedRows,
      viewFilteredRows,
      categorySummaries,
      categoryComparison,
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
    setActiveView(activeView: AnalysisView): void {
      patchState(store, { activeView });
    },
    refreshAll(): void {
      store.userStatsResource.reload();
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
