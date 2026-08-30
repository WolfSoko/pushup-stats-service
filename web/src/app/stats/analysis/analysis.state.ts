import { createWeekRange, toLocalIsoDate } from '@pu-stats/date';
import type { UnifiedEntryFilterKey } from '@pu-stats/models';
import type { AnalysisView } from './analysis.types';
import type { BarMode } from './exercise-breakdown';

export type AnalysisState = {
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
  /**
   * Whether the per-exercise bars share a bucket (`'stacked'`) or sit
   * side by side (`'grouped'`). Page-wide rather than per-chart so the
   * overview comparison and the tab charts read the same way.
   */
  barMode: BarMode;
  /**
   * Exercises the user unchecked. Applied to every roll-up the page
   * derives — charts, KPIs, trends, heatmap — so a hidden exercise is
   * gone from the whole tab rather than only from the bars. Kept as
   * ids (not a Set) so the state stays serialisable.
   */
  hiddenExerciseIds: ReadonlyArray<string>;
  // Reactive dependency for the fixed-window trend filters: bumped only
  // when the local calendar day actually changes, so a polling interval
  // can call `tickClock()` aggressively without forcing
  // `weekFilter`/`monthFilter` to emit new params each minute (which would
  // otherwise re-trigger the trend resource loaders and flicker the empty
  // CTA back to false during the reload).
  clockTick: number;
  lastDayKey: string;
};

/**
 * Initial state of a freshly mounted analysis page: the current week,
 * overview tab, nothing hidden. Split out of the store so the state
 * shape and its defaults stay readable next to each other.
 */
export function createInitialAnalysisState(): AnalysisState {
  const defaultRange = createWeekRange();
  return {
    from: defaultRange.from,
    to: defaultRange.to,
    dayChartMode: undefined as '24h' | '14h' | undefined,
    kinds: [] as ReadonlyArray<UnifiedEntryFilterKey>,
    activeView: 'overview' as AnalysisView,
    barMode: 'stacked' as BarMode,
    hiddenExerciseIds: [] as ReadonlyArray<string>,
    clockTick: 0,
    // Seed with today so the first `tickClock()` after construction is a
    // no-op; otherwise the 5-minute polling interval would force a
    // spurious reload of weekEntriesResource/monthEntriesResource on
    // its first iteration even when the calendar day hasn't changed.
    lastDayKey: toLocalIsoDate(new Date()),
  };
}
