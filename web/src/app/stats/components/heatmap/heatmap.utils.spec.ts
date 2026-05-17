import {
  buildHeatmapCells,
  defaultHeatmapDays,
  defaultHeatmapHoursTopDown,
  entryHeatmapValue,
  formatHeatmapCellLabel,
  formatHeatmapTooltipValue,
  heatmapCellColor,
  hourTopDownLabels,
  type HeatmapValueEntry,
} from './heatmap.utils';

describe('heatmap.utils', () => {
  it('generates 24*7 cells and aggregates reps by weekday+hour', () => {
    const entries: HeatmapValueEntry[] = [
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

    const mo8 = cells.find((c) => c.x === 'Mo' && c.y === '08');
    expect(mo8).toBeDefined();
    expect(mo8?.v).toBe(15);

    const di23 = cells.find((c) => c.x === 'Di' && c.y === '23');
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

  it('aggregates set count in breakdown mode for reps measurement', () => {
    const entries: HeatmapValueEntry[] = [
      { timestamp: '2026-02-09T08:00:00', reps: 10, sets: [5, 5] }, // Mon
      { timestamp: '2026-02-09T08:30:00', reps: 15, sets: [5, 5, 5] }, // Mon, same hour
      { timestamp: '2026-02-10T23:00:00', reps: 12 }, // Tue, no sets
    ];

    const cells = buildHeatmapCells({
      entries,
      days: defaultHeatmapDays,
      hoursTopDown: defaultHeatmapHoursTopDown,
      measurement: 'reps',
      mode: 'breakdown',
    });

    // Mon 08: 2 sets + 3 sets = 5
    const mo8 = cells.find((c) => c.x === 'Mo' && c.y === '08');
    expect(mo8?.v).toBe(5);

    // Tue 23: no sets → 0
    const di23 = cells.find((c) => c.x === 'Di' && c.y === '23');
    expect(di23?.v).toBe(0);
  });

  it('sums durationSec when measurement is "time" (regression: planks no longer surface as zero cells)', () => {
    const entries: HeatmapValueEntry[] = [
      { timestamp: '2026-02-09T08:00:00', reps: 0, durationSec: 60 }, // Mon
      { timestamp: '2026-02-09T08:30:00', reps: 0, durationSec: 90 }, // Mon same hour
    ];

    const cells = buildHeatmapCells({
      entries,
      days: defaultHeatmapDays,
      hoursTopDown: defaultHeatmapHoursTopDown,
      measurement: 'time',
    });

    const mo8 = cells.find((c) => c.x === 'Mo' && c.y === '08');
    expect(mo8?.v).toBe(150);
  });

  it('counts intervals in breakdown mode for time-measured entries', () => {
    const entries: HeatmapValueEntry[] = [
      {
        timestamp: '2026-02-09T08:00:00',
        durationSec: 90,
        intervals: [30, 30, 30],
      },
      {
        timestamp: '2026-02-09T08:30:00',
        durationSec: 60,
        intervals: [30, 30],
      },
    ];

    const cells = buildHeatmapCells({
      entries,
      days: defaultHeatmapDays,
      hoursTopDown: defaultHeatmapHoursTopDown,
      measurement: 'time',
      mode: 'breakdown',
    });

    const mo8 = cells.find((c) => c.x === 'Mo' && c.y === '08');
    expect(mo8?.v).toBe(5);
  });

  it('sums distanceM when measurement is "distance-time" (cardio runs)', () => {
    const entries: HeatmapValueEntry[] = [
      { timestamp: '2026-02-09T08:00:00', distanceM: 5000, durationSec: 1500 },
      { timestamp: '2026-02-09T08:30:00', distanceM: 3000, durationSec: 900 },
    ];

    const cells = buildHeatmapCells({
      entries,
      days: defaultHeatmapDays,
      hoursTopDown: defaultHeatmapHoursTopDown,
      measurement: 'distance-time',
    });

    const mo8 = cells.find((c) => c.x === 'Mo' && c.y === '08');
    expect(mo8?.v).toBe(8000);
  });

  it('counts each entry once when measurement is "mixed"', () => {
    // Mixed view (e.g. core with planks + sit-ups, or overview): summing
    // seconds + reps would be nonsense; we render entry count instead.
    const entries: HeatmapValueEntry[] = [
      { timestamp: '2026-02-09T08:00:00', reps: 30 }, // sit-ups
      { timestamp: '2026-02-09T08:30:00', durationSec: 60 }, // plank
      { timestamp: '2026-02-09T08:45:00', reps: 20 }, // sit-ups
    ];

    const cells = buildHeatmapCells({
      entries,
      days: defaultHeatmapDays,
      hoursTopDown: defaultHeatmapHoursTopDown,
      measurement: 'mixed',
    });

    const mo8 = cells.find((c) => c.x === 'Mo' && c.y === '08');
    expect(mo8?.v).toBe(3);
  });

  it('entryHeatmapValue picks the right field per measurement type', () => {
    const repsEntry: HeatmapValueEntry = {
      timestamp: '2026-02-09T08:00:00',
      reps: 30,
      sets: [10, 10, 10],
    };
    expect(entryHeatmapValue(repsEntry, 'reps', 'primary')).toBe(30);
    expect(entryHeatmapValue(repsEntry, 'reps', 'breakdown')).toBe(3);
    // Weight uses `reps` for the primary value (sets × reps with a load
    // companion); the breakdown count still comes from the sets array.
    expect(entryHeatmapValue(repsEntry, 'weight', 'primary')).toBe(30);
    expect(entryHeatmapValue(repsEntry, 'weight', 'breakdown')).toBe(3);

    const timeEntry: HeatmapValueEntry = {
      timestamp: '2026-02-09T08:00:00',
      durationSec: 90,
      intervals: [30, 30, 30],
    };
    expect(entryHeatmapValue(timeEntry, 'time', 'primary')).toBe(90);
    expect(entryHeatmapValue(timeEntry, 'time', 'breakdown')).toBe(3);

    const distanceEntry: HeatmapValueEntry = {
      timestamp: '2026-02-09T08:00:00',
      distanceM: 5000,
    };
    expect(entryHeatmapValue(distanceEntry, 'distance-time', 'primary')).toBe(
      5000
    );
    expect(entryHeatmapValue(distanceEntry, 'distance', 'primary')).toBe(5000);
  });

  it('entryHeatmapValue falls back to entry-count when measurement is null/undefined', () => {
    const entry: HeatmapValueEntry = {
      timestamp: '2026-02-09T08:00:00',
      reps: 30,
    };
    expect(entryHeatmapValue(entry, null, 'primary')).toBe(1);
    expect(entryHeatmapValue(entry, undefined, 'primary')).toBe(1);
    // Mixed has no meaningful breakdown — defensive fallback is still 1.
    expect(entryHeatmapValue(entry, null, 'breakdown')).toBe(1);
    expect(entryHeatmapValue(entry, 'mixed', 'breakdown')).toBe(1);
  });

  it('entryHeatmapValue returns 0 when the primary value field is absent', () => {
    // e.g. a time-measured entry with no durationSec, or a reps-measured
    // entry with no reps — the cell should not get a phantom 1.
    expect(
      entryHeatmapValue({ timestamp: '2026-02-09T08:00:00' }, 'time', 'primary')
    ).toBe(0);
    expect(
      entryHeatmapValue({ timestamp: '2026-02-09T08:00:00' }, 'reps', 'primary')
    ).toBe(0);
    expect(
      entryHeatmapValue(
        { timestamp: '2026-02-09T08:00:00' },
        'distance',
        'primary'
      )
    ).toBe(0);
  });

  describe('formatHeatmapCellLabel', () => {
    it('returns empty string for zero/negative values', () => {
      expect(
        formatHeatmapCellLabel({
          value: 0,
          measurement: 'reps',
          mode: 'primary',
        })
      ).toBe('');
    });

    it('renders reps/weight as plain integers', () => {
      expect(
        formatHeatmapCellLabel({
          value: 45,
          measurement: 'reps',
          mode: 'primary',
        })
      ).toBe('45');
    });

    it('renders time as m:ss for sub-hour values', () => {
      expect(
        formatHeatmapCellLabel({
          value: 150,
          measurement: 'time',
          mode: 'primary',
        })
      ).toBe('2:30');
    });

    it('renders time as h:mm for >= 1 hour values', () => {
      expect(
        formatHeatmapCellLabel({
          value: 3720, // 1h 02m
          measurement: 'time',
          mode: 'primary',
        })
      ).toBe('1:02h');
    });

    it('renders distance in meters below 1 km, km above', () => {
      expect(
        formatHeatmapCellLabel({
          value: 750,
          measurement: 'distance-time',
          mode: 'primary',
        })
      ).toBe('750 m');
      expect(
        formatHeatmapCellLabel({
          value: 5000,
          measurement: 'distance-time',
          mode: 'primary',
        })
      ).toBe('5.0 km');
    });

    it('renders breakdown values as plain integers regardless of measurement', () => {
      expect(
        formatHeatmapCellLabel({
          value: 3,
          measurement: 'time',
          mode: 'breakdown',
        })
      ).toBe('3');
    });
  });

  describe('formatHeatmapTooltipValue', () => {
    it('includes units for time and distance', () => {
      expect(
        formatHeatmapTooltipValue({
          value: 150,
          measurement: 'time',
          mode: 'primary',
        })
      ).toBe('2:30 min');
      expect(
        formatHeatmapTooltipValue({
          value: 3725, // 1h 02m 05s
          measurement: 'time',
          mode: 'primary',
        })
      ).toBe('1:02:05 h');
      // One decimal place — matches the compact cell label so the
      // tooltip and the cell don't read as inconsistent precisions.
      expect(
        formatHeatmapTooltipValue({
          value: 5000,
          measurement: 'distance-time',
          mode: 'primary',
        })
      ).toBe('5.0 km');
      expect(
        formatHeatmapTooltipValue({
          value: 250,
          measurement: 'distance',
          mode: 'primary',
        })
      ).toBe('250 m');
    });

    it('returns plain integers (no unit) for breakdown and mixed modes', () => {
      // The component appends the localized unit ("Intervalle"/"Sätze"/
      // "Einträge") after this value — embedding a second unit here
      // would render "4 min Intervalle".
      expect(
        formatHeatmapTooltipValue({
          value: 4,
          measurement: 'time',
          mode: 'breakdown',
        })
      ).toBe('4');
      expect(
        formatHeatmapTooltipValue({
          value: 3,
          measurement: 'reps',
          mode: 'breakdown',
        })
      ).toBe('3');
      expect(
        formatHeatmapTooltipValue({
          value: 2,
          measurement: 'mixed',
          mode: 'primary',
        })
      ).toBe('2');
    });
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
