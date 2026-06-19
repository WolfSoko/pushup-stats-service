import { StatsSeriesEntry } from '@pu-stats/models';
import {
  barAxisPrecision,
  bucketToTs,
  buildBucketLabelByTs,
  buildSetsByBucket,
  computeMovingAvg,
  formatCustomHourBlock,
  formatHourLabel,
  hasSetsData,
} from './chart-helpers';
import { StatsChartEntry } from './stats-chart.models';

describe('bucketToTs', () => {
  it('should normalize a date-only bucket to local midnight', () => {
    // given
    const bucket = '2026-02-10';
    // when
    const ts = bucketToTs(bucket);
    // then
    expect(ts).toBe(new Date('2026-02-10T00:00:00').getTime());
  });

  it('should pass through a full ISO timestamp unchanged', () => {
    // given
    const bucket = '2026-02-10T13:00:00';
    // when
    const ts = bucketToTs(bucket);
    // then
    expect(ts).toBe(new Date('2026-02-10T13:00:00').getTime());
  });
});

describe('barAxisPrecision', () => {
  it('should use one decimal for distance measurements', () => {
    // given / when / then
    expect(barAxisPrecision('distance')).toBe(1);
    expect(barAxisPrecision('distance-time')).toBe(1);
  });

  it('should use integer precision for reps, time, weight and null', () => {
    // given / when / then
    expect(barAxisPrecision('reps')).toBe(0);
    expect(barAxisPrecision('time')).toBe(0);
    expect(barAxisPrecision('weight')).toBe(0);
    expect(barAxisPrecision(null)).toBe(0);
  });
});

describe('formatHourLabel', () => {
  it('should render a zero-padded 24h label with "h" suffix for German', () => {
    // given
    const date = new Date(2026, 1, 10, 8);
    // when
    const label = formatHourLabel(date, true);
    // then
    expect(label).toBe('08h');
  });

  it('should render a 12h AM/PM label for non-German locales', () => {
    // given
    const morning = new Date(2026, 1, 10, 0);
    const afternoon = new Date(2026, 1, 10, 13);
    // when / then
    expect(formatHourLabel(morning, false)).toBe('12AM');
    expect(formatHourLabel(afternoon, false)).toBe('1PM');
  });
});

describe('formatCustomHourBlock', () => {
  it('should expand the 00-07 block per locale', () => {
    // given / when / then
    expect(formatCustomHourBlock('00-07', true)).toBe('00-07h');
    expect(formatCustomHourBlock('00-07', false)).toBe('12AM-7AM');
  });

  it('should pass through any other raw label', () => {
    // given / when / then
    expect(formatCustomHourBlock('Woche 5', true)).toBe('Woche 5');
  });
});

describe('computeMovingAvg', () => {
  it('should average over a trailing window clamped at the start', () => {
    // given
    const totals = [10, 20, 30];
    // when
    const avg = computeMovingAvg(totals, 2);
    // then
    expect(avg).toEqual([10, 15, 25]);
  });

  it('should return an empty array for empty input', () => {
    // given / when / then
    expect(computeMovingAvg([], 7)).toEqual([]);
  });
});

describe('buildBucketLabelByTs', () => {
  it('should map only entries that carry a bucketLabel', () => {
    // given
    const series: StatsSeriesEntry[] = [
      { bucket: '2026-02-10', total: 5, dayIntegral: 5, bucketLabel: 'A' },
      { bucket: '2026-02-11', total: 7, dayIntegral: 12 },
    ];
    // when
    const map = buildBucketLabelByTs(series);
    // then
    expect(map.size).toBe(1);
    expect(map.get(bucketToTs('2026-02-10'))).toBe('A');
  });
});

describe('buildSetsByBucket / hasSetsData', () => {
  it('should split reps into sets vs no-sets per daily bucket', () => {
    // given
    const entries: StatsChartEntry[] = [
      { timestamp: '2026-02-10T09:00:00', reps: 30, sets: [10, 20] },
      { timestamp: '2026-02-10T18:00:00', reps: 15 },
    ];
    // when
    const map = buildSetsByBucket(entries, 'daily', '24h');
    const ts = new Date(2026, 1, 10).getTime();
    // then
    expect(map.get(ts)).toEqual({
      setsReps: 30,
      noSetsReps: 15,
      sets: [[10, 20]],
      totalSets: 2,
    });
    expect(hasSetsData(map)).toBe(true);
  });

  it('should merge hours 0-7 into the midnight bucket in 14h hourly mode', () => {
    // given
    const entries: StatsChartEntry[] = [
      { timestamp: '2026-02-10T03:00:00', reps: 5 },
      { timestamp: '2026-02-10T06:00:00', reps: 7 },
    ];
    // when
    const map = buildSetsByBucket(entries, 'hourly', '14h');
    const midnight = new Date(2026, 1, 10, 0).getTime();
    // then
    expect(map.size).toBe(1);
    expect(map.get(midnight)?.noSetsReps).toBe(12);
    expect(hasSetsData(map)).toBe(false);
  });

  it('should report no sets data when no entry has more than one set', () => {
    // given
    const entries: StatsChartEntry[] = [
      { timestamp: '2026-02-10T09:00:00', reps: 10, sets: [10] },
    ];
    // when
    const map = buildSetsByBucket(entries, 'daily', '24h');
    // then
    expect(hasSetsData(map)).toBe(false);
  });
});
