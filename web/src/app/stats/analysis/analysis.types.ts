import type { ExerciseCategoryId, UnifiedEntry } from '@pu-stats/models';

/** Active analysis view: overview tab or a specific exercise category. */
export type AnalysisView = 'overview' | ExerciseCategoryId;

export interface TrendPoint {
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
 * Reps-measurement facet of a {@link CategorySummary.volume}. Carries
 * the set count (only meaningful when entries log per-set breakdowns).
 */
export interface CategoryRepsFacet {
  kind: 'reps';
  totalReps: number;
  todayReps: number;
  totalSets: number;
  bestDay: { date: string; total: number } | null;
}

/** Time-measurement facet (planks, hollow holds, mobility holds). */
export interface CategoryTimeFacet {
  kind: 'time';
  totalSec: number;
  todaySec: number;
  bestDay: { date: string; totalSec: number } | null;
}

/** Distance-only facet (loaded carries, future cycling). */
export interface CategoryDistanceFacet {
  kind: 'distance';
  totalM: number;
  todayM: number;
  bestDay: { date: string; totalM: number } | null;
}

/** Distance-time composite facet (cardio runs). */
export interface CategoryDistanceTimeFacet {
  kind: 'distance-time';
  totalM: number;
  totalSec: number;
  todayM: number;
  todaySec: number;
  bestDay: { date: string; totalM: number; totalSec: number } | null;
}

export type CategorySingleFacet =
  | CategoryRepsFacet
  | CategoryTimeFacet
  | CategoryDistanceFacet
  | CategoryDistanceTimeFacet;

/**
 * Mixed-measurement bucket: emitted when a category contains entries
 * of more than one measurement type (e.g. `core` mixes sit-ups (reps)
 * and plank (time)). The card renders one section per facet so neither
 * dimension swallows the other.
 */
export interface CategoryMixedVolume {
  kind: 'mixed';
  facets: ReadonlyArray<CategorySingleFacet>;
}

export type CategoryVolume = CategorySingleFacet | CategoryMixedVolume;

/**
 * Per-category roll-up consumed by the analysis overview tab. The
 * cards render `nameKey`/`icon` plus a measurement-aware `volume`,
 * and the comparison chart compares categories by `entries` (count of
 * logged trainings) so reps, seconds and meters can no longer share a
 * bar. Categories with no entries in the current date range are
 * filtered out upstream — every entry here represents a present,
 * non-empty group.
 */
export interface CategorySummary {
  categoryId: ExerciseCategoryId;
  nameKey: string;
  icon: string;
  order: number;
  entries: number;
  currentStreak: number;
  volume: CategoryVolume;
}

/**
 * Series shape consumed by the overview comparison chart. `entries`
 * counts logged trainings per category — the only metric that lets
 * reps-, time- and distance-categories share one axis without
 * mis-comparing seconds vs. repetitions.
 */
export interface CategoryComparison {
  labels: ReadonlyArray<string>;
  entries: ReadonlyArray<number>;
}

/**
 * Structural feed for {@link StatsChartComponent}'s sets-stacking pass.
 * `UnifiedEntry` already declares all three fields on its base, so the
 * `Pick` keeps this feed in lockstep with the canonical model.
 */
export type ChartFeedEntry = Pick<UnifiedEntry, 'timestamp' | 'reps' | 'sets'>;
