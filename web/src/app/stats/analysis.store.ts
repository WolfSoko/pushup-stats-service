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
  type ExerciseCategoryId,
  EXERCISE_CATEGORIES,
  inferRangeMode,
  PushupRecord,
  pushupRecordToUnified,
  StatsGranularity,
  StatsResponse,
  StatsSeriesEntry,
  toLocalIsoDate,
  UnifiedEntry,
  unifiedEntryCategoryId,
  UnifiedEntryFilterKey,
  unifiedEntryFilterKey,
  UserStats,
} from '@pu-stats/models';
import { categoryDisplayName } from './i18n/exercise-display-names';

/** Active analysis view: overview tab or a specific exercise category. */
export type AnalysisView = 'overview' | ExerciseCategoryId;

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

/**
 * Per-category roll-up consumed by the analysis overview tab. The
 * cards render `nameKey`/`icon`, and the comparison chart pulls
 * `totalReps`/`totalSets` from the same shape so the two views stay
 * in lockstep. Categories with no entries in the current date range
 * are filtered out upstream — every entry here represents a present,
 * non-empty group.
 */
export interface CategorySummary {
  categoryId: ExerciseCategoryId;
  nameKey: string;
  icon: string;
  order: number;
  totalReps: number;
  totalSets: number;
  todayReps: number;
  currentStreak: number;
  bestDay: { date: string; total: number } | null;
}

/** Series shape consumed by the overview comparison chart. */
export interface CategoryComparison {
  labels: ReadonlyArray<string>;
  reps: ReadonlyArray<number>;
  sets: ReadonlyArray<number>;
}

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

