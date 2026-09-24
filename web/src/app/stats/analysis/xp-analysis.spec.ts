import type { ExerciseEntry } from '@pu-stats/models';

import { buildXpAnalysis } from './xp-analysis';

function entry(
  id: string,
  exerciseId: string,
  timestamp: string,
  reps = 10
): ExerciseEntry {
  return { _id: id, userId: 'u1', exerciseId, timestamp, reps, source: 'web' };
}

const xpOf = (e: ExerciseEntry) => e.reps ?? 0;

describe('buildXpAnalysis', () => {
  it('should total XP and count active days', () => {
    // given
    const entries = [
      entry('a', 'pushup', '2026-09-01T08:00:00'),
      entry('b', 'pushup', '2026-09-01T18:00:00', 5),
      entry('c', 'pull.pullups', '2026-09-03T08:00:00', 20),
    ];

    // when
    const view = buildXpAnalysis(entries, xpOf, {
      from: '2026-09-01',
      to: '2026-09-07',
    });

    // then
    expect(view.total).toBe(35);
    expect(view.activeDays).toBe(2);
    expect(view.bestDay).toEqual({ key: '2026-09-03', xp: 20 });
  });

  it('should fill every day of a short range, empty days included', () => {
    // when
    const view = buildXpAnalysis(
      [entry('a', 'pushup', '2026-09-02T08:00:00')],
      xpOf,
      { from: '2026-09-01', to: '2026-09-03' }
    );

    // then
    expect(view.granularity).toBe('day');
    expect(view.buckets).toEqual([
      { key: '2026-09-01', xp: 0 },
      { key: '2026-09-02', xp: 10 },
      { key: '2026-09-03', xp: 0 },
    ]);
  });

  it('should switch to Monday-keyed weekly buckets for long ranges', () => {
    // given a Wednesday entry in a two-month range
    // when
    const view = buildXpAnalysis(
      [entry('a', 'pushup', '2026-09-02T08:00:00')],
      xpOf,
      { from: '2026-08-01', to: '2026-09-30' }
    );

    // then
    expect(view.granularity).toBe('week');
    expect(view.buckets[0].key).toBe('2026-07-27');
    expect(view.buckets.find((b) => b.xp > 0)).toEqual({
      key: '2026-08-31',
      xp: 10,
    });
  });

  it('should rank categories and exercises by XP share', () => {
    // given situps and plank share the core category
    const entries = [
      entry('a', 'abs.situps', '2026-09-01T08:00:00', 30),
      entry('b', 'plank.standard', '2026-09-01T09:00:00', 10),
      entry('c', 'pushup', '2026-09-01T10:00:00', 60),
    ];

    // when
    const view = buildXpAnalysis(entries, xpOf, {
      from: '2026-09-01',
      to: '2026-09-01',
    });

    // then
    expect(view.byCategory).toEqual([
      { id: 'pushup', xp: 60, share: 0.6 },
      { id: 'core', xp: 40, share: 0.4 },
    ]);
    expect(view.topExercises.map((e) => e.id)).toEqual([
      'pushup',
      'abs.situps',
      'plank.standard',
    ]);
  });

  it('should ignore entries worth no XP and handle an empty range', () => {
    // when
    const view = buildXpAnalysis(
      [entry('a', 'pushup', '2026-09-01T08:00:00', 0)],
      xpOf,
      { from: '', to: '' }
    );

    // then
    expect(view.total).toBe(0);
    expect(view.buckets).toEqual([]);
    expect(view.bestDay).toBeNull();
  });
});
