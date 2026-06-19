import { findExerciseDefinition, type UnifiedEntry } from '@pu-stats/models';
import {
  buildCategoryComparison,
  buildCategorySummaries,
} from './category-volume';
import {
  buildFacet,
  computeCategoryVolume,
  facetKindFor,
  measurementScale,
} from './category-facets';
import type { CategorySummary } from './analysis.types';

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

describe('facetKindFor', () => {
  it('should route reps and weight to the same facet kind', () => {
    // Regression (Codex P2): the card template iterates facets with
    // `@for … track facet.kind`. Collapsing `weight` into `reps` at the
    // kind level prevents two buckets with identical emitted kind, which
    // would trigger Angular NG0955.
    expect(facetKindFor('reps')).toBe('reps');
    expect(facetKindFor('weight')).toBe('reps');
  });

  it('should preserve time, distance and distance-time as their own kinds', () => {
    expect(facetKindFor('time')).toBe('time');
    expect(facetKindFor('distance')).toBe('distance');
    expect(facetKindFor('distance-time')).toBe('distance-time');
  });
});

describe('measurementScale', () => {
  it('should scale distance dimensions to km and leave others at 1', () => {
    expect(measurementScale('distance')).toBe(1 / 1000);
    expect(measurementScale('distance-time')).toBe(1 / 1000);
    expect(measurementScale('reps')).toBe(1);
    expect(measurementScale('time')).toBe(1);
    expect(measurementScale(null)).toBe(1);
  });
});

describe('buildFacet', () => {
  it('should fold reps rows into a reps facet with best day and today total', () => {
    // given two days, today being 2026-06-15
    const rows = [
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-06-14T10:00:00',
        reps: 20,
        sets: [10, 10],
      }),
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-06-15T10:00:00',
        reps: 30,
        sets: [30],
      }),
    ];
    // when
    const facet = buildFacet('reps', rows, '2026-06-15');
    // then
    expect(facet).toEqual({
      kind: 'reps',
      totalReps: 50,
      totalSets: 3,
      todayReps: 30,
      bestDay: { date: '2026-06-15', total: 30 },
    });
  });

  it('should fold time rows into a time facet by durationSec', () => {
    const rows = [
      entry({
        exerciseId: 'plank.standard',
        timestamp: '2026-06-15T10:00:00',
        durationSec: 60,
      }),
      entry({
        exerciseId: 'plank.standard',
        timestamp: '2026-06-14T10:00:00',
        durationSec: 90,
      }),
    ];
    const facet = buildFacet('time', rows, '2026-06-15');
    expect(facet).toEqual({
      kind: 'time',
      totalSec: 150,
      todaySec: 60,
      bestDay: { date: '2026-06-14', totalSec: 90 },
    });
  });

  it('should rank a distance-time best day by distance', () => {
    const rows = [
      entry({
        exerciseId: 'cardio.running',
        timestamp: '2026-06-14T10:00:00',
        distanceM: 5000,
        durationSec: 1800,
      }),
      entry({
        exerciseId: 'cardio.running',
        timestamp: '2026-06-15T10:00:00',
        distanceM: 3000,
        durationSec: 900,
      }),
    ];
    const facet = buildFacet('distance-time', rows, '2026-06-15');
    expect(facet.kind).toBe('distance-time');
    if (facet.kind === 'distance-time') {
      expect(facet.totalM).toBe(8000);
      expect(facet.totalSec).toBe(2700);
      expect(facet.bestDay).toEqual({
        date: '2026-06-14',
        totalM: 5000,
        totalSec: 1800,
      });
    }
  });
});

describe('computeCategoryVolume', () => {
  it('should return a single facet when all rows share one measurement', () => {
    const rows = [entry({ exerciseId: 'pushup', reps: 10 })];
    const volume = computeCategoryVolume(rows, '2026-06-15');
    expect(volume.kind).toBe('reps');
  });

  it('should return a mixed bucket when measurements differ', () => {
    // given a reps and a time exercise in the same category set
    const rows = [
      entry({ exerciseId: 'pushup', reps: 10 }),
      entry({ exerciseId: 'plank.standard', durationSec: 60 }),
    ];
    const volume = computeCategoryVolume(rows, '2026-06-15');
    expect(volume.kind).toBe('mixed');
    if (volume.kind === 'mixed') {
      // reps before time per the stable facet order
      expect(volume.facets.map((f) => f.kind)).toEqual(['reps', 'time']);
    }
  });
});

describe('buildCategorySummaries', () => {
  it('should omit empty categories and order by catalog order', () => {
    // given pushup and core rows; resolver from the default catalog
    const rows = [
      entry({ exerciseId: 'pushup', reps: 10 }),
      entry({ exerciseId: 'plank.standard', durationSec: 60 }),
    ];
    const summaries = buildCategorySummaries(
      rows,
      findExerciseDefinition,
      '2026-06-15'
    );
    const ids = summaries.map((s) => s.categoryId);
    // then every summary has at least one entry
    expect(summaries.every((s) => s.entries > 0)).toBe(true);
    // and ordering is non-decreasing by catalog order
    const orders = summaries.map((s) => s.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(ids).toContain('pushup');
  });
});

describe('buildCategoryComparison', () => {
  it('should project labels and entry counts from summaries', () => {
    const summaries = [
      { categoryId: 'pushup', entries: 3 } as CategorySummary,
      { categoryId: 'core', entries: 1 } as CategorySummary,
    ];
    const comparison = buildCategoryComparison(summaries);
    expect(comparison.entries).toEqual([3, 1]);
    expect(comparison.labels).toHaveLength(2);
  });
});
