import {
  buildXpAnalysis,
  xpBucketGranularity,
  type XpAnalysisEntry,
} from './xp-analysis';

function entry(
  id: string,
  exerciseId: string,
  timestamp: string,
  reps = 10
): XpAnalysisEntry {
  return { _id: id, exerciseId, timestamp, reps };
}

const xpOf = (e: XpAnalysisEntry) => e.reps ?? 0;

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
      granularity: 'daily',
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
      { from: '2026-09-01', to: '2026-09-03', granularity: 'daily' }
    );

    // then
    expect(view.granularity).toBe('daily');
    expect(view.buckets).toEqual([
      { key: '2026-09-01', xp: 0 },
      { key: '2026-09-02', xp: 10 },
      { key: '2026-09-03', xp: 0 },
    ]);
  });

  it('should key weekly buckets by Monday when the page shows weeks', () => {
    // given a Wednesday entry in a two-month range
    // when
    const view = buildXpAnalysis(
      [entry('a', 'pushup', '2026-09-02T08:00:00')],
      xpOf,
      { from: '2026-08-01', to: '2026-09-30', granularity: 'weekly' }
    );

    // then
    expect(view.granularity).toBe('weekly');
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
      granularity: 'daily',
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
      { from: '', to: '', granularity: 'daily' }
    );

    // then
    expect(view.total).toBe(0);
    expect(view.buckets).toEqual([]);
    expect(view.bestDay).toBeNull();
  });
});

describe('monthly XP buckets', () => {
  it('should key monthly buckets by the first of the month', () => {
    // when
    const view = buildXpAnalysis(
      [
        entry('a', 'pushup', '2026-08-20T08:00:00', 5),
        entry('b', 'pushup', '2026-09-02T08:00:00', 7),
      ],
      xpOf,
      { from: '2026-08-15', to: '2026-09-10', granularity: 'monthly' }
    );

    // then
    expect(view.buckets).toEqual([
      { key: '2026-08-01', xp: 5 },
      { key: '2026-09-01', xp: 7 },
    ]);
  });
});

describe('xpBucketGranularity', () => {
  it('should show a single-day range per day and keep the rest', () => {
    // then
    expect(xpBucketGranularity('hourly')).toBe('daily');
    expect(xpBucketGranularity('weekly')).toBe('weekly');
    expect(xpBucketGranularity('monthly')).toBe('monthly');
  });
});
