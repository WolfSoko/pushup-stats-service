import { type MeasurementType } from '@pu-stats/models';

/**
 * Minimum shape the chart reads off each entry for sets-stacking. Both
 * the legacy {@link PushupRecord} and the analysis store's view-scoped
 * unified feed satisfy this, so the input can ingest either without an
 * intermediate adapter.
 */
export interface StatsChartEntry {
  timestamp: string;
  reps: number;
  sets?: number[];
}

/**
 * Per-bucket pace value (min/km) aligned 1:1 with the bar series. Used
 * for `'distance'` / `'distance-time'` views where the cumulative
 * "day-integral" line is replaced with a pace line. `null` breaks the
 * line at gaps (buckets without distance data).
 */
export interface PaceSeriesEntry {
  bucket: string;
  pace: number | null;
}

/**
 * Aggregate measurement label feeding the chart's subtitle, legend, and
 * y-axis tick formatters. `'mixed'` is for views that span more than
 * one measurement (e.g. core: reps + time); `null` is the empty-view
 * fallback. Other values mirror {@link MeasurementType}.
 */
export type ChartMeasurement = MeasurementType | 'mixed' | null;

export interface BucketSetsInfo {
  setsReps: number;
  noSetsReps: number;
  sets: number[][];
  totalSets: number;
}
