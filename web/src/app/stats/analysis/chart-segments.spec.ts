import type { ExerciseDefinition, UnifiedEntry } from '@pu-stats/models';
import {
  buildViewChartSegments,
  groupRowsByMeasurement,
} from './chart-segments';

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

const dailyOpts = {
  from: '2026-06-15',
  isDayRange: false,
  dayChartMode: '14h' as const,
};

describe('groupRowsByMeasurement', () => {
  it('should bucket rows by their catalog measurement', () => {
    // given
    const rows = [
      entry({ exerciseId: 'pushup', reps: 20 }),
      entry({ exerciseId: 'plank.standard', durationSec: 60 }),
      entry({ exerciseId: 'abs.situps', reps: 30 }),
    ];
    // when
    const grouped = groupRowsByMeasurement(rows);
    // then
    expect(grouped.get('reps')).toHaveLength(2);
    expect(grouped.get('time')).toHaveLength(1);
  });

  it('should bucket rows the resolver cannot classify as mixed', () => {
    // given
    const rows = [entry({ exerciseId: 'deleted.custom', reps: 5 })];
    // when
    const grouped = groupRowsByMeasurement(rows);
    // then
    expect(grouped.get('mixed')).toHaveLength(1);
  });

  it('should honour a custom resolver for user-defined exercises', () => {
    // given
    const custom: ExerciseDefinition = {
      id: 'custom.hold',
      categoryId: 'core',
      ownerId: 'u1',
      measurement: 'time',
      min: 1,
      max: 600,
      unit: 'sec',
      customName: 'Custom Hold',
    } as ExerciseDefinition;
    const rows = [entry({ exerciseId: 'custom.hold', durationSec: 45 })];
    // when
    const grouped = groupRowsByMeasurement(rows, (id) =>
      id === custom.id ? custom : null
    );
    // then
    expect(grouped.get('time')).toHaveLength(1);
    expect(grouped.has('mixed')).toBe(false);
  });
});

describe('buildViewChartSegments', () => {
  it('should return a single segment for a uniform view', () => {
    // given
    const rows = [
      entry({ exerciseId: 'pushup', reps: 20, timestamp: '2026-06-15T10:00' }),
      entry({
        exerciseId: 'abs.situps',
        reps: 30,
        timestamp: '2026-06-15T11:00',
      }),
    ];
    // when
    const segments = buildViewChartSegments(rows, dailyOpts);
    // then
    expect(segments).toHaveLength(1);
    expect(segments[0].measurement).toBe('reps');
    expect(segments[0].series).toEqual([
      { bucket: '2026-06-15', total: 50, dayIntegral: 50 },
    ]);
  });

  it('should split counted and timed exercises into separate charts', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'abs.situps',
        reps: 30,
        timestamp: '2026-06-15T10:00',
      }),
      entry({
        exerciseId: 'plank.standard',
        durationSec: 60,
        timestamp: '2026-06-15T11:00',
      }),
    ];
    // when
    const segments = buildViewChartSegments(rows, dailyOpts);
    // then
    expect(segments.map((s) => s.measurement)).toEqual(['reps', 'time']);
    expect(segments[0].series[0].total).toBe(30);
    expect(segments[1].series[0].total).toBe(60);
  });

  it('should keep each segment’s entries feed scoped to its own rows', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'abs.situps',
        reps: 30,
        timestamp: '2026-06-15T10:00',
      }),
      entry({
        exerciseId: 'plank.standard',
        durationSec: 60,
        timestamp: '2026-06-15T11:00',
      }),
    ];
    // when
    const segments = buildViewChartSegments(rows, dailyOpts);
    // then
    expect(segments[0].entries).toEqual([
      { timestamp: '2026-06-15T10:00', reps: 30 },
    ]);
    expect(segments[1].entries).toEqual([
      { timestamp: '2026-06-15T11:00', reps: 60 },
    ]);
  });

  it('should order segments reps → time → distance-time', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'cardio.running',
        distanceM: 5000,
        durationSec: 1500,
      }),
      entry({ exerciseId: 'plank.standard', durationSec: 60 }),
      entry({ exerciseId: 'abs.situps', reps: 30 }),
    ];
    // when
    const segments = buildViewChartSegments(rows, dailyOpts);
    // then
    expect(segments.map((s) => s.measurement)).toEqual([
      'reps',
      'time',
      'distance-time',
    ]);
  });

  it('should compute pace only for the distance segment of a mixed view', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'cardio.running',
        distanceM: 5000,
        durationSec: 1500,
        timestamp: '2026-06-15T10:00',
      }),
      entry({
        exerciseId: 'cardio.burpees',
        reps: 20,
        timestamp: '2026-06-15T11:00',
      }),
    ];
    // when
    const segments = buildViewChartSegments(rows, dailyOpts);
    const reps = segments.find((s) => s.measurement === 'reps');
    const distance = segments.find((s) => s.measurement === 'distance-time');
    // then
    expect(reps?.paceSeries).toEqual([]);
    expect(distance?.paceSeries[0].pace).toBeCloseTo(5, 5);
    // distance stays scaled to km so the two charts keep their own units
    expect(distance?.series[0].total).toBe(5);
    expect(reps?.series[0].total).toBe(20);
  });

  it('should return no segments for an empty view', () => {
    // given / when / then
    expect(buildViewChartSegments([], dailyOpts)).toEqual([]);
  });
});
