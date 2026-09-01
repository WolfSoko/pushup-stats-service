import {
  buildLegendItems,
  exerciseLegendId,
  parseLegendId,
  seriesLegendId,
  type ChartSeriesKey,
  type LegendItemsInput,
} from './chart-legend-items';

const LABELS: Record<ChartSeriesKey, string> = {
  bar: 'Wiederholungen (Reps)',
  sets: 'Mit Sets',
  secondary: 'Kumuliert (Reps)',
  movingAvg: 'Gleitender Durchschnitt (Reps)',
};

function input(overrides: Partial<LegendItemsInput> = {}): LegendItemsInput {
  return {
    breakdown: [],
    hiddenExercises: [],
    hiddenSeries: new Set<ChartSeriesKey>(),
    showsSetsSeries: false,
    labels: LABELS,
    ...overrides,
  };
}

describe('buildLegendItems', () => {
  it('should list the aggregate bar and both lines when the chart is not split', () => {
    // given / when
    const items = buildLegendItems(input());

    // then
    expect(items.map((item) => item.id)).toEqual([
      seriesLegendId('bar'),
      seriesLegendId('secondary'),
      seriesLegendId('movingAvg'),
    ]);
    expect(items.every((item) => item.active)).toBe(true);
  });

  it('should replace the aggregate bar with one entry per exercise once the chart is split', () => {
    // given / when
    const items = buildLegendItems(
      input({
        breakdown: [
          {
            exerciseId: 'abs.situps',
            label: 'Sit-ups',
            color: '#111111',
            values: [1],
          },
        ],
      })
    );

    // then
    expect(items[0]).toMatchObject({
      id: exerciseLegendId('abs.situps'),
      label: 'Sit-ups',
      color: '#111111',
      active: true,
    });
    expect(items.map((item) => item.id)).not.toContain(seriesLegendId('bar'));
  });

  it('should list a hidden exercise as an inactive entry so it can be switched back on', () => {
    // given — a hidden exercise has no bars left in the breakdown
    const items = buildLegendItems(
      input({
        hiddenExercises: [
          { exerciseId: 'abs.crunches', label: 'Crunches', color: '#222222' },
        ],
      })
    );

    // when
    const crunches = items.find(
      (item) => item.id === exerciseLegendId('abs.crunches')
    );

    // then
    expect(crunches?.active).toBe(false);
  });

  it('should mark a switched-off series inactive', () => {
    // given / when
    const items = buildLegendItems(
      input({ hiddenSeries: new Set<ChartSeriesKey>(['movingAvg']) })
    );

    // then
    const movingAvg = items.find(
      (item) => item.id === seriesLegendId('movingAvg')
    );
    expect(movingAvg?.active).toBe(false);
  });

  it('should offer the sets series only while the chart draws it', () => {
    // given / when
    const withSets = buildLegendItems(input({ showsSetsSeries: true }));
    const split = buildLegendItems(
      input({
        showsSetsSeries: true,
        breakdown: [
          {
            exerciseId: 'abs.situps',
            label: 'Sit-ups',
            color: '#111111',
            values: [1],
          },
        ],
      })
    );

    // then — the per-exercise split replaces the sets stacking
    expect(withSets.map((item) => item.id)).toContain(seriesLegendId('sets'));
    expect(split.map((item) => item.id)).not.toContain(seriesLegendId('sets'));
  });
});

describe('parseLegendId', () => {
  it('should tell an exercise toggle apart from a series toggle', () => {
    // given / when / then
    expect(parseLegendId(exerciseLegendId('abs.situps'))).toEqual({
      kind: 'exercise',
      key: 'abs.situps',
    });
    expect(parseLegendId(seriesLegendId('secondary'))).toEqual({
      kind: 'series',
      key: 'secondary',
    });
  });

  it('should return null for an id from neither namespace', () => {
    // given / when / then
    expect(parseLegendId('abs.situps')).toBeNull();
  });
});
