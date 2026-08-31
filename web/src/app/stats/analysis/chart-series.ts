import { toLocalIsoDate } from '@pu-stats/date';
import {
  type MeasurementType,
  type StatsGranularity,
  type StatsSeriesEntry,
  type UnifiedEntry,
  unifiedEntryMeasurement,
  unifiedEntryPrimaryValue,
} from '@pu-stats/models';
import type { ChartFeedEntry } from './analysis.types';
import { measurementScale } from './category-facets';
import { startOfIsoWeek } from './trend-math';

/** Bucket options shared by every builder feeding one chart. */
export interface ChartBucketOptions {
  from: string | null;
  granularity: StatsGranularity;
  dayChartMode: '14h' | '24h';
}

/**
 * Local midnight of the timestamp's calendar day, read off the ISO
 * date prefix rather than via `new Date(timestamp)` so an entry logged
 * late at night with an offset can't slide into the neighbouring day.
 */
function localDateOf(timestamp: string): Date {
  const [year, month, day] = timestamp.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Dominant measurement type of the entries currently driving the chart.
 *
 *   - `null`     — no entries in the view
 *   - a single measurement — every entry shares it
 *   - `'mixed'`  — the view contains more than one measurement (or an
 *     unknown exerciseId the catalog can't resolve)
 */
export function computeViewMeasurement(
  rows: ReadonlyArray<UnifiedEntry>
): MeasurementType | 'mixed' | null {
  let measurement: MeasurementType | null = null;
  for (const row of rows) {
    const m = unifiedEntryMeasurement(row);
    if (m === null) return 'mixed';
    if (measurement === null) {
      measurement = m;
    } else if (measurement !== m) {
      return 'mixed';
    }
  }
  return measurement;
}

/**
 * Maps a timestamp to the bucket-key it should fall into for the active
 * chart bucketing scheme, so pace alignment and the per-exercise split
 * line up 1:1 with the bar series:
 *   - `monthly`        → `YYYY-MM-01`
 *   - `weekly`         → `YYYY-MM-DD` of the ISO week's Monday
 *   - `daily`          → `YYYY-MM-DD`
 *   - hourly 24h mode  → `${from}T${HH}:00:00` (all 24 hours)
 *   - hourly 14h mode  → `${from}T00:00:00` for the merged night bucket
 *     (hours 22–07, i.e. the day's off-hours); otherwise the
 *     hour-suffixed key above for hours 08–21.
 *
 * The 14h night bucket folds in late-evening hours 22–23 alongside
 * 00–07 so no logged activity is dropped from the day's totals — the
 * bar is still labelled `00-07` (see {@link buildViewChartSeries}).
 */
export function bucketKeyForTimestamp(
  timestamp: string,
  opts: ChartBucketOptions
): string {
  switch (opts.granularity) {
    case 'hourly': {
      // Callers that chart a range rather than a day (the dashboard
      // teaser) pass no `from`; the entry's own day keeps the key
      // parseable instead of yielding `nullT08:00:00`.
      const day = opts.from ?? timestamp.slice(0, 10);
      const hour = new Date(timestamp).getHours();
      if (opts.dayChartMode === '14h' && (hour < 8 || hour >= 22)) {
        return `${day}T00:00:00`;
      }
      return `${day}T${String(hour).padStart(2, '0')}:00:00`;
    }
    case 'weekly':
      return toLocalIsoDate(startOfIsoWeek(localDateOf(timestamp)));
    case 'monthly':
      return `${timestamp.slice(0, 7)}-01`;
    default:
      return timestamp.slice(0, 10);
  }
}

/**
 * Chart series scoped to the active view, bucketed per
 * {@link ChartBucketOptions.granularity}. Feeds on the view-filtered
 * unified rows so each tab's chart matches its KPIs. Buckets without a
 * single entry are omitted rather than zero-filled — the chart's time
 * axis spans the whole range on its own.
 */
export function buildViewChartSeries(
  rows: ReadonlyArray<UnifiedEntry>,
  opts: ChartBucketOptions & {
    measurement: MeasurementType | 'mixed' | null;
  }
): StatsSeriesEntry[] {
  const { from, granularity, dayChartMode } = opts;
  const scale = measurementScale(opts.measurement);

  if (granularity === 'hourly') {
    const hourTotals = Array.from({ length: 24 }, () => 0);
    for (const row of rows) {
      const hour = new Date(row.timestamp).getHours();
      if (hour >= 0 && hour <= 23)
        hourTotals[hour] += unifiedEntryPrimaryValue(row) * scale;
    }
    let cumulative = 0;
    if (dayChartMode === '24h') {
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
    // The night bucket also folds in hours 22–23 so late-evening
    // activity isn't dropped from the day's totals; the bar keeps the
    // `00-07` label since those off-hours read as one block.
    const nightTotal = [
      ...hourTotals.slice(0, 8),
      ...hourTotals.slice(22, 24),
    ].reduce((sum, value) => sum + value, 0);
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
  for (const row of rows) {
    const bucket = bucketKeyForTimestamp(row.timestamp, opts);
    totals.set(
      bucket,
      (totals.get(bucket) ?? 0) + unifiedEntryPrimaryValue(row) * scale
    );
  }
  const sortedBuckets = [...totals.keys()].sort((a, b) => a.localeCompare(b));
  let cumulative = 0;
  return sortedBuckets.map((bucket) => {
    const total = totals.get(bucket) ?? 0;
    cumulative += total;
    return { bucket, total, dayIntegral: cumulative };
  });
}

/**
 * Per-bucket pace (min/km) for distance / distance-time views, aligned
 * 1:1 with `chartSeries` buckets so the chart's line layer can render it
 * in place of the day integral. Empty `[]` for any other measurement.
 *
 * A bucket with zero distance or duration returns `pace = null` so the
 * chart breaks the line at gaps rather than dropping to zero (which
 * would imply an impossibly fast pace).
 */
export function buildViewPaceSeries(
  rows: ReadonlyArray<UnifiedEntry>,
  chartSeries: ReadonlyArray<StatsSeriesEntry>,
  opts: ChartBucketOptions & {
    measurement: MeasurementType | 'mixed' | null;
  }
): Array<{ bucket: string; pace: number | null }> {
  const { measurement } = opts;
  if (measurement !== 'distance' && measurement !== 'distance-time') {
    return [];
  }
  const stats = new Map<string, { totalSec: number; totalM: number }>();
  for (const row of rows) {
    if (row.kind !== 'exercise') continue;
    const totalSec = row.durationSec ?? 0;
    const totalM = row.distanceM ?? 0;
    if (!totalSec && !totalM) continue;
    const key = bucketKeyForTimestamp(row.timestamp, opts);
    const e = stats.get(key) ?? { totalSec: 0, totalM: 0 };
    e.totalSec += totalSec;
    e.totalM += totalM;
    stats.set(key, e);
  }
  return chartSeries.map(({ bucket }) => {
    const e = stats.get(bucket);
    // Carry exercises are pure `distance` (no paired duration); without
    // both numbers a pace value is meaningless, so break the line.
    if (!e || e.totalM === 0 || e.totalSec === 0) {
      return { bucket, pace: null };
    }
    return { bucket, pace: e.totalSec / 60 / (e.totalM / 1000) };
  });
}

/**
 * Raw view-filtered entries shaped for the chart's sets-stacking pass.
 * `reps` carries the entry's primary measurement value (so time /
 * distance entries contribute their scaled `durationSec` / `distanceM`)
 * rather than the literal rep count. Sets are a reps/weight concept, so
 * time-measured rows still fall into the "no sets" portion of the stack.
 */
export function buildViewChartEntries(
  rows: ReadonlyArray<UnifiedEntry>,
  measurement: MeasurementType | 'mixed' | null
): ChartFeedEntry[] {
  const scale = measurementScale(measurement);
  return rows.map((row) => ({
    timestamp: row.timestamp,
    reps: unifiedEntryPrimaryValue(row) * scale,
    ...(row.sets ? { sets: row.sets } : {}),
  }));
}
