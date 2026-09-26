import {
  applyTrainingLine,
  berlinDayAndSlot,
  emptyTrainingStats,
  rebuildTrainingStats,
  rememberTrainingEvent,
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

  it('should return null for an unparsable timestamp', () => {
    // then
    expect(berlinDayAndSlot('kaputt')).toBeNull();
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

describe('rememberTrainingEvent', () => {
  it('should keep only the newest 50 ids', () => {
    // given
    const ids = Array.from({ length: 50 }, (_, i) => `e${i}`);

    // when
    const next = rememberTrainingEvent(ids, 'new');

    // then
    expect(next).toHaveLength(50);
    expect(next[0]).toBe('e1');
    expect(next.at(-1)).toBe('new');
  });
});