function sortedUniqueDates(
  rows: ReadonlyArray<{ timestamp: string }>
): string[] {
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

    // The stats-chart's stacked-bar layer reads `timestamp`, `reps` and
    // optional `sets[]`. UnifiedEntry already declares all three on its
    // base, so Pick keeps the structural feed in lockstep with the
    // canonical model — no parallel field list to drift.
    type ChartFeedEntry = Pick<UnifiedEntry, 'timestamp' | 'reps' | 'sets'>;

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

    // Entries whose exerciseId is absent from the standard catalog
    // (e.g. a removed-and-never-replaced custom user exercise) drop
    // out of every per-category tab — `unifiedEntryCategoryId` returns
    // null and no tab matches. That's intentional: the overview tab
    // still surfaces their volume, and resurrecting them under an
    // "Andere" bucket would mask the catalog-mismatch in normal use.
    const viewFilteredRows = computed<UnifiedEntry[]>(() => {
      const view = store.activeView();
      if (view === 'overview') return unifiedRows();
      return unifiedRows().filter(
        (row) => unifiedEntryCategoryId(row) === view
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

    /**
     * Chart series scoped to {@link AnalysisState.activeView}. The
     * REST-backed {@link chartSeries} aggregates pushups-only on the
     * server, so consuming it from a per-category tab would always
     * render the pushup history regardless of which tab is active.
     * This computed mirrors the daily/hourly bucketing in
     * `StatsApiService.toStatsResponse` but feeds on the view-filtered
     * unified rows so each tab's chart matches its KPIs. Hourly
     * bucketing is gated on `from === to` (the same condition the
     * server uses) rather than `granularity()` so the series doesn't
     * lag behind during a cold-start where the resource hasn't yet
     * resolved to its `'hourly'` meta.
     */
    const viewChartSeries = computed<StatsSeriesEntry[]>(() => {
      const from = store.from();
      const isDayRange = viewGranularity() === 'hourly';
      const rowsForView = viewFilteredRows();

      if (isDayRange) {
        const hourTotals = Array.from({ length: 24 }, () => 0);
        for (const row of rowsForView) {
          const hour = new Date(row.timestamp).getHours();
          if (hour >= 0 && hour <= 23) hourTotals[hour] += row.reps;
        }
        let cumulative = 0;
        if (resolvedDayChartMode() === '24h') {
          return hourTotals.map((total, hour) => {
            cumulative += total;
            return {
              bucket: `${from}T${String(hour).padStart(2, '0')}:00:00`,
              total,
              dayIntegral: cumulative,
            };
          });
        }
        const result: StatsSeriesEntry[] = [];
        const nightTotal = hourTotals
          .slice(0, 8)
          .reduce((sum, value) => sum + value, 0);
        cumulative += nightTotal;
        result.push({
          bucket: `${from}T00:00:00`,
          bucketLabel: '00-07',
          total: nightTotal,
          dayIntegral: cumulative,
        });
        for (let hour = 8; hour <= 21; hour++) {
          const total = hourTotals[hour] ?? 0;
          cumulative += total;
          result.push({
            bucket: `${from}T${String(hour).padStart(2, '0')}:00:00`,
            total,
            dayIntegral: cumulative,
          });
        }
        return result;
      }

      const totals = new Map<string, number>();
      for (const row of rowsForView) {
        const day = row.timestamp.slice(0, 10);
        totals.set(day, (totals.get(day) ?? 0) + row.reps);
      }
      const sortedDays = [...totals.keys()].sort((a, b) => a.localeCompare(b));
      let cumulative = 0;
      return sortedDays.map((day) => {
        const total = totals.get(day) ?? 0;
        cumulative += total;
        return { bucket: day, total, dayIntegral: cumulative };
      });
    });

    /**
     * Raw view-filtered entries shaped for {@link StatsChartComponent}'s
     * sets-stacking pass: it groups entries by bucket to colour the
     * "with sets" portion separately. Routing exercise entries through
     * here means a non-pushup tab gets its own stack rather than
     * silently borrowing the pushup `[entries]`.
     */
    const viewChartEntries = computed<ChartFeedEntry[]>(() =>
      viewFilteredRows().map((row) => ({
        timestamp: row.timestamp,
        reps: row.reps,
        ...(row.sets ? { sets: row.sets } : {}),
      }))
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
    const categorySummaries = computed<CategorySummary[]>(() => {
      const todayKey = store.lastDayKey();
      const rows = unifiedRows();
      const byCategory = new Map<ExerciseCategoryId, UnifiedEntry[]>();
      for (const row of rows) {
        const cat = unifiedEntryCategoryId(row);
        if (!cat) continue;
        const bucket = byCategory.get(cat);
        if (bucket) bucket.push(row);
        else byCategory.set(cat, [row]);
      }
      const result: CategorySummary[] = [];
      for (const meta of EXERCISE_CATEGORIES) {
        const catRows = byCategory.get(meta.id);
        if (!catRows || !catRows.length) continue;
        const totalReps = catRows.reduce((s, r) => s + r.reps, 0);
        const totalSets = catRows.reduce(
          (s, r) => s + (r.sets?.length ?? 0),
          0
        );
        const todayReps = catRows.reduce(
          (s, r) => (r.timestamp.slice(0, 10) === todayKey ? s + r.reps : s),
          0
        );
        const byDay = new Map<string, number>();
        for (const r of catRows) {
          const k = r.timestamp.slice(0, 10);
          byDay.set(k, (byDay.get(k) ?? 0) + r.reps);
        }
        let bestDayPair: [string, number] | null = null;
        for (const e of byDay.entries()) {
          if (!bestDayPair || e[1] > bestDayPair[1]) bestDayPair = e;
        }
        const dates = sortedUniqueDates(catRows);
        let streak = 0;
        if (dates.length) {
          streak = 1;
          for (let i = dates.length - 1; i > 0; i--) {
            if (daysBetween(dates[i - 1], dates[i]) === 1) streak += 1;
            else break;
          }
        }
        result.push({
          categoryId: meta.id,
          nameKey: meta.nameKey,
          icon: meta.icon,
          order: meta.order,
          totalReps,
          totalSets,
          todayReps,
          currentStreak: streak,
          bestDay: bestDayPair
            ? { date: bestDayPair[0], total: bestDayPair[1] }
            : null,
        });
      }
      return result.sort((a, b) => a.order - b.order);
    });

    // Labels are resolved here rather than left to the chart component
    // because Chart.js has no `$localize` hook — feeding it the raw
    // XLIFF id would render the legend like a developer string in
    // production builds.
    const categoryComparison = computed<CategoryComparison>(() => {
      const summaries = categorySummaries();
      return {
        labels: summaries.map((s) => categoryDisplayName(s.categoryId)),
        reps: summaries.map((s) => s.totalReps),
        sets: summaries.map((s) => s.totalSets),
      };
    });

    // Trend rows mirror the activeView filter so the 8-week and
    // 6-month windows reflect the same category as the rest of the
    // page. We merge the pushup REST data (which the resource already
    // fetches for the trend window) with the live exercise entries —
    // no extra Firestore reads — and then drop entries outside both
    // the trend window and the active view.
    const inRangeFn = (from: string, to: string) => (timestamp: string) => {
      const date = timestamp.slice(0, 10);
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    };

    // Pushups come from a date-scoped REST resource; exercise entries
    // are taken from `_live.exerciseEntries()` (the full Firestore
    // snapshot) and clipped client-side. This asymmetry is acceptable
    // for typical histories but should grow into a date-windowed
    // exerciseEntries resource once long histories show up — until
    // then the inRange filter keeps memory predictable.
    const trendUnifiedRows = (
      pushupRows: ReadonlyArray<PushupRecord>,
      window: { from: string; to: string }
    ): UnifiedEntry[] => {
      const inRange = inRangeFn(window.from, window.to);
      const pushups = pushupRows
        .filter((r) => inRange(r.timestamp))
        .map(pushupRecordToUnified);
      const exercises = store._live
        .exerciseEntries()
        .filter((e) => inRange(e.timestamp))
        .map(exerciseEntryToUnified);
      return [...pushups, ...exercises];
    };

    const applyViewFilter = (rows: UnifiedEntry[]): UnifiedEntry[] => {
      const view = store.activeView();
      if (view === 'overview') return rows;
      return rows.filter((row) => unifiedEntryCategoryId(row) === view);
    };

    const weekTrendRows = computed<UnifiedEntry[]>(() =>
      applyViewFilter(
        trendUnifiedRows(
          store.weekEntriesResource.value() ?? [],
          store.weekFilter()
        )
      )
    );

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
      for (const row of weekTrendRows()) {
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

    const monthTrendRows = computed<UnifiedEntry[]>(() =>
      applyViewFilter(
        trendUnifiedRows(
          store.monthEntriesResource.value() ?? [],
          store.monthFilter()
        )
      )
    );

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
      for (const row of monthTrendRows()) {
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
      const view = store.activeView();
      const rowsForView = viewFilteredRows();
      const kinds = store.kinds();
      const kindSet = kinds.length > 0 ? new Set<string>(kinds) : null;
      // In a per-category tab the pushup-variant breakdown only makes
      // sense for the pushup tab; every other category renders the
      // kind-mode breakdown over its own entries. In overview the
      // legacy gate stays so a default page still shows pushup
      // variants when no kind filter is active.
      const showPushupVariants =
        view === 'pushup' ||
        (view === 'overview' &&
          (!kindSet || (kindSet.size === 1 && kindSet.has('pushup'))));

      if (showPushupVariants) {
        const byType = new Map<string, { reps: number; allSets: number[] }>();
        for (const row of rowsForView) {
          if (row.kind !== 'pushup') continue;
          const key = canonicalizePushupType(row.variantType) || 'standard';
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
      for (const row of rowsForView) {
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

    const bestSingleEntry = computed<UnifiedEntry | null>(() => {
      const view = viewFilteredRows();
      if (!view.length) return null;
      return [...view].sort((a, b) => b.reps - a.reps)[0] ?? null;
    });

    const bestDay = computed<{ date: string; total: number } | null>(() => {
      const byDay = new Map<string, number>();
      for (const row of viewFilteredRows()) {
        const key = row.timestamp.slice(0, 10);
        byDay.set(key, (byDay.get(key) ?? 0) + row.reps);
      }
      if (!byDay.size) return null;
      const [date, total] = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
      return { date, total };
    });

    const longestStreak = computed(() => {
      const dates = sortedUniqueDates(viewFilteredRows());
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
      const dates = sortedUniqueDates(viewFilteredRows());
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

    /** Average reps per individual set across the active view's entries. */
    const avgSetSize = computed(() => {
      const allSets = viewFilteredRows().flatMap((r) => r.sets ?? []);
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
      const entriesWithSets = viewFilteredRows().filter((r) => r.sets?.length);
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

    /** Maximum reps in a single set across the active view's entries. */
    const bestSingleSet = computed(() => {
      const allSets = viewFilteredRows().flatMap((r) => r.sets ?? []);
      if (!allSets.length) return 0;
      return Math.max(...allSets);
    });

    return {
      stats,
      chartSeries,
      viewChartSeries,
      viewChartEntries,
      viewGranularity,
      granularity,
      rows,
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
