import {
  type MeasurementType,
  type StatsSeriesEntry,
  type UnifiedEntry,
  unifiedEntryMeasurement,
  unifiedEntryPrimaryValue,
} from '@pu-stats/models';
import type { ChartFeedEntry } from './analysis.types';
import { measurementScale } from './category-facets';

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
 * chart bucketing scheme, so pace alignment lines up with the bar series:
 *   - daily            → `YYYY-MM-DD`
 *   - hourly 24h mode  → `${from}T${HH}:00:00` (all 24 hours)
 *   - hourly 14h mode  → `${from}T00:00:00` for hours 0-7 (merged night
 *     bucket); otherwise the hour-suffixed key above.
 *
 * In 14h mode {@link buildViewChartSeries} only emits the night bucket
 * plus hours 08–21, so a timestamp at hour 22/23 yields a key with no
 * matching bar — it simply drops out of the pace alignment, mirroring
 * the chart, which doesn't plot those hours either.
 */
export function bucketKeyForTimestamp(
  timestamp: string,
  opts: {
    isDayRange: boolean;
    dayChartMode: '14h' | '24h';
    from: string | null;
  }
): string {
  if (!opts.isDayRange) return timestamp.slice(0, 10);
  const hour = new Date(timestamp).getHours();
  if (opts.dayChartMode === '14h' && hour < 8) {
    return `${opts.from}T00:00:00`;
  }
  return `${opts.from}T${String(hour).padStart(2, '0')}:00:00`;
}

/**
 * Chart series scoped to the active view. Mirrors the daily/hourly
 * bucketing in `StatsApiService.toStatsResponse` but feeds on the
 * view-filtered unified rows so each tab's chart matches its KPIs.
 */
export function buildViewChartSeries(
  rows: ReadonlyArray<UnifiedEntry>,
  opts: {
    from: string | null;
    isDayRange: boolean;
    dayChartMode: '14h' | '24h';
    measurement: MeasurementType | 'mixed' | null;
  }
): StatsSeriesEntry[] {
  const { from, isDayRange, dayChartMode } = opts;
  const scale = measurementScale(opts.measurement);

  if (isDayRange) {
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
    const nightTotal = hourTotals
      .slice(0, 8)
      .reduce((sum, value) => sum + value, 0);
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
    const day = row.timestamp.slice(0, 10);
    totals.set(
      day,
      (totals.get(day) ?? 0) + unifiedEntryPrimaryValue(row) * scale
    );
  }
  const sortedDays = [...totals.keys()].sort((a, b) => a.localeCompare(b));
  let cumulative = 0;
  return sortedDays.map((day) => {
    const total = totals.get(day) ?? 0;
    cumulative += total;
    return { bucket: day, total, dayIntegral: cumulative };
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
  opts: {
    from: string | null;
    isDayRange: boolean;
    dayChartMode: '14h' | '24h';
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
    const key = bucketKeyForTimestamp(row.timestamp, {
      isDayRange: opts.isDayRange,
      dayChartMode: opts.dayChartMode,
      from: opts.from,
    });
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
