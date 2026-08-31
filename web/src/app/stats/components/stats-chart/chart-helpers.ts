import { StatsGranularity, StatsSeriesEntry } from '@pu-stats/models';
import {
  bucketKeyForTimestamp,
  type ChartBucketOptions,
} from '../../analysis/chart-series';
import { startOfIsoWeek } from '../../analysis/trend-math';
import {
  BucketSetsInfo,
  ChartMeasurement,
  StatsChartEntry,
} from './stats-chart.models';

export function bucketToTs(bucket: string): number {
  const normalized = bucket.length === 10 ? `${bucket}T00:00:00` : bucket;
  return new Date(normalized).getTime();
}

export function barAxisPrecision(measurement: ChartMeasurement): number {
  return measurement === 'distance' || measurement === 'distance-time' ? 1 : 0;
}

export function formatHourLabel(value: Date, isGermanLocale: boolean): string {
  const hour = value.getHours();
  if (isGermanLocale) return `${String(hour).padStart(2, '0')}h`;

  const suffix = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}${suffix}`;
}

export function formatCustomHourBlock(
  raw: string,
  isGermanLocale: boolean
): string {
  if (raw !== '00-07') return raw;
  return isGermanLocale ? '00-07h' : '12AM-7AM';
}

/**
 * Trend-line window, in buckets. Coarser buckets already smooth the
 * data, so they average over fewer of them — a 7-bucket window over the
 * 4–6 weekly bars a month view produces would just redraw the series
 * mean, which is the opposite of a trend.
 */
export function movingAvgWindow(granularity: StatsGranularity): number {
  return granularity === 'daily' ? 7 : 3;
}

/**
 * Time-axis bounds widened to whole buckets, so a week or month only
 * partly covered by the filter range still gets its full bar drawn
 * instead of being clipped at the range edge.
 */
export function axisBoundsForRange(
  granularity: StatsGranularity,
  from: string | null,
  to: string | null
): { min: number | undefined; max: number | undefined } {
  return {
    min: from
      ? bucketStartOf(new Date(`${from}T00:00:00`), granularity).getTime()
      : undefined,
    max: to
      ? bucketEndOf(new Date(`${to}T00:00:00`), granularity).getTime()
      : undefined,
  };
}

function bucketStartOf(date: Date, granularity: StatsGranularity): Date {
  if (granularity === 'weekly') return startOfIsoWeek(date);
  if (granularity === 'monthly')
    return new Date(date.getFullYear(), date.getMonth(), 1);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function bucketEndOf(date: Date, granularity: StatsGranularity): Date {
  if (granularity === 'weekly') {
    const monday = startOfIsoWeek(date);
    return new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + 6,
      23,
      59,
      59
    );
  }
  if (granularity === 'monthly') {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  }
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59
  );
}

export function computeMovingAvg(
  totals: number[],
  windowSize: number
): number[] {
  const safeWindowSize = Math.max(1, windowSize);
  return totals.map((_, index) => {
    const from = Math.max(0, index - safeWindowSize + 1);
    const window = totals.slice(from, index + 1);
    const sum = window.reduce((acc, value) => acc + value, 0);
    return Number((sum / window.length).toFixed(2));
  });
}

export function buildBucketLabelByTs(
  series: StatsSeriesEntry[]
): Map<number, string> {
  const bucketLabelByTs = new Map<number, string>();
  for (const entry of series) {
    if (!entry.bucketLabel) continue;
    const ts = bucketToTs(entry.bucket);
    if (Number.isFinite(ts)) bucketLabelByTs.set(ts, entry.bucketLabel);
  }
  return bucketLabelByTs;
}

export function buildSetsByBucket(
  entries: StatsChartEntry[],
  opts: ChartBucketOptions
): Map<number, BucketSetsInfo> {
  const setsByBucket = new Map<number, BucketSetsInfo>();
  for (const entry of entries) {
    // Keyed through the very function that builds the bar series: this
    // map drives the stacked bar heights, not just the tooltip, so a
    // bucketing that drifts by even a day would stack one week's sets
    // onto another week's bar.
    const bucketTs = bucketToTs(bucketKeyForTimestamp(entry.timestamp, opts));
    const info = setsByBucket.get(bucketTs) ?? {
      setsReps: 0,
      noSetsReps: 0,
      sets: [],
      totalSets: 0,
    };
    if (entry.sets && entry.sets.length > 1) {
      info.setsReps += entry.reps;
      info.sets.push(entry.sets);
      info.totalSets += entry.sets.length;
    } else {
      info.noSetsReps += entry.reps;
    }
    setsByBucket.set(bucketTs, info);
  }
  return setsByBucket;
}

export function hasSetsData(
  setsByBucket: Map<number, BucketSetsInfo>
): boolean {
  return [...setsByBucket.values()].some((b) => b.setsReps > 0);
}
