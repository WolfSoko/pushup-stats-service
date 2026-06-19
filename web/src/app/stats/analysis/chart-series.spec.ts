import type { UnifiedEntry } from '@pu-stats/models';
import {
  buildViewChartEntries,
  buildViewChartSeries,
  buildViewPaceSeries,
  bucketKeyForTimestamp,
  computeViewMeasurement,
} from './chart-series';

function entry(
  partial: Partial<UnifiedEntry> & { exerciseId: string }
): UnifiedEntry {
  return {
    kind: 'exercise',
    _id: Math.random().toString(36).slice(2),
    timestamp: '2026-06-15T10:00:00',
    reps: 0,
    source: 'test',
    ...partial,
  };
}

describe('computeViewMeasurement', () => {
  it('should return null for no rows', () => {
    // given / when / then
    expect(computeViewMeasurement([])).toBeNull();
  });

  it('should return the shared measurement when uniform', () => {
    // given
    const rows = [entry({ exerciseId: 'pushup', reps: 5 })];
    // when / then
    expect(computeViewMeasurement(rows)).toBe('reps');
  });

  it('should return mixed when measurements differ', () => {
    // given
    const rows = [
      entry({ exerciseId: 'pushup', reps: 5 }),
      entry({ exerciseId: 'plank.standard', durationSec: 60 }),
    ];
    // when / then
    expect(computeViewMeasurement(rows)).toBe('mixed');
  });
});

describe('bucketKeyForTimestamp', () => {
  it('should bucket non-day ranges to the calendar day', () => {
    // given / when
    const key = bucketKeyForTimestamp('2026-06-15T13:00:00', {
      isDayRange: false,
      dayChartMode: '24h',
      from: '2026-06-15',
    });
    // then
    expect(key).toBe('2026-06-15');
  });

  it('should merge pre-08:00 hours into the night bucket in 14h mode', () => {
    // given / when
    const key = bucketKeyForTimestamp('2026-06-15T03:00:00', {
      isDayRange: true,
      dayChartMode: '14h',
      from: '2026-06-15',
    });
    // then
    expect(key).toBe('2026-06-15T00:00:00');
  });

  it('should merge late-evening hours 22/23 into the night bucket in 14h mode', () => {
    // given / when — 22:00 and 23:00 fold into the same off-hours bucket
    const key22 = bucketKeyForTimestamp('2026-06-15T22:00:00', {
      isDayRange: true,
      dayChartMode: '14h',
      from: '2026-06-15',
    });
    const key23 = bucketKeyForTimestamp('2026-06-15T23:00:00', {
      isDayRange: true,
      dayChartMode: '14h',
      from: '2026-06-15',
    });
    // then
    expect(key22).toBe('2026-06-15T00:00:00');
    expect(key23).toBe('2026-06-15T00:00:00');
  });

  it('should hour-suffix the key in 24h mode', () => {
    // given / when
    const key = bucketKeyForTimestamp('2026-06-15T03:00:00', {
      isDayRange: true,
      dayChartMode: '24h',
      from: '2026-06-15',
    });
    // then
    expect(key).toBe('2026-06-15T03:00:00');
  });
});

