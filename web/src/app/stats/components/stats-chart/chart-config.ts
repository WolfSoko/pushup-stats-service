import type { StatsGranularity, StatsSeriesEntry } from '@pu-stats/models';
import type { ChartConfiguration } from 'chart.js';

import { buildChartData } from './chart-data';
import {
  axisUnit as axisUnitForMeasurement,
  secondaryAxisUnit as buildSecondaryAxisUnit,
} from './chart-copy';
import { CHART_LABELS } from './chart-messages';
import {
  buildBucketLabelByTs,
  buildSetsByBucket,
  computeMovingAvg,
  hasSetsData as computeHasSetsData,
  movingAvgWindow,
} from './chart-helpers';
import type { ChartSeriesKey } from './chart-legend-items';
import { buildChartOptions, readThemeColors } from './chart-options';
import type {
  ChartBarMode,
  ChartBreakdownSeries,
  ChartMeasurement,
  PaceSeriesEntry,
  StatsChartEntry,
} from './stats-chart.models';

export interface ChartConfigInput {
  series: StatsSeriesEntry[];
  entries: StatsChartEntry[];
  granularity: StatsGranularity;
  rangeMode: 'day' | 'week' | 'month' | 'year' | 'custom';
  dayChartMode: '24h' | '14h';
  from: string | null;
  to: string | null;
  measurement: ChartMeasurement;
  paceMode: boolean;
  paceSeries: PaceSeriesEntry[];
  breakdown: ChartBreakdownSeries[];
  barMode: ChartBarMode;
  hiddenSeries: ReadonlySet<ChartSeriesKey>;
  localeId: string;
  intervalLabel: string;
  secondaryLabel: string;
  movingAvgLabel: string;
}

/**
 * Turns the component's inputs into the Chart.js data + options pair.
 * Lives outside the component so the chart element stays a thin shell
 * around "render this" and the maths can be tested without a canvas.
 */
export function buildChartConfig(
  input: ChartConfigInput
): Pick<ChartConfiguration<'bar' | 'line'>, 'data' | 'options'> {
  const { granularity, dayChartMode, series, breakdown } = input;

  const movingAvg = computeMovingAvg(
    series.map((d) => d.total),
    movingAvgWindow(granularity)
  );
  const bucketLabelByTs = buildBucketLabelByTs(series);
  const setsByBucket = buildSetsByBucket(input.entries, {
    granularity,
    dayChartMode,
    from: input.from,
  });
  // The per-exercise split and the sets split decompose the same
  // volume, so the breakdown suppresses the sets stacking rather than
  // stacking both on top of each other.
  const hasSetsData = breakdown.length
    ? false
    : computeHasSetsData(setsByBucket);

  const data = buildChartData({
    series,
    breakdown,
    barMode: input.barMode,
    setsByBucket,
    hasSetsData,
    movingAvg,
    paceMode: input.paceMode,
    paceSeries: input.paceSeries,
    hiddenSeries: input.hiddenSeries,
    labels: {
      intervalDatasetLabel: input.intervalLabel,
      withSetsLabel: CHART_LABELS.withSets,
      secondaryLineLabel: input.secondaryLabel,
      movingAvgLabel: input.movingAvgLabel,
    },
  });

  const options = buildChartOptions({
    granularity,
    rangeMode: input.rangeMode,
    measurement: input.measurement,
    dayChartMode,
    from: input.from,
    to: input.to,
    hasSetsData,
    stackedBreakdown: breakdown.length > 0 && input.barMode === 'stacked',
    paceMode: input.paceMode,
    bucketLabelByTs,
    setsByBucket,
    colors: readThemeColors(),
    localeId: input.localeId,
    setsTooltipLabel: CHART_LABELS.setsTooltip,
    weekAbbrev: CHART_LABELS.weekAbbrev,
    yAxisTitle: axisUnitForMeasurement(input.measurement),
    ySecondaryAxisTitle: buildSecondaryAxisUnit(
      input.paceMode,
      input.measurement
    ),
  });

  return { data, options };
}
