import {
  EXERCISE_CATALOG,
  type MeasurementType,
  type StatsSeriesEntry,
  type UnifiedEntry,
  unifiedEntryMeasurement,
} from '@pu-stats/models';
import {
  buildViewChartSeries,
  buildViewPaceSeries,
} from '../../analysis/chart-series';
import { kindDisplayName } from '../../i18n/exercise-display-names';
import type { PaceSeriesEntry } from '../stats-chart/stats-chart.models';

/** One selectable chart view on the dashboard analysis teaser card. */
export interface TeaserTabVm {
  id: string;
  label: string;
  measurement: MeasurementType | null;
  series: StatsSeriesEntry[];
  paceSeries: PaceSeriesEntry[];
}

const CHART_OPTS = {
  from: null,
  isDayRange: false,
  dayChartMode: '14h',
} as const;

const CATALOG_RANK = new Map(EXERCISE_CATALOG.map((def, i) => [def.id, i]));

/**
 * Reps-only aggregate across every exercise — the series the teaser
 * card has always shown as its single chart. Duration/distance-only
 * entries carry no reps and contribute nothing here; they surface on
 * their own per-exercise tab instead.
 */
export function buildTeaserAllSeries(
  rows: ReadonlyArray<UnifiedEntry>
): StatsSeriesEntry[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const reps = row.reps ?? 0;
    if (reps <= 0) continue;
    const day = row.timestamp.slice(0, 10);
    totals.set(day, (totals.get(day) ?? 0) + reps);
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
 * One tab per exercise present in `rows`, ordered by catalog position
 * (custom/unknown ids last, alphabetically) so tab order stays stable
 * across data refreshes. Each tab charts the exercise on its own
 * measurement dimension, so planks show seconds and runs show km + pace
 * instead of vanishing from the reps aggregate.
 */
export function buildTeaserExerciseTabs(
  rows: ReadonlyArray<UnifiedEntry>
): TeaserTabVm[] {
  const byExercise = new Map<string, UnifiedEntry[]>();
  for (const row of rows) {
    const group = byExercise.get(row.exerciseId);
    if (group) group.push(row);
    else byExercise.set(row.exerciseId, [row]);
  }
  const ids = [...byExercise.keys()].sort((a, b) => {
    const rankA = CATALOG_RANK.get(a) ?? Number.MAX_SAFE_INTEGER;
    const rankB = CATALOG_RANK.get(b) ?? Number.MAX_SAFE_INTEGER;
    return rankA !== rankB ? rankA - rankB : a.localeCompare(b);
  });
  return ids.map((id) => {
    const group = byExercise.get(id) ?? [];
    const measurement = unifiedEntryMeasurement(group[0]);
    const series = buildViewChartSeries(group, { ...CHART_OPTS, measurement });
    return {
      id,
      label: kindDisplayName(id),
      measurement,
      series,
      paceSeries: buildViewPaceSeries(group, series, {
        ...CHART_OPTS,
        measurement,
      }),
    };
  });
}
