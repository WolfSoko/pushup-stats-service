import type { UnifiedEntry } from '@pu-stats/models';
import {
  buildExerciseSeries,
  collectExerciseIds,
  EXERCISE_PALETTE,
  exerciseColor,
  UNKNOWN_EXERCISE_COLOR,
  withoutHiddenExercises,
} from './exercise-breakdown';

function repsRow(
  exerciseId: string,
  timestamp: string,
  reps: number
): UnifiedEntry {
  return {
    kind: 'exercise',
    _id: `${exerciseId}-${timestamp}`,
    userId: 'u1',
    exerciseId,
    timestamp,
    reps,
    source: 'web',
  } as UnifiedEntry;
}

describe('collectExerciseIds', () => {
  it('should list every exercise once, most-logged first', () => {
    // given
    const rows = [
      repsRow('abs.situps', '2026-02-10T08:00:00.000Z', 20),
      repsRow('pushup', '2026-02-10T09:00:00.000Z', 50),
      repsRow('abs.situps', '2026-02-11T08:00:00.000Z', 20),
    ];

    // when
    const ids = collectExerciseIds(rows);

    // then
    expect(ids).toEqual(['abs.situps', 'pushup']);
  });

  it('should rank by trainings, not by volume — units are not comparable', () => {
    // given — one 5 km run against two pushup sessions
    const rows = [
      {
        kind: 'exercise',
        _id: 'r1',
        userId: 'u1',
        exerciseId: 'cardio.running',
        timestamp: '2026-02-10T09:00:00.000Z',
        reps: 0,
        distanceM: 5000,
        durationSec: 1500,
        source: 'web',
      } as UnifiedEntry,
      repsRow('pushup', '2026-02-10T10:00:00.000Z', 50),
      repsRow('pushup', '2026-02-11T10:00:00.000Z', 50),
    ];

    // when / then — 5000 m must not outrank two trainings
    expect(collectExerciseIds(rows)).toEqual(['pushup', 'cardio.running']);
  });

  it('should break ties by id so the colour order never flickers between renders', () => {
    // given
    const rows = [
      repsRow('b.two', '2026-02-10T08:00:00.000Z', 10),
      repsRow('a.one', '2026-02-10T09:00:00.000Z', 10),
    ];

    // when / then
    expect(collectExerciseIds(rows)).toEqual(['a.one', 'b.two']);
  });
});

describe('withoutHiddenExercises', () => {
  it('should drop only the unchecked exercises', () => {
    // given
    const rows = [
      repsRow('abs.situps', '2026-02-10T08:00:00.000Z', 20),
      repsRow('pushup', '2026-02-10T09:00:00.000Z', 50),
    ];

    // when
    const kept = withoutHiddenExercises(rows, ['pushup']);

    // then
    expect(kept.map((r) => r.exerciseId)).toEqual(['abs.situps']);
  });

  it('should keep every row when nothing is hidden', () => {
    // given
    const rows = [repsRow('pushup', '2026-02-10T09:00:00.000Z', 50)];

    // when / then
    expect(withoutHiddenExercises(rows, [])).toHaveLength(1);
  });
});

