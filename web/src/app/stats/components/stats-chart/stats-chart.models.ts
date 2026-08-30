import { type MeasurementType } from '@pu-stats/models';

/**
 * Minimum shape both the legacy {@link PushupRecord} and the analysis
 * store's unified feed satisfy, so the chart ingests either without an
 * intermediate adapter.
 */
export interface StatsChartEntry {
  timestamp: string;
  reps: number;
  sets?: number[];
}

/** Aligned 1:1 with the bar series; `pace: null` breaks the line at gaps. */
export interface PaceSeriesEntry {
  bucket: string;
  pace: number | null;
}

/** `'mixed'` spans more than one measurement; `null` is the empty-view fallback. */
export type ChartMeasurement = MeasurementType | 'mixed' | null;

export interface BucketSetsInfo {
  setsReps: number;
  noSetsReps: number;
  sets: number[][];
  totalSets: number;
}

/**
 * One exercise's bars inside a chart, already localised and coloured by
 * the caller. `values` is index-aligned with the chart's series, so a
 * bucket the exercise never touched carries a plain `0`.
 */
export interface ChartBreakdownSeries {
  /**
   * Stable identity for the legend's `track`. Two exercises can share a
   * display label (a renamed custom exercise, a catalog variant pair),
   * and a duplicate track key makes Angular throw NG0955 instead of
   * rendering the legend.
   */
  exerciseId: string;
  label: string;
  color: string;
  values: number[];
}

/** Whether per-exercise bars share a bucket or sit side by side. */
export type ChartBarMode = 'stacked' | 'grouped';
