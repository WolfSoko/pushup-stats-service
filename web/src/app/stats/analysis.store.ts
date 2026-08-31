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
import { inferRangeMode, toLocalIsoDate } from '@pu-stats/date';
import type {
  AnalysisView,
  CategoryComparison,
  CategorySummary,
  TrendPoint,
} from './analysis/analysis.types';
import {
  buildCategoryComparison,
  buildCategorySummaries,
} from './analysis/category-volume';
import { computeViewMeasurement } from './analysis/chart-series';
import { granularityForRange } from './analysis/chart-granularity';
import {
  type AnalysisSegment,
  buildAnalysisSegments,
} from './analysis/view-segments';
import {
  buildMonthTrend,
  buildWeekTrend,
  computeCurrentStreak,
  computeLongestStreak,
  startOfIsoWeek,
  startOfMonth,
} from './analysis/trend-math';
import {
  type BarMode,
  collectExerciseIds,
  exerciseColor,
  withoutHiddenExercises,
} from './analysis/exercise-breakdown';
import { kindDisplayName } from './i18n/exercise-display-names';
import { monthTrendWindow, weekTrendWindow } from './analysis/trend-windows';
import {
  type AnalysisState,
  createInitialAnalysisState,
} from './analysis/analysis.state';

export const AnalysisStore = signalStore(
  withState<AnalysisState>(createInitialAnalysisState),
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

    const weekFilter = computed(() => weekTrendWindow(currentMonday()));
    const monthFilter = computed(() => monthTrendWindow(currentMonthStart()));

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

    /**
     * Every exercise with an entry in the range, heaviest first —
     * derived from the *unfiltered* rows so unchecking one neither
     * removes its own checkbox nor recolours the rest.
     */
    const exerciseOptions = computed<string[]>(() =>
      collectExerciseIds(unifiedRows())
    );

    /** Localised name + page-wide colour for one exercise id. */
    const toExerciseChoice = (id: string, order: ReadonlyArray<string>) => ({
      id,
      label: kindDisplayName(id as UnifiedEntryFilterKey),
      color: exerciseColor(id, order),
    });

    /**
     * The checkbox list for the active tab: the exercises that tab
     * actually shows, named and coloured. Scoped to the view (a
     * `core` tab must not offer to hide Liegestütze — unchecking it
     * would change nothing on screen) but coloured from the page-wide
     * {@link exerciseOptions}, so an exercise keeps its colour when
     * the user switches tabs.
     *
     * Built from rows *before* the hidden filter, so unchecking an
     * exercise never removes the checkbox that undoes it.
     */
    /**
     * The active view's rows *before* the visibility filter. Feeds
     * every list of offered exercises — a checkbox has to survive being
     * unchecked, or there is nothing left to click to undo it.
     */
    const viewRowsBeforeHiding = computed<UnifiedEntry[]>(() => {
      const view = store.activeView();
      if (view === 'overview') return unifiedRows();
      const resolver = resolveDefinition();
      return unifiedRows().filter(
        (row) => unifiedEntryCategoryId(row, resolver) === view
      );
    });

    const exerciseChoices = computed(() =>
      collectExerciseIds(viewRowsBeforeHiding()).map((id) =>
        toExerciseChoice(id, exerciseOptions())
      )
    );

    /**
     * The page's working row set: the range minus the exercises the
     * user unchecked. Every downstream roll-up reads this rather than
     * {@link unifiedRows} so the checkboxes filter the whole tab.
     * {@link unifiedRows} stays unfiltered for the empty-state gate —
     * hiding every exercise must not read as "you have no data".
     */
    const visibleRows = computed<UnifiedEntry[]>(() =>
      withoutHiddenExercises(unifiedRows(), store.hiddenExerciseIds())
    );

    /**
     * Whether the range holds any row the catalog can place in a
     * category — computed on the *unfiltered* rows. The overview gates
     * its category branch on this rather than on
     * {@link categorySummaries}, which follows the visibility
     * checkboxes: unchecking every exercise must leave the user on an
     * empty overview they can undo, not drop them into the
     * "belongs to no known category" fallback.
     */
    const hasCategorisableRows = computed<boolean>(() => {
      const resolver = resolveDefinition();
      return unifiedRows().some(
        (row) => unifiedEntryCategoryId(row, resolver) !== null
      );
    });

    const viewFilteredRows = computed<UnifiedEntry[]>(() => {
      const view = store.activeView();
      if (view === 'overview') return visibleRows();
      const resolver = resolveDefinition();
      return visibleRows().filter(
        (row) => unifiedEntryCategoryId(row, resolver) === view
      );
    });

    /**
     * Granularity of {@link viewSegments}: one bucket size per filter
     * period (day → hours, week → days, month → weeks, year → months,
     * custom → by span), so a long range stays at a readable number of
     * bars. Tracked
     * separately from the REST-derived {@link granularity} (which lags
     * the resource during cold-start / filter changes) so the chart's
     * axis mode, dayChartMode toggle visibility and sets-stacking
     * bucket-keying stay locked to the bucketing actually produced for
     * the view.
     */
    const viewGranularity = computed<StatsGranularity>(() =>
      granularityForRange(store.rangeMode(), store.from(), store.to())
    );

    const viewMeasurement = computed<MeasurementType | 'mixed' | null>(() =>
      computeViewMeasurement(viewFilteredRows())
    );

    /**
     * Per-category roll-up for the overview tab. Spans every category
     * in the range — independent of {@link AnalysisStore.activeView},
     * because the cards/chart show all groups side-by-side — but it
     * does follow the visibility checkboxes via {@link visibleRows}.
     * It is therefore *not* the right signal for "does this range hold
     * any categorisable data"; that's {@link hasCategorisableRows}.
     *
     * `lastDayKey` is read so `todayReps` re-evaluates after a
     * `tickClock()` crosses midnight without forcing an extra signal.
     */
    const categorySummaries = computed<CategorySummary[]>(() =>
      buildCategorySummaries(
        visibleRows(),
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
      const visible = withoutHiddenExercises(rows, store.hiddenExerciseIds());
      const view = store.activeView();
      if (view === 'overview') return visible;
      const resolver = resolveDefinition();
      return visible.filter(
        (row) => unifiedEntryCategoryId(row, resolver) === view
      );
    };

    // Memoised so the whole live feed is walked once per trend window
    // rather than again for every consumer — the page filter and the
    // 24h/14h toggle feed `viewSegments` but must not re-derive these.
    const weekRows = computed<UnifiedEntry[]>(() =>
      applyViewFilter(trendUnifiedRows(store.weekFilter()))
    );

    const monthRows = computed<UnifiedEntry[]>(() =>
      applyViewFilter(trendUnifiedRows(store.monthFilter()))
    );

    const weekTrend = computed<TrendPoint[]>(() =>
      buildWeekTrend(weekRows(), store.currentMonday())
    );

    const monthTrend = computed<TrendPoint[]>(() =>
      buildMonthTrend(monthRows(), store.currentMonthStart())
    );

    /**
     * The whole tab body, split per measurement: chart, best values,
     * type breakdown and both trends. A category mixing counted and
     * timed exercises (`core`: sit-ups + planks) renders one block per
     * dimension instead of summing reps and seconds into one number.
     */
    const viewSegments = computed<AnalysisSegment[]>(() =>
      buildAnalysisSegments({
        rangeRows: viewFilteredRows(),
        weekRows: weekRows(),
        monthRows: monthRows(),
        monday: store.currentMonday(),
        monthStart: store.currentMonthStart(),
        chart: {
          from: store.from(),
          granularity: viewGranularity(),
          dayChartMode: resolvedDayChartMode(),
        },
        breakdown: {
          view: store.activeView(),
          kinds: store.kinds(),
          locale: store._locale,
        },
        exerciseOrder: exerciseOptions(),
        optionRows: viewRowsBeforeHiding(),
        resolveDefinition: resolveDefinition(),
      })
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

    return {
      viewSegments,
      viewGranularity,
      viewMeasurement,
      unifiedRows,
      visibleRows,
      viewRowsBeforeHiding,
      hasCategorisableRows,
      exerciseOptions,
      exerciseChoices,
      viewFilteredRows,
      categorySummaries,
      categoryComparison,
      kindOptionsRaw,
      weekTrend,
      monthTrend,
      longestStreak,
      currentStreak,
      userStats,
      heatmapData,
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
    setBarMode(barMode: BarMode): void {
      patchState(store, { barMode });
    },
    toggleExerciseVisibility(exerciseId: string): void {
      const hidden = store.hiddenExerciseIds();
      patchState(store, {
        hiddenExerciseIds: hidden.includes(exerciseId)
          ? hidden.filter((id) => id !== exerciseId)
          : [...hidden, exerciseId],
      });
    },
    showAllExercises(): void {
      patchState(store, { hiddenExerciseIds: [] });
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
