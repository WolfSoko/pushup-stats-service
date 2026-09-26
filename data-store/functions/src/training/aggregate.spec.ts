import { describe, expect, it } from '@jest/globals';
import {
  emptyTrainingStats,
  rebuildTrainingStats,
  type TrainingLine,
} from '@pu-stats/models';

import { nextTrainingStats } from './aggregate';

const SMALL: TrainingLine = {
  exerciseId: 'pushup',
  timestamp: '2026-09-25T08:00:00+02:00',
  reps: 10,
  xp: 10,
};
const BIG: TrainingLine = { ...SMALL, reps: 50, xp: 50 };

describe('nextTrainingStats', () => {
  it('should ask for a rebuild while there is no aggregate yet', () => {
    // then
    expect(nextTrainingStats(null, null, SMALL)).toBeNull();
  });

  it('should add a created entry', () => {
    // when
    const next = nextTrainingStats(emptyTrainingStats('u1'), null, SMALL);

    // then
    expect(next).toMatchObject({ reps: 10, entries: 1 });
  });

  it('should swap the old state of an edited entry for the new one', () => {
    // given
    const current = rebuildTrainingStats('u1', [BIG, SMALL]);
    const edited = { ...SMALL, reps: 20, xp: 20 };

    // when
    const next = nextTrainingStats(current, SMALL, edited);

    // then
    expect(next).toMatchObject({ reps: 70, entries: 2, bestEntryXp: 50 });
  });

  it('should ask for a rebuild when the best entry is removed', () => {
    // given
    const current = rebuildTrainingStats('u1', [BIG, SMALL]);

    // then
    expect(nextTrainingStats(current, BIG, null)).toBeNull();
  });

  it('should remove a deleted entry that was not the best', () => {
    // given
    const current = rebuildTrainingStats('u1', [BIG, SMALL]);

    // when
    const next = nextTrainingStats(current, SMALL, null);

    // then
    expect(next).toMatchObject({ reps: 50, entries: 1 });
  });
});