describe('exerciseColor', () => {
  it('should assign colours by position so an exercise keeps its colour across charts', () => {
    // given
    const order = ['pushup', 'abs.situps'];

    // when / then
    expect(exerciseColor('pushup', order)).toBe(EXERCISE_PALETTE[0]);
    expect(exerciseColor('abs.situps', order)).toBe(EXERCISE_PALETTE[1]);
  });

  it('should hold enough distinct colours that a realistic stack never repeats one', () => {
    // A stacked bar carries no per-segment labels, so two segments in
    // the same colour cannot be told apart at all.
    // given
    const order = Array.from(
      { length: EXERCISE_PALETTE.length },
      (_, i) => `e${i}`
    );

    // when
    const colours = order.map((id) => exerciseColor(id, order));

    // then
    expect(new Set(colours).size).toBe(EXERCISE_PALETTE.length);
    expect(EXERCISE_PALETTE.length).toBeGreaterThanOrEqual(16);
  });

  it('should cycle the palette rather than run out of colours', () => {
    // given
    const order = Array.from(
      { length: EXERCISE_PALETTE.length + 1 },
      (_, i) => `e${i}`
    );

    // when / then
    expect(exerciseColor(`e${EXERCISE_PALETTE.length}`, order)).toBe(
      EXERCISE_PALETTE[0]
    );
  });

  it('should give an id the order does not know a colour of its own, never a real exercise\u2019s', () => {
    // given
    const order = ['pushup', 'abs.situps'];

    // when
    const colour = exerciseColor('ghost.exercise', order);

    // then
    expect(colour).toBe(UNKNOWN_EXERCISE_COLOR);
    expect(EXERCISE_PALETTE).not.toContain(colour);
  });
});

describe('buildExerciseSeries', () => {
  const dailyOpts = {
    from: '2026-02-10',
    granularity: 'daily' as const,
    dayChartMode: '14h' as const,
    measurement: 'reps' as const,
  };

  it('should align each exercise to the buckets it was handed, zero-filling the days it is missing', () => {
    // given
    const rows = [
      repsRow('pushup', '2026-02-10T09:00:00.000Z', 50),
      repsRow('abs.situps', '2026-02-11T09:00:00.000Z', 20),
      repsRow('pushup', '2026-02-11T10:00:00.000Z', 30),
    ];
    const buckets = ['2026-02-10', '2026-02-11', '2026-02-12'];

    // when
    const series = buildExerciseSeries(
      rows,
      buckets,
      ['pushup', 'abs.situps'],
      dailyOpts
    );

    // then
    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({
      exerciseId: 'pushup',
      values: [50, 30, 0],
      total: 80,
    });
    expect(series[1]).toMatchObject({
      exerciseId: 'abs.situps',
      values: [0, 20, 0],
      total: 20,
    });
  });

  it('should ignore rows outside the handed-in buckets instead of growing the arrays', () => {
    // given
    const rows = [
      repsRow('pushup', '2026-02-10T09:00:00.000Z', 50),
      repsRow('pushup', '2026-03-01T09:00:00.000Z', 999),
    ];

    // when
    const series = buildExerciseSeries(
      rows,
      ['2026-02-10'],
      ['pushup'],
      dailyOpts
    );

    // then
    expect(series[0].values).toEqual([50]);
  });

  it('should follow the colour order rather than its own volume order', () => {
    // given — situps outweigh pushups, but the order says pushups first
    const rows = [
      repsRow('abs.situps', '2026-02-10T08:00:00.000Z', 90),
      repsRow('pushup', '2026-02-10T09:00:00.000Z', 10),
    ];

    // when
    const series = buildExerciseSeries(
      rows,
      ['2026-02-10'],
      ['pushup', 'abs.situps'],
      dailyOpts
    );

    // then
    expect(series.map((s) => s.exerciseId)).toEqual(['pushup', 'abs.situps']);
  });

  it('should scale distances to km so the parts add up to the aggregate bar', () => {
    // given
    const rows = [
      {
        kind: 'exercise',
        _id: 'r1',
        userId: 'u1',
        exerciseId: 'cardio.running',
        timestamp: '2026-02-10T09:00:00.000Z',
        reps: 0,
        distanceM: 5000,
        durationSec: 1500,
        source: 'web',
      } as UnifiedEntry,
    ];

    // when
    const series = buildExerciseSeries(rows, ['2026-02-10'], [], {
      ...dailyOpts,
      measurement: 'distance-time',
    });

    // then
    expect(series[0].values).toEqual([5]);
  });

  it('should return nothing when there are no buckets to align to', () => {
    // given / when / then
    expect(
      buildExerciseSeries(
        [repsRow('pushup', '2026-02-10T09:00:00.000Z', 10)],
        [],
        [],
        dailyOpts
      )
    ).toEqual([]);
  });
});
