import { StatsSeriesEntry } from '@pu-stats/models';
import { ChartConfiguration } from 'chart.js';
import { BucketSetsInfo, PaceSeriesEntry } from './stats-chart.models';
import { bucketToTs } from './chart-helpers';

export interface ChartDataLabels {
  intervalDatasetLabel: string;
  withSetsLabel: string;
  secondaryLineLabel: string;
  movingAvgLabel: string;
}

export interface ChartDataInputs {
  series: StatsSeriesEntry[];
  setsByBucket: Map<number, BucketSetsInfo>;
  hasSetsData: boolean;
  movingAvg: number[];
  paceMode: boolean;
  paceSeries: PaceSeriesEntry[];
  labels: ChartDataLabels;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BarDataset = any;

export function buildBarDatasets(
  series: StatsSeriesEntry[],
  setsByBucket: Map<number, BucketSetsInfo>,
  hasSetsData: boolean,
  intervalDatasetLabel: string,
  withSetsLabel: string
): BarDataset[] {
  if (!hasSetsData) {
    return [
      {
        label: intervalDatasetLabel,
        data: series.map((d) => ({
          x: bucketToTs(d.bucket),
          y: d.total,
        })),
        backgroundColor: '#5e8eff99',
        borderRadius: 6,
        maxBarThickness: 34,
      },
    ];
  }
  return [
    {
      label: intervalDatasetLabel,
      data: series.map((d) => {
        const ts = bucketToTs(d.bucket);
        const info = setsByBucket.get(ts);
        return { x: ts, y: info ? info.noSetsReps : d.total };
      }),
      backgroundColor: '#5e8eff99',
      borderRadius: 0,
      maxBarThickness: 34,
      stack: 'reps',
    },
    {
      label: withSetsLabel,
      data: series.map((d) => {
        const ts = bucketToTs(d.bucket);
        const info = setsByBucket.get(ts);
        return { x: ts, y: info?.setsReps ?? 0 };
      }),
      backgroundColor: '#ab47bccc',
      borderRadius: 6,
      maxBarThickness: 34,
      stack: 'reps',
    },
  ];
}

export function buildSecondaryLineData(
  series: StatsSeriesEntry[],
  paceMode: boolean,
  paceSeries: PaceSeriesEntry[]
): { x: number; y: number | null }[] {
  if (!paceMode) {
    return series.map((d) => ({
      x: bucketToTs(d.bucket),
      y: d.dayIntegral,
    }));
  }
  const paceByBucket = new Map<number, number | null>();
  for (const p of paceSeries) {
    paceByBucket.set(bucketToTs(p.bucket), p.pace);
  }
  return series.map((d) => {
    const ts = bucketToTs(d.bucket);
    const pace = paceByBucket.get(ts);
    return { x: ts, y: pace ?? null };
  });
}

export function buildChartData(
  inputs: ChartDataInputs
): ChartConfiguration<'bar' | 'line'>['data'] {
  const { series, setsByBucket, hasSetsData, movingAvg, paceMode, paceSeries } =
    inputs;
  const { intervalDatasetLabel, withSetsLabel, secondaryLineLabel } =
    inputs.labels;

  const barDatasets = buildBarDatasets(
    series,
    setsByBucket,
    hasSetsData,
    intervalDatasetLabel,
    withSetsLabel
  );
  const secondaryLineData = buildSecondaryLineData(
    series,
    paceMode,
    paceSeries
  );

  return {
    datasets: [
      ...barDatasets,
      {
        label: secondaryLineLabel,
        data: secondaryLineData,
        type: 'line',
        borderColor: '#ffbe66',
        backgroundColor: '#ffbe66',
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.24,
        yAxisID: 'yIntegral',
        spanGaps: false,
      },
      {
        label: inputs.labels.movingAvgLabel,
        data: series.map((entry, index) => ({
          x: bucketToTs(entry.bucket),
          y: movingAvg[index] ?? null,
        })),
        type: 'line',
        borderColor: '#7ef0c8',
        backgroundColor: '#7ef0c8',
        borderDash: [7, 5],
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.32,
        yAxisID: 'y',
        stack: 'movingAvg',
      },
    ],
  };
}
