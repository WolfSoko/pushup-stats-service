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
    hiddenExercises: new Set<string>(),
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
    // given — a hidden exercise keeps its bars in the breakdown, so the
    // legend can render it as a hollow ring and click it back on
    const items = buildLegendItems(
      input({
        breakdown: [
          {
            exerciseId: 'abs.crunches',
            label: 'Crunches',
            color: '#222222',
            values: [1],
          },
        ],
        hiddenExercises: new Set(['abs.crunches']),
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

describe('buildLegendItems ordering', () => {
  const three = [
    { exerciseId: 'a', label: 'A', color: '#1', values: [1] },
    { exerciseId: 'b', label: 'B', color: '#2', values: [1] },
    { exerciseId: 'c', label: 'C', color: '#3', values: [1] },
  ];

  it('should keep an exercise in place when it is switched off', () => {
    // given — entries used to be re-appended at the end once hidden, so
    // every toggle reshuffled the legend under the pointer
    const before = buildLegendItems(input({ breakdown: three })).map(
      (item) => item.id
    );

    // when
    const after = buildLegendItems(
      input({ breakdown: three, hiddenExercises: new Set(['a']) })
    ).map((item) => item.id);

    // then
    expect(after).toEqual(before);
  });

  it('should keep the order stable no matter which exercises are hidden', () => {
    // given / when
    const ids = (hidden: string[]): string[] =>
      buildLegendItems(
        input({ breakdown: three, hiddenExercises: new Set(hidden) })
      )
        .filter((item) => item.id.startsWith('exercise:'))
        .map((item) => item.id);

    // then
    const expected = [
      exerciseLegendId('a'),
      exerciseLegendId('b'),
      exerciseLegendId('c'),
    ];
    expect(ids([])).toEqual(expected);
    expect(ids(['b'])).toEqual(expected);
    expect(ids(['a', 'c'])).toEqual(expected);
    expect(ids(['a', 'b', 'c'])).toEqual(expected);
  });
});
