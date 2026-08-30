import {
  type MeasurementType,
  type UnifiedEntry,
  unifiedEntryFilterKey,
  unifiedEntryPrimaryValue,
} from '@pu-stats/models';
import { PIE_PALETTE } from '../components/type-pie/type-pie-data';
import { measurementScale } from './category-facets';
import { bucketKeyForTimestamp } from './chart-series';

/**
 * Bar colours, ordered. Opens with the type-pie's palette so the two
 * charts agree on the common case, then doubles it: a stacked bar has
 * no labels of its own, so two segments sharing a colour are simply
 * indistinguishable — where the pie can fall back to a "rest" slice,
 * the bars must keep every exercise separable. Wrapping only starts
 * past 16 distinct exercises in one range.
 *
 * Note this is *positional* agreement only: the pie colours by rank
 * within its own slice list, so an exercise can still differ between
 * the two on a tab where those ranks disagree.
 */
export const EXERCISE_PALETTE: ReadonlyArray<string> = [
  ...PIE_PALETTE,
  '#c2185b', // pink
  '#7cb342', // light green
  '#f9a825', // amber
  '#3949ab', // indigo
  '#00acc1', // cyan
  '#e64a19', // deep orange
  '#546e7a', // slate
  '#9e9d24', // olive
];

/**
 * Reserved for ids the caller's order doesn't know. Deliberately outside
 * {@link EXERCISE_PALETTE} so an unresolvable exercise can't take the
 * colour of a real one.
 */
export const UNKNOWN_EXERCISE_COLOR = '#90a4ae';

/**
 * How a bar chart lays out its per-exercise parts. `'stacked'` keeps one
 * bar per bucket and splits it; `'grouped'` puts one bar per exercise
 * side by side. Stacking answers "how much in total, and of what";
 * grouping answers "which exercise moved" — neither is the better
 * default for every question, hence the user-facing toggle.
 */
export type BarMode = 'stacked' | 'grouped';

/** One exercise's slice of a chart, aligned to the caller's buckets. */
export interface ExerciseSeries {
  exerciseId: string;
  color: string;
  /** Index-aligned 1:1 with the buckets passed to the builder. */
  values: number[];
  total: number;
}

/**
 * Colour of an exercise's bars/segments. Assignment is by position in a
 * caller-supplied id order rather than by hashing the id, so the same
 * exercise keeps its colour across the trend chart, the overview
 * comparison and the checkbox swatches as long as callers pass the same
 * order — in practice `AnalysisStore.exerciseOptions`, which is stable
 * for a given date range and independent of what is hidden.
 */
export function exerciseColor(
  exerciseId: string,
  order: ReadonlyArray<string>
): string {
  const idx = order.indexOf(exerciseId);
  if (idx < 0) return UNKNOWN_EXERCISE_COLOR;
  return EXERCISE_PALETTE[idx % EXERCISE_PALETTE.length];
}

/**
 * Distinct exercise ids present in `rows`, most-logged first. Drives
 * both the visibility checkboxes and the colour order, so it must be
 * derived from the *unfiltered* rows — otherwise hiding an exercise
 * would drop its own checkbox and recolour everything below it.
 *
 * Ranks by number of trainings rather than by volume on purpose: a
 * range mixes measurements, and 5000 m outranking 500 reps is an
 * artefact of the unit, not a statement about the user's training.
 * Ties fall back to the id so the order — and with it every colour —
 * is stable across renders.
 */
export function collectExerciseIds(
  rows: ReadonlyArray<UnifiedEntry>
): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = unifiedEntryFilterKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id);
}

/** Rows minus every exercise the user unchecked. */
export function withoutHiddenExercises(
  rows: ReadonlyArray<UnifiedEntry>,
  hidden: ReadonlyArray<string>
): UnifiedEntry[] {
  if (hidden.length === 0) return [...rows];
  const hiddenSet = new Set(hidden);
  return rows.filter((row) => !hiddenSet.has(unifiedEntryFilterKey(row)));
}

/**
 * Splits `rows` into one value array per exercise, index-aligned with
 * `buckets` — the bucket keys of the aggregate series the chart already
 * renders. Aligning against the caller's buckets rather than re-deriving
 * them is what keeps a sparse exercise (logged on two days out of seven)
 * on the same x positions as the day-integral and moving-average lines.
 *
 * Ordering follows `order` so colours stay put; exercises absent from
 * `order` trail behind in volume order.
 */
export function buildExerciseSeries(
  rows: ReadonlyArray<UnifiedEntry>,
  buckets: ReadonlyArray<string>,
  order: ReadonlyArray<string>,
  opts: {
    from: string | null;
    isDayRange: boolean;
    dayChartMode: '14h' | '24h';
    measurement: MeasurementType | 'mixed' | null;
  }
): ExerciseSeries[] {
  if (buckets.length === 0) return [];
  const scale = measurementScale(opts.measurement);
  const bucketIndex = new Map(buckets.map((bucket, idx) => [bucket, idx]));

  const byExercise = new Map<string, number[]>();
  for (const row of rows) {
    const key = bucketKeyForTimestamp(row.timestamp, {
      isDayRange: opts.isDayRange,
      dayChartMode: opts.dayChartMode,
      from: opts.from,
    });
    const idx = bucketIndex.get(key);
    if (idx === undefined) continue;
    const exerciseId = unifiedEntryFilterKey(row);
    let values = byExercise.get(exerciseId);
    if (!values) {
      values = Array.from({ length: buckets.length }, () => 0);
      byExercise.set(exerciseId, values);
    }
    values[idx] += unifiedEntryPrimaryValue(row) * scale;
  }

  return [...byExercise.entries()]
    .map(([exerciseId, values]) => ({
      exerciseId,
      color: exerciseColor(exerciseId, order),
      values,
      total: values.reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => {
      const aIdx = order.indexOf(a.exerciseId);
      const bIdx = order.indexOf(b.exerciseId);
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
      return b.total - a.total;
    });
}
