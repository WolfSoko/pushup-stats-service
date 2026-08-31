import type {
  ExerciseDefinition,
  StatsSeriesEntry,
  UnifiedEntry,
  UnifiedEntryFilterKey,
} from '@pu-stats/models';
import type {
  AnalysisView,
  ChartFeedEntry,
  TrendPoint,
  TypeBreakdownDatum,
} from './analysis.types';
import {
  buildViewChartEntries,
  buildViewChartSeries,
  buildViewPaceSeries,
  type ChartBucketOptions,
} from './chart-series';
import {
  buildExerciseSeries,
  collectExerciseIds,
  type ExerciseSeries,
} from './exercise-breakdown';
import {
  groupRowsByMeasurement,
  SEGMENT_ORDER,
  type SegmentMeasurement,
} from './measurement-groups';
import {
  computeAvgSetSize,
  computeBestDay,
  computeBestSingleEntry,
  computeBestSingleSet,
  computeSetsDistribution,
  computeTypeBreakdown,
} from './entry-stats';
import { buildMonthTrend, buildWeekTrend } from './trend-math';

/**
 * Everything the analysis tab renders for one measurement: chart,
 * best values, type breakdown and the two fixed-window trends. Reps,
 * seconds and meters never meet inside a segment, so every number in
 * it shares a unit.
 */
export interface AnalysisSegment {
  measurement: SegmentMeasurement;
  /** False when the segment only exists because a trend window has rows. */
  hasRangeRows: boolean;
  series: StatsSeriesEntry[];
  chartEntries: ChartFeedEntry[];
  paceSeries: Array<{ bucket: string; pace: number | null }>;
  /**
   * The same volume as {@link AnalysisSegment.series}, split per
   * exercise and aligned to its buckets, so the chart can stack or
   * group the parts instead of only showing their sum.
   */
  exerciseSeries: ExerciseSeries[];
  /**
   * Exercises this block could show, derived from rows *before* the
   * visibility filter — the checkbox list belongs to the chart it
   * filters, and unchecking one must not remove the box that undoes
   * it. A superset of {@link AnalysisSegment.exerciseSeries}.
   */
  exerciseOptionIds: string[];
  bestEntry: { value: number; timestamp: string } | null;
  bestDay: { date: string; total: number } | null;
  bestSingleSet: number;
  avgSetSize: number;
  setsDistribution: Array<{ setCount: number; count: number; percent: number }>;
  typeBreakdown: TypeBreakdownDatum[];
  weekTrend: TrendPoint[];
  monthTrend: TrendPoint[];
}

export interface AnalysisSegmentInput {
  rangeRows: ReadonlyArray<UnifiedEntry>;
  weekRows: ReadonlyArray<UnifiedEntry>;
  monthRows: ReadonlyArray<UnifiedEntry>;
  monday: Date;
  monthStart: Date;
  chart: ChartBucketOptions;
  breakdown: {
    view: AnalysisView;
    kinds: ReadonlyArray<UnifiedEntryFilterKey>;
    locale: string;
  };
  /**
   * Stable exercise order driving the per-exercise colours. Derived
   * from the unfiltered range so colours survive hiding an exercise.
   */
  exerciseOrder: ReadonlyArray<string>;
  /**
   * The view's rows before the visibility filter, split per
   * measurement into each segment's `exerciseOptionIds`.
   */
  optionRows: ReadonlyArray<UnifiedEntry>;
  resolveDefinition?: (id: string) => ExerciseDefinition | null;
}

/**
 * One segment per measurement present in the visible range, in a trend
 * window, **or** merely offered by the visibility checkboxes. The trend
 * windows are fixed (8 weeks / 6 months) and independent of the page
 * filter, so a measurement whose entries all fall outside the filter
 * still contributes its trend tables — the segment then carries
 * `hasRangeRows: false` and the caller renders an empty chart in place
 * of the bars and KPI cards.
 *
 * The `optionRows` arm is what keeps a block alive once the user
 * unchecks every exercise in it: dropping the segment would drop the
 * checkboxes with it, stranding the user with no way to check anything
 * back on.
 */
export function buildAnalysisSegments(
  input: AnalysisSegmentInput
): AnalysisSegment[] {
  const { resolveDefinition } = input;
  const byRange = groupRowsByMeasurement(input.rangeRows, resolveDefinition);
  const byWeek = groupRowsByMeasurement(input.weekRows, resolveDefinition);
  const byMonth = groupRowsByMeasurement(input.monthRows, resolveDefinition);
  const byOption = groupRowsByMeasurement(input.optionRows, resolveDefinition);

  const segments: AnalysisSegment[] = [];
  for (const measurement of SEGMENT_ORDER) {
    const rangeRows = byRange.get(measurement) ?? [];
    const weekRows = byWeek.get(measurement) ?? [];
    const monthRows = byMonth.get(measurement) ?? [];
    const optionRows = byOption.get(measurement) ?? [];
    if (
      !rangeRows.length &&
      !weekRows.length &&
      !monthRows.length &&
      !optionRows.length
    ) {
      continue;
    }

    const seriesOpts = { ...input.chart, measurement };
    const series = buildViewChartSeries(rangeRows, seriesOpts);
    segments.push({
      measurement,
      hasRangeRows: rangeRows.length > 0,
      series,
      chartEntries: buildViewChartEntries(rangeRows, measurement),
      paceSeries: buildViewPaceSeries(rangeRows, series, seriesOpts),
      exerciseSeries: buildExerciseSeries(
        rangeRows,
        series.map((point) => point.bucket),
        input.exerciseOrder,
        seriesOpts
      ),
      exerciseOptionIds: collectExerciseIds(optionRows),
      bestEntry: computeBestSingleEntry(rangeRows),
      bestDay: computeBestDay(rangeRows),
      bestSingleSet: computeBestSingleSet(rangeRows),
      avgSetSize: computeAvgSetSize(rangeRows),
      setsDistribution: computeSetsDistribution(rangeRows),
      typeBreakdown: computeTypeBreakdown(rangeRows, {
        ...input.breakdown,
        measurement,
      }),
      weekTrend: buildWeekTrend(weekRows, input.monday),
      monthTrend: buildMonthTrend(monthRows, input.monthStart),
    });
  }
  return segments;
}
