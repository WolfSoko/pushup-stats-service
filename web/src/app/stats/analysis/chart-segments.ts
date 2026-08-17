import {
  type ExerciseDefinition,
  findExerciseDefinition,
  type MeasurementType,
  type StatsSeriesEntry,
  type UnifiedEntry,
  unifiedEntryMeasurement,
} from '@pu-stats/models';
import type { ChartFeedEntry } from './analysis.types';
import {
  buildViewChartEntries,
  buildViewChartSeries,
  buildViewPaceSeries,
} from './chart-series';

/**
 * Measurement a single chart renders. `'mixed'` is the trailing bucket
 * for rows whose `exerciseId` neither the catalog nor the user's custom
 * definitions resolve — they keep a chart of their own instead of
 * dragging seconds into the reps bars.
 */
export type SegmentMeasurement = MeasurementType | 'mixed';

export interface ViewChartSegment {
  measurement: SegmentMeasurement;
  series: StatsSeriesEntry[];
  entries: ChartFeedEntry[];
  paceSeries: Array<{ bucket: string; pace: number | null }>;
}

export interface ChartSegmentOptions {
  from: string | null;
  isDayRange: boolean;
  dayChartMode: '14h' | '24h';
  resolveDefinition?: (id: string) => ExerciseDefinition | null;
}

/**
 * Stable chart order: reps → weight → time → distance → distance-time,
 * unresolvable rows last. Mirrors `computeCategoryVolume`'s facet order
 * so a category's cards and charts list their dimensions the same way.
 */
const SEGMENT_ORDER: ReadonlyArray<SegmentMeasurement> = [
  'reps',
  'weight',
  'time',
  'distance',
  'distance-time',
  'mixed',
];

export function groupRowsByMeasurement(
  rows: ReadonlyArray<UnifiedEntry>,
  resolveDefinition: (
    id: string
  ) => ExerciseDefinition | null = findExerciseDefinition
): Map<SegmentMeasurement, UnifiedEntry[]> {
  const byMeasurement = new Map<SegmentMeasurement, UnifiedEntry[]>();
  for (const row of rows) {
    const measurement =
      unifiedEntryMeasurement(row, resolveDefinition) ?? 'mixed';
    const group = byMeasurement.get(measurement);
    if (group) group.push(row);
    else byMeasurement.set(measurement, [row]);
  }
  return byMeasurement;
}

/**
 * One chart per measurement present in the view. Categories like `core`
 * (sit-ups in reps, planks in seconds) or `cardio` (runs in km, burpees
 * in reps) would otherwise sum incompatible units into a single bar —
 * each dimension gets its own axis, unit suffix and pace line instead.
 *
 * A single-measurement view yields exactly one segment, i.e. the same
 * chart as before this split existed.
 */
export function buildViewChartSegments(
  rows: ReadonlyArray<UnifiedEntry>,
  opts: ChartSegmentOptions
): ViewChartSegment[] {
  const byMeasurement = groupRowsByMeasurement(rows, opts.resolveDefinition);
  const segments: ViewChartSegment[] = [];
  for (const measurement of SEGMENT_ORDER) {
    const group = byMeasurement.get(measurement);
    if (!group?.length) continue;
    const seriesOpts = {
      from: opts.from,
      isDayRange: opts.isDayRange,
      dayChartMode: opts.dayChartMode,
      measurement,
    };
    const series = buildViewChartSeries(group, seriesOpts);
    segments.push({
      measurement,
      series,
      entries: buildViewChartEntries(group, measurement),
      paceSeries: buildViewPaceSeries(group, series, seriesOpts),
    });
  }
  return segments;
}
