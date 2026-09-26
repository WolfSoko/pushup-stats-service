import {
  applyTrainingLine,
  berlinDayAndSlot,
  emptyTrainingStats,
  nextTrainingStats,
  rebuildTrainingStats,
  xpRatesKey,
  type TrainingLine,
} from './training-stats.models';
import { summaryFromTrainingStats } from './training-summary';

function line(
  exerciseId: string,
  timestamp: string,
  value: Partial<TrainingLine> = {}
): TrainingLine {
  return { exerciseId, timestamp, xp: 0, ...value };
}

const PUSHUPS = line('pushup', '2026-09-25T08:15:00+02:00', {
  reps: 30,
  xp: 30,
});
const PLANK = line('plank.standard', '2026-09-25T19:00:00+02:00', {
  durationSec: 120,
  xp: 10,
});
const RUN = line('cardio.running', '2026-09-26T07:00:00+02:00', {
  distanceM: 5000,
  durationSec: 1800,
  xp: 50,
});

describe('berlinDayAndSlot', () => {
  it('should key the day and slot in Berlin time with German weekdays', () => {
    // when — 22:30 UTC on a Thursday is 00:30 on Friday in Berlin
    const result = berlinDayAndSlot('2026-09-24T22:30:00Z');

    // then
    expect(result).toEqual({ day: '2026-09-25', slot: 'Fr-00' });
  });

  it('should read an offset-less timestamp as Berlin local time', () => {
    // given — older entries were stored without an offset; reading them
    // as UTC would move a late workout to the next day
    const result = berlinDayAndSlot('2026-04-05T22:50');

    // then
    expect(result).toEqual({ day: '2026-04-05', slot: 'So-22' });
  });

  it('should return null for an unparsable timestamp', () => {
    // then
    expect(berlinDayAndSlot('kaputt')).toBeNull();
    expect(berlinDayAndSlot('2026-13-45T99:00')).toBeNull();
  });
});

describe('applyTrainingLine', () => {
  it('should add volume per unit, the day and the heatmap slot', () => {
    // when
    const stats = rebuildTrainingStats('u1', [PUSHUPS, PLANK, RUN]);

    // then
    expect(stats).toMatchObject({
      reps: 30,
      durationSec: 120,
      distanceM: 5000,
      entries: 3,
      days: {
        '2026-09-25': { entries: 2, xp: 40 },
        '2026-09-26': { entries: 1, xp: 50 },
      },
      heatmap: { 'Fr-08': 30, 'Fr-19': 10, 'Sa-07': 50 },
      bestEntryXp: 50,
    });
  });

  it('should cancel an add exactly with the matching removal', () => {
    // given
    const before = rebuildTrainingStats('u1', [PUSHUPS]);
    const added = applyTrainingLine(before, PLANK, 1).stats;

    // when
    const { stats } = applyTrainingLine(added, PLANK, -1);

    // then
    expect(stats).toEqual(before);
  });

  it('should drop a day once its last entry is removed', () => {
    // given
    const stats = rebuildTrainingStats('u1', [PUSHUPS, RUN]);

    // when
    const next = applyTrainingLine(stats, RUN, -1).stats;

    // then
    expect(Object.keys(next.days)).toEqual(['2026-09-25']);
    expect(next.heatmap['Sa-07']).toBeUndefined();
  });

  it('should ask for a rebuild when the best entry may be gone', () => {
    // given
    const stats = rebuildTrainingStats('u1', [PUSHUPS, RUN]);

    // then
    expect(applyTrainingLine(stats, RUN, -1).needsRebuild).toBe(true);
    expect(applyTrainingLine(stats, PUSHUPS, -1).needsRebuild).toBe(false);
  });

  it('should ignore unknown exercises on both sides', () => {
    // given
    const stats = emptyTrainingStats('u1');
    const retired = line('retired.exercise', PUSHUPS.timestamp, {
      reps: 10,
      xp: 10,
    });

    // then
    expect(applyTrainingLine(stats, retired, 1).stats).toBe(stats);
    expect(applyTrainingLine(stats, retired, -1).stats).toBe(stats);
  });
});

describe('summaryFromTrainingStats', () => {
  it('should derive days, streak and best day from the day map', () => {
    // given
    const stats = rebuildTrainingStats('u1', [PUSHUPS, PLANK, RUN]);

    // when
    const summary = summaryFromTrainingStats(stats, '2026-09-27');

    // then
    expect(summary).toMatchObject({
      days: 2,
      currentStreak: 2,
      bestEntryXp: 50,
      bestDayXp: 50,
    });
  });
});

describe('rebuildTrainingStats', () => {
  it('should fold to the same result as applying every line one by one', () => {
    // given
    const lines = [PUSHUPS, PLANK, RUN, { ...PUSHUPS, reps: 5, xp: 5 }];

    // when
    const folded = rebuildTrainingStats('u1', lines);
    const stepwise = lines.reduce(
      (acc, l) => applyTrainingLine(acc, l, 1).stats,
      emptyTrainingStats('u1')
    );

    // then
    expect(folded).toEqual(stepwise);
  });

  it('should stamp the rates and the read time it was built from', () => {
    // when
    const stats = rebuildTrainingStats('u1', [PUSHUPS], {
      ratesKey: 'k1',
      rebuiltAt: '2026-09-26T10:00:00.000Z',
    });

    // then
    expect(stats.ratesKey).toBe('k1');
    expect(stats.rebuiltAt).toBe('2026-09-26T10:00:00.000Z');
  });
});

describe('nextTrainingStats', () => {
  const KEY = 'k1';
  const current = () =>
    rebuildTrainingStats('u1', [RUN, PUSHUPS], {
      ratesKey: KEY,
    });

  it('should ask for a rebuild while there is no aggregate yet', () => {
    // then
    expect(nextTrainingStats(null, null, PUSHUPS, KEY)).toBeNull();
  });

  it('should ask for a rebuild once the rates changed', () => {
    // then — a removal priced at new rates would not cancel the old add
    expect(nextTrainingStats(current(), PUSHUPS, null, 'k2')).toBeNull();
  });

  it('should swap the old state of an edited entry for the new one', () => {
    // when
    const next = nextTrainingStats(
      current(),
      PUSHUPS,
      { ...PUSHUPS, reps: 40, xp: 40 },
      KEY
    );

    // then
    expect(next).toMatchObject({ reps: 40, entries: 2, bestEntryXp: 50 });
  });

  it('should ask for a rebuild when the best entry is removed', () => {
    // then
    expect(nextTrainingStats(current(), RUN, null, KEY)).toBeNull();
  });

  it('should leave the aggregate alone when no counted field changed', () => {
    // given — e.g. a note edited on the best entry
    const stats = current();

    // then
    expect(nextTrainingStats(stats, RUN, { ...RUN }, KEY)).toBe(stats);
  });
});

describe('xpRatesKey', () => {
  it('should stay the same for the same rates', () => {
    // then
    expect(xpRatesKey({ rates: { pushup: 2 } })).toBe(
      xpRatesKey({ rates: { pushup: 2 } })
    );
  });

  it('should change when any effective rate changes', () => {
    // then
    expect(xpRatesKey({ rates: { pushup: 2 } })).not.toBe(xpRatesKey(null));
  });
});
