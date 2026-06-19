import { StatsGranularity, StatsSeriesEntry } from '@pu-stats/models';
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
  granularity: StatsGranularity,
  dayChartMode: '24h' | '14h'
): Map<number, BucketSetsInfo> {
  const isHourly = granularity === 'hourly';
  const is14h = isHourly && dayChartMode === '14h';
  const setsByBucket = new Map<number, BucketSetsInfo>();
  for (const entry of entries) {
    const date = new Date(entry.timestamp);
    let bucketTs: number;
    if (isHourly) {
      const hour = date.getHours();
      // In 14h mode, hours 0-7 merge into the 00:00 bucket
      const mappedHour = is14h && hour < 8 ? 0 : hour;
      bucketTs = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        mappedHour
      ).getTime();
    } else {
      bucketTs = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      ).getTime();
    }
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
