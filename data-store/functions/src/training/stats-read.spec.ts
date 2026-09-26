import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TRAINING_STATS_VERSION } from '@pu-stats/models';
import type { Firestore } from 'firebase-admin/firestore';

import { resetXpConfigCache } from '../xp/config-read';
import { readTrainingStats } from './stats-read';

function fakeDb(opts: {
  aggregate?: Record<string, unknown>;
  entries?: Array<Record<string, unknown>>;
}) {
  const queryGet = jest.fn(async () => ({
    docs: (opts.entries ?? []).map((data) => ({ data: () => data })),
  }));
  const doc = jest.fn((path: string) => ({
    get: async () => {
      const data = path.startsWith('userStats/') ? opts.aggregate : undefined;
      return { exists: data !== undefined, data: () => data };
    },
  }));
  const collection = jest.fn(() => ({
    where: () => ({ select: () => ({ get: queryGet }) }),
  }));
  return { db: { doc, collection } as unknown as Firestore, doc, queryGet };
}

const ENTRY = {
  exerciseId: 'pushup',
  timestamp: '2026-09-25T08:00:00+02:00',
  reps: 30,
};

describe('readTrainingStats', () => {
  beforeEach(() => resetXpConfigCache());

  it('should return the stored aggregate without touching the entries', async () => {
    // given
    const aggregate = { reps: 99, version: TRAINING_STATS_VERSION };
    const { db, doc, queryGet } = fakeDb({ aggregate, entries: [ENTRY] });

    // when
    const stats = await readTrainingStats(db, 'u1');

    // then
    expect(stats).toBe(aggregate);
    expect(doc).toHaveBeenCalledWith('userStats/u1/aggregates/training');
    expect(queryGet).not.toHaveBeenCalled();
  });

  it.each([
    ['is missing', undefined],
    ['predates the current version', { reps: 99, version: 0 }],
  ])(
    'should compute it from the entries when the aggregate %s',
    async (_label, aggregate) => {
      // given
      const { db } = fakeDb({ aggregate, entries: [ENTRY] });

      // when
      const stats = await readTrainingStats(db, 'u1');

      // then
      expect(stats).toMatchObject({ userId: 'u1', reps: 30, entries: 1 });
    }
  );
});
