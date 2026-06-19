import type { UnifiedEntry } from '@pu-stats/models';
import {
  computeAvgSetSize,
  computeBestDay,
  computeBestSingleEntry,
  computeBestSingleSet,
  computeSetsDistribution,
  computeTypeBreakdown,
} from './entry-stats';

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

describe('computeBestSingleEntry', () => {
  it('should return null for no rows', () => {
    expect(computeBestSingleEntry([])).toBeNull();
  });

  it('should return the entry with the most reps without mutating input', () => {
    const rows = [
      entry({ exerciseId: 'pushup', reps: 10 }),
      entry({ exerciseId: 'pushup', reps: 40 }),
      entry({ exerciseId: 'pushup', reps: 25 }),
    ];
    const before = rows.map((r) => r.reps);
    expect(computeBestSingleEntry(rows)?.reps).toBe(40);
    expect(rows.map((r) => r.reps)).toEqual(before);
  });
});

describe('computeBestDay', () => {
  it('should sum reps per day and return the top day', () => {
    const rows = [
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-06-14T08:00:00',
        reps: 20,
      }),
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-06-14T20:00:00',
        reps: 30,
      }),
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-06-15T10:00:00',
        reps: 40,
      }),
    ];
    expect(computeBestDay(rows)).toEqual({ date: '2026-06-14', total: 50 });
  });

  it('should return null when empty', () => {
    expect(computeBestDay([])).toBeNull();
  });
});

describe('computeAvgSetSize / computeBestSingleSet', () => {
  it('should average across all individual sets rounded to one decimal', () => {
    const rows = [
      entry({ exerciseId: 'pushup', reps: 30, sets: [10, 20] }),
      entry({ exerciseId: 'pushup', reps: 15, sets: [15] }),
    ];
    expect(computeAvgSetSize(rows)).toBe(15);
    expect(computeBestSingleSet(rows)).toBe(20);
  });

  it('should return 0 when there are no sets', () => {
    const rows = [entry({ exerciseId: 'pushup', reps: 10 })];
    expect(computeAvgSetSize(rows)).toBe(0);
    expect(computeBestSingleSet(rows)).toBe(0);
  });
});

describe('computeSetsDistribution', () => {
  it('should bucket entries by set count with percentages', () => {
    const rows = [
      entry({ exerciseId: 'pushup', reps: 10, sets: [10] }),
      entry({ exerciseId: 'pushup', reps: 20, sets: [10, 10] }),
      entry({ exerciseId: 'pushup', reps: 30, sets: [10, 10, 10] }),
      entry({ exerciseId: 'pushup', reps: 30, sets: [10, 10, 10] }),
    ];
    expect(computeSetsDistribution(rows)).toEqual([
      { setCount: 1, count: 1, percent: 25 },
      { setCount: 2, count: 1, percent: 25 },
      { setCount: 3, count: 2, percent: 50 },
    ]);
  });

  it('should return [] when no entry has sets', () => {
    expect(
      computeSetsDistribution([entry({ exerciseId: 'pushup', reps: 10 })])
    ).toEqual([]);
  });
});

describe('computeTypeBreakdown', () => {
  it('should break pushup entries down by variant in overview', () => {
    const rows = [
      entry({
        exerciseId: 'pushup',
        variantId: 'standard',
        reps: 30,
        sets: [10, 20],
      }),
      entry({ exerciseId: 'pushup', variantId: 'diamond', reps: 10 }),
    ];
    const breakdown = computeTypeBreakdown(rows, {
      view: 'overview',
      kinds: [],
      locale: 'en',
    });
    // sorted by value desc; standard leads
    expect(breakdown[0].value).toBe(30);
    expect(breakdown[0].avgSetSize).toBe(15);
    expect(breakdown.map((d) => d.value)).toEqual([30, 10]);
  });

  it('should switch to kind-mode breakdown with bare-key labels when a non-pushup kind filter is active', () => {
    const rows = [
      entry({ exerciseId: 'pushup', reps: 10 }),
      entry({ exerciseId: 'abs.situps', reps: 25 }),
    ];
    const breakdown = computeTypeBreakdown(rows, {
      view: 'overview',
      kinds: ['abs.situps'],
      locale: 'en',
    });
    expect(breakdown).toEqual([
      { id: 'abs.situps', label: 'abs.situps', value: 25, avgSetSize: 0 },
    ]);
  });
});
