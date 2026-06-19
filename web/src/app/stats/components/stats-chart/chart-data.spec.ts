import { StatsSeriesEntry } from '@pu-stats/models';
import {
  buildBarDatasets,
  buildChartData,
  buildSecondaryLineData,
} from './chart-data';
import { bucketToTs } from './chart-helpers';
import { BucketSetsInfo, PaceSeriesEntry } from './stats-chart.models';

const series: StatsSeriesEntry[] = [
  { bucket: '2026-02-10', total: 20, dayIntegral: 20 },
  { bucket: '2026-02-11', total: 30, dayIntegral: 50 },
];

describe('buildBarDatasets', () => {
  it('should produce a single un-stacked dataset when there is no sets data', () => {
    // given
    const setsByBucket = new Map<number, BucketSetsInfo>();
    // when
    const datasets = buildBarDatasets(
      series,
      setsByBucket,
      false,
      'Interval',
      'Mit Sets'
    );
    // then
    expect(datasets).toHaveLength(1);
    expect(datasets[0].label).toBe('Interval');
    expect(datasets[0].stack).toBeUndefined();
    expect(datasets[0].data[0]).toEqual({
      x: bucketToTs('2026-02-10'),
      y: 20,
    });
  });

  it('should produce two stacked datasets splitting sets vs no-sets reps', () => {
    // given
    const setsByBucket = new Map<number, BucketSetsInfo>([
      [
        bucketToTs('2026-02-10'),
        { setsReps: 12, noSetsReps: 8, sets: [[6, 6]], totalSets: 2 },
      ],
    ]);
    // when
    const datasets = buildBarDatasets(
      series,
      setsByBucket,
      true,
      'Interval',
      'Mit Sets'
    );
    // then
    expect(datasets).toHaveLength(2);
    expect(datasets[0].stack).toBe('reps');
    expect(datasets[0].data[0].y).toBe(8);
    expect(datasets[1].label).toBe('Mit Sets');
    expect(datasets[1].data[0].y).toBe(12);
    // bucket without sets info falls back to the bar total
    expect(datasets[0].data[1].y).toBe(30);
  });
});

describe('buildSecondaryLineData', () => {
  it('should emit the cumulative day-integral when not in pace mode', () => {
    // given / when
    const data = buildSecondaryLineData(series, false, []);
    // then
    expect(data.map((d) => d.y)).toEqual([20, 50]);
  });

  it('should emit per-bucket pace (null for gaps) in pace mode', () => {
    // given
    const paceSeries: PaceSeriesEntry[] = [{ bucket: '2026-02-10', pace: 5.5 }];
    // when
    const data = buildSecondaryLineData(series, true, paceSeries);
    // then
    expect(data[0].y).toBe(5.5);
    expect(data[1].y).toBeNull();
  });
});

describe('buildChartData', () => {
  it('should assemble bar, secondary line and moving-average datasets', () => {
    // given
    const setsByBucket = new Map<number, BucketSetsInfo>();
    // when
    const data = buildChartData({
      series,
      setsByBucket,
      hasSetsData: false,
      movingAvg: [20, 25],
      paceMode: false,
      paceSeries: [],
      labels: {
        intervalDatasetLabel: 'Interval',
        withSetsLabel: 'Mit Sets',
        secondaryLineLabel: 'Integral',
        movingAvgLabel: 'Avg',
      },
    });
    // then
    expect(data.datasets).toHaveLength(3);
    const movingAvg = data.datasets[2] as { label: string; data: unknown[] };
    expect(movingAvg.label).toBe('Avg');
    expect(movingAvg.data).toHaveLength(2);
  });
});