describe('buildViewChartSeries', () => {
  it('should bucket reps per day with a cumulative day integral', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-06-14T10:00:00',
        reps: 10,
      }),
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-06-15T10:00:00',
        reps: 20,
      }),
    ];
    // when
    const series = buildViewChartSeries(rows, {
      from: '2026-06-14',
      isDayRange: false,
      dayChartMode: '14h',
      measurement: 'reps',
    });
    // then
    expect(series).toEqual([
      { bucket: '2026-06-14', total: 10, dayIntegral: 10 },
      { bucket: '2026-06-15', total: 20, dayIntegral: 30 },
    ]);
  });

  it('should emit a merged night bucket plus hours 8-21 in 14h hourly mode', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-06-15T03:00:00',
        reps: 5,
      }),
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-06-15T09:00:00',
        reps: 7,
      }),
    ];
    // when
    const series = buildViewChartSeries(rows, {
      from: '2026-06-15',
      isDayRange: true,
      dayChartMode: '14h',
      measurement: 'reps',
    });
    // then — 1 night bucket + hours 8..21 = 15 buckets
    expect(series).toHaveLength(15);
    expect(series[0]).toEqual({
      bucket: '2026-06-15T00:00:00',
      bucketLabel: '00-07',
      total: 5,
      dayIntegral: 5,
    });
    const nine = series.find((s) => s.bucket === '2026-06-15T09:00:00');
    expect(nine?.total).toBe(7);
  });

  it('should fold 22:00/23:00 rows into the night bucket without dropping totals in 14h mode', () => {
    // given — late-evening activity that must not vanish from the totals
    const rows = [
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-06-15T22:00:00',
        reps: 4,
      }),
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-06-15T23:00:00',
        reps: 6,
      }),
    ];
    // when
    const series = buildViewChartSeries(rows, {
      from: '2026-06-15',
      isDayRange: true,
      dayChartMode: '14h',
      measurement: 'reps',
    });
    // then — both rows land in the night bucket and the day integral
    // reflects the full 10 reps
    expect(series[0]).toMatchObject({
      bucket: '2026-06-15T00:00:00',
      bucketLabel: '00-07',
      total: 10,
    });
    expect(series[series.length - 1]?.dayIntegral).toBe(10);
  });

  it('should scale distance to km via the measurement scale', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'cardio.running',
        timestamp: '2026-06-15T10:00:00',
        distanceM: 5000,
        durationSec: 1500,
      }),
    ];
    // when
    const series = buildViewChartSeries(rows, {
      from: '2026-06-15',
      isDayRange: false,
      dayChartMode: '14h',
      measurement: 'distance-time',
    });
    // then
    expect(series[0].total).toBe(5);
  });
});

describe('buildViewPaceSeries', () => {
  it('should return [] for non-distance measurements', () => {
    // given / when / then
    expect(
      buildViewPaceSeries([], [], {
        from: '2026-06-15',
        isDayRange: false,
        dayChartMode: '14h',
        measurement: 'reps',
      })
    ).toEqual([]);
  });

  it('should compute min/km pace aligned to the chart buckets', () => {
    // given a 5km run in 1500s (25 min) → 5 min/km
    const rows = [
      entry({
        exerciseId: 'cardio.running',
        timestamp: '2026-06-15T10:00:00',
        distanceM: 5000,
        durationSec: 1500,
      }),
    ];
    const chartSeries = [{ bucket: '2026-06-15', total: 5, dayIntegral: 5 }];
    // when
    const pace = buildViewPaceSeries(rows, chartSeries, {
      from: '2026-06-15',
      isDayRange: false,
      dayChartMode: '14h',
      measurement: 'distance-time',
    });
    // then
    expect(pace).toEqual([{ bucket: '2026-06-15', pace: 5 }]);
  });

  it('should break the line (null) for buckets missing distance or time', () => {
    // given
    const chartSeries = [{ bucket: '2026-06-15', total: 0, dayIntegral: 0 }];
    // when
    const pace = buildViewPaceSeries([], chartSeries, {
      from: '2026-06-15',
      isDayRange: false,
      dayChartMode: '14h',
      measurement: 'distance-time',
    });
    // then
    expect(pace).toEqual([{ bucket: '2026-06-15', pace: null }]);
  });
});

describe('buildViewChartEntries', () => {
  it('should carry the scaled primary value as reps and preserve sets', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-06-15T10:00:00',
        reps: 12,
        sets: [6, 6],
      }),
    ];
    // when
    const entries = buildViewChartEntries(rows, 'reps');
    // then
    expect(entries).toEqual([
      { timestamp: '2026-06-15T10:00:00', reps: 12, sets: [6, 6] },
    ]);
  });
});
