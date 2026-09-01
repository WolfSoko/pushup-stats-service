import type { ChartLegendItem } from '../chart-legend/chart-legend.component';
import type { ChartBreakdownSeries } from './stats-chart.models';

/** The datasets the chart draws regardless of the per-exercise split. */
export type ChartSeriesKey = 'bar' | 'sets' | 'secondary' | 'movingAvg';

/**
 * Legend ids carry their own namespace so an exercise id that happens
 * to read like a series key can't be mistaken for one. Both kinds are
 * local to the chart that drew them — the page-wide exercise filter is
 * the checkbox bar's job, not the legend's.
 */
export const EXERCISE_LEGEND_PREFIX = 'exercise:';
export const SERIES_LEGEND_PREFIX = 'series:';

/** Matches the dataset colours in `chart-data.ts`. */
export const SERIES_LEGEND_COLORS: Record<ChartSeriesKey, string> = {
  bar: '#6b98ff',
  sets: '#ab47bc',
  secondary: '#ffbe66',
  movingAvg: '#7ef0c8',
};

export interface LegendItemsInput {
  /**
   * Every exercise this chart can draw, hidden ones included — a hidden
   * one stays in the legend as a hollow ring, because the legend is the
   * only surface that can bring it back.
   */
  breakdown: ReadonlyArray<ChartBreakdownSeries>;
  hiddenExercises: ReadonlySet<string>;
  hiddenSeries: ReadonlySet<ChartSeriesKey>;
  showsSetsSeries: boolean;
  labels: Record<ChartSeriesKey, string>;
}

export function seriesLegendId(key: ChartSeriesKey): string {
  return `${SERIES_LEGEND_PREFIX}${key}`;
}

export function exerciseLegendId(exerciseId: string): string {
  return `${EXERCISE_LEGEND_PREFIX}${exerciseId}`;
}

function seriesItem(
  key: ChartSeriesKey,
  input: LegendItemsInput
): ChartLegendItem {
  return {
    id: seriesLegendId(key),
    label: input.labels[key],
    color: SERIES_LEGEND_COLORS[key],
    active: !input.hiddenSeries.has(key),
    testId: `stats-chart-legend-series-${key}`,
  };
}

/**
 * Bars first (per exercise when the chart is split, otherwise the
 * aggregate), then the two lines — the same reading order as the chart
 * itself.
 */
export function buildLegendItems(input: LegendItemsInput): ChartLegendItem[] {
  const items: ChartLegendItem[] = [];
  const showsBreakdown = input.breakdown.length > 0;

  if (showsBreakdown) {
    for (const part of input.breakdown) {
      items.push({
        id: exerciseLegendId(part.exerciseId),
        label: part.label,
        color: part.color,
        active: !input.hiddenExercises.has(part.exerciseId),
        testId: `stats-chart-legend-exercise-${part.exerciseId}`,
      });
    }
  } else {
    items.push(seriesItem('bar', input));
  }

  if (input.showsSetsSeries && !showsBreakdown) {
    items.push(seriesItem('sets', input));
  }

  items.push(seriesItem('secondary', input));
  items.push(seriesItem('movingAvg', input));
  return items;
}

/**
 * Resolves a legend click back to what it toggles. `null` marks an id
 * from neither namespace, which the caller ignores rather than guessing.
 */
export function parseLegendId(
  id: string
): { kind: 'exercise' | 'series'; key: string } | null {
  if (id.startsWith(EXERCISE_LEGEND_PREFIX)) {
    return { kind: 'exercise', key: id.slice(EXERCISE_LEGEND_PREFIX.length) };
  }
  if (id.startsWith(SERIES_LEGEND_PREFIX)) {
    return { kind: 'series', key: id.slice(SERIES_LEGEND_PREFIX.length) };
  }
  return null;
}
