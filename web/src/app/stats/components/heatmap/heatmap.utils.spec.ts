import {
  buildHeatmapCells,
  defaultHeatmapDays,
  defaultHeatmapHoursTopDown,
  heatmapCellColor,
  hourTopDownLabels,
} from './heatmap.utils';

// minimal shape used by the utils
type Entry = { timestamp: string; reps: number; sets?: number[] };

describe('heatmap.utils', () => {
  it('generates 24*7 cells and aggregates reps by weekday+hour', () => {
    const entries: Entry[] = [
      { timestamp: '2026-02-09T08:00:00', reps: 10 }, // Mon
      { timestamp: '2026-02-09T08:30:00', reps: 5 }, // Mon, same hour
      { timestamp: '2026-02-10T23:00:00', reps: 12 }, // Tue
    ];

    const cells = buildHeatmapCells({
      entries,
      days: defaultHeatmapDays,
      hoursTopDown: defaultHeatmapHoursTopDown,
    });

    expect(cells).toHaveLength(24 * 7);

    const mo8 = cells.find(
      (c: { x: string; y: string; v: number }) => c.x === 'Mo' && c.y === '08'
    );
    expect(mo8).toBeDefined();
    expect(mo8?.v).toBe(15);

    const di23 = cells.find(
      (c: { x: string; y: string; v: number }) => c.x === 'Di' && c.y === '23'
    );
    expect(di23).toBeDefined();
    expect(di23?.v).toBe(12);
  });

  it('creates hour labels in top-down order (23..00)', () => {
    const labels = hourTopDownLabels();
    expect(labels).toHaveLength(24);
    expect(labels[0]).toBe('23');
    expect(labels[labels.length - 1]).toBe('00');
  });

  it('computes heatmap cell colors: zero is neutral, non-zero is rgba blue', () => {
    expect(heatmapCellColor({ value: 0, max: 10 })).toBe(
      'rgba(255,255,255,0.04)'
    );

    const c = heatmapCellColor({ value: 5, max: 10 });
    expect(c.startsWith('rgba(69, 137, 255,')).toBe(true);
  });

  it('aggregates set count instead of reps when mode is "sets"', () => {
    const entries: Entry[] = [
      { timestamp: '2026-02-09T08:00:00', reps: 10, sets: [5, 5] }, // Mon
      { timestamp: '2026-02-09T08:30:00', reps: 15, sets: [5, 5, 5] }, // Mon, same hour
      { timestamp: '2026-02-10T23:00:00', reps: 12 }, // Tue, no sets
    ];

    const cells = buildHeatmapCells({
      entries,
      days: defaultHeatmapDays,
      hoursTopDown: defaultHeatmapHoursTopDown,
      mode: 'sets',
    });

    // Mon 08: 2 sets + 3 sets = 5
    const mo8 = cells.find(
      (c: { x: string; y: string; v: number }) => c.x === 'Mo' && c.y === '08'
    );
    expect(mo8?.v).toBe(5);

    // Tue 23: no sets → 0
    const di23 = cells.find(
      (c: { x: string; y: string; v: number }) => c.x === 'Di' && c.y === '23'
    );
    expect(di23?.v).toBe(0);
  });

  it('exposes day/hour constants', () => {
    expect(defaultHeatmapDays).toEqual([
      'Mo',
      'Di',
      'Mi',
      'Do',
      'Fr',
      'Sa',
      'So',
    ]);
    expect(defaultHeatmapHoursTopDown).toEqual(hourTopDownLabels());
  });
});
