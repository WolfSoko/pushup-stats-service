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
