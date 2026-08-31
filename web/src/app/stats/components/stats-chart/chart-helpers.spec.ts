import { StatsSeriesEntry } from '@pu-stats/models';
import { bucketKeyForTimestamp } from '../../analysis/chart-series';
import {
  axisBoundsForRange,
  barAxisPrecision,
  bucketToTs,
  buildBucketLabelByTs,
  buildSetsByBucket,
  computeMovingAvg,
  formatCustomHourBlock,
  formatHourLabel,
  hasSetsData,
  movingAvgWindow,
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

  it('should treat a window of 1 as a per-bucket passthrough', () => {
    // given
    const totals = [10, 20, 30];
    // when
    const avg = computeMovingAvg(totals, 1);
    // then
    expect(avg).toEqual([10, 20, 30]);
  });

  it('should clamp a non-positive window to 1 instead of producing NaN', () => {
    // given
    const totals = [10, 20, 30];
    // when
    const avg = computeMovingAvg(totals, 0);
    // then
    expect(avg).toEqual([10, 20, 30]);
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
    const map = buildSetsByBucket(entries, {
      granularity: 'daily',
      dayChartMode: '24h',
      from: null,
    });
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

  it('should collapse a week onto its ISO Monday bucket', () => {
    // given — a Wednesday and the Sunday closing the same ISO week
    const entries: StatsChartEntry[] = [
      { timestamp: '2026-06-17T09:00:00', reps: 30, sets: [10, 20] },
      { timestamp: '2026-06-21T18:00:00', reps: 15 },
    ];
    // when
    const map = buildSetsByBucket(entries, {
      granularity: 'weekly',
      dayChartMode: '24h',
      from: null,
    });
    const monday = new Date(2026, 5, 15).getTime();
    // then
    expect(map.size).toBe(1);
    expect(map.get(monday)).toMatchObject({ setsReps: 30, noSetsReps: 15 });
  });

  it('should key sets onto the same bucket the bar series uses', () => {
    // given — the sets map drives the stacked bar heights, so a bucket
    // derived differently from `bucketKeyForTimestamp` would stack one
    // week's sets onto another week's bar. Timestamps carry an explicit
    // offset, which is exactly where the two derivations can diverge.
    const timestamp = '2026-06-22T01:00+02:00';
    const opts = {
      granularity: 'weekly' as const,
      dayChartMode: '24h' as const,
      from: null,
    };
    // when
    const map = buildSetsByBucket([{ timestamp, reps: 10 }], opts);
    // then
    expect([...map.keys()]).toEqual([
      bucketToTs(bucketKeyForTimestamp(timestamp, opts)),
    ]);
  });

  it('should collapse a month onto its first-of-month bucket', () => {
    // given
    const entries: StatsChartEntry[] = [
      { timestamp: '2026-06-02T09:00:00', reps: 10 },
      { timestamp: '2026-06-28T09:00:00', reps: 20 },
    ];
    // when
    const map = buildSetsByBucket(entries, {
      granularity: 'monthly',
      dayChartMode: '24h',
      from: null,
    });
    const firstOfJune = new Date(2026, 5, 1).getTime();
    // then
    expect(map.size).toBe(1);
    expect(map.get(firstOfJune)?.noSetsReps).toBe(30);
  });

  it('should merge hours 0-7 into the midnight bucket in 14h hourly mode', () => {
    // given
    const entries: StatsChartEntry[] = [
      { timestamp: '2026-02-10T03:00:00', reps: 5 },
      { timestamp: '2026-02-10T06:00:00', reps: 7 },
    ];
    // when
    const map = buildSetsByBucket(entries, {
      granularity: 'hourly',
      dayChartMode: '14h',
      from: null,
    });
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
    const map = buildSetsByBucket(entries, {
      granularity: 'daily',
      dayChartMode: '24h',
      from: null,
    });
    // then
    expect(hasSetsData(map)).toBe(false);
  });
});

describe('movingAvgWindow', () => {
  it('should only give daily buckets the wide seven-bucket window', () => {
    // given / when / then — a month view holds 4-6 weekly bars, so a
    // wider window would just redraw the series mean
    expect(movingAvgWindow('daily')).toBe(7);
    expect(movingAvgWindow('hourly')).toBe(3);
    expect(movingAvgWindow('weekly')).toBe(3);
    expect(movingAvgWindow('monthly')).toBe(3);
  });
});

describe('axisBoundsForRange', () => {
  it('should clamp daily ranges to the range itself', () => {
    // given / when
    const bounds = axisBoundsForRange('daily', '2026-06-15', '2026-06-21');
    // then
    expect(bounds.min).toBe(new Date(2026, 5, 15).getTime());
    expect(bounds.max).toBe(new Date(2026, 5, 21, 23, 59, 59).getTime());
  });

  it('should widen weekly ranges to whole ISO weeks', () => {
    // given — July 2026 opens on a Wednesday and ends on a Friday
    const bounds = axisBoundsForRange('weekly', '2026-07-01', '2026-07-31');
    // then — the partial first and last weeks are drawn in full
    expect(bounds.min).toBe(new Date(2026, 5, 29).getTime());
    expect(bounds.max).toBe(new Date(2026, 7, 2, 23, 59, 59).getTime());
  });

  it('should widen monthly ranges to whole calendar months', () => {
    // given / when
    const bounds = axisBoundsForRange('monthly', '2026-02-10', '2026-05-04');
    // then
    expect(bounds.min).toBe(new Date(2026, 1, 1).getTime());
    expect(bounds.max).toBe(new Date(2026, 4, 31, 23, 59, 59).getTime());
  });

  it('should leave a bound open when its date is missing', () => {
    // given / when
    const bounds = axisBoundsForRange('daily', null, null);
    // then
    expect(bounds.min).toBeUndefined();
    expect(bounds.max).toBeUndefined();
  });
});
