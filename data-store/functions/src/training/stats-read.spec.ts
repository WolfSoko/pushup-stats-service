import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TRAINING_STATS_VERSION, xpRatesKey } from '@pu-stats/models';
import type { Firestore } from 'firebase-admin/firestore';

import { resetXpConfigCache } from '../xp/config-read';
import { readTrainingStats, readTrainingStatsMany } from './stats-read';

const READ_TIME = new Date('2026-09-26T10:00:00.000Z');

function fakeDb(opts: {
  aggregates?: Record<string, Record<string, unknown>>;
  entries?: Record<string, Array<Record<string, unknown>>>;
}) {
  const scanned: string[] = [];
  const docRef = (path: string) => ({ path });
  const getAll = jest.fn(async (...refs: Array<{ path: string }>) =>
    refs.map((ref) => {
      const uid = ref.path.split('/')[1];
      const data = opts.aggregates?.[uid];
      return { exists: data !== undefined, data: () => data };
    })
  );
  const doc = jest.fn((path: string) =>
    path.startsWith('userStats/')
      ? docRef(path)
      : { get: async () => ({ exists: false, data: () => undefined }) }
  );
  const collection = jest.fn(() => ({
    where: (_field: string, _op: string, uid: string) => ({
      select: () => ({
        get: async () => {
          scanned.push(uid);
          return {
            docs: (opts.entries?.[uid] ?? []).map((data) => ({
              data: () => data,
            })),
            readTime: { toDate: () => READ_TIME },
          };
        },
      }),
    }),
  }));
  return {
    db: { doc, collection, getAll } as unknown as Firestore,
    getAll,
    scanned,
  };
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
    const { db, scanned } = fakeDb({
      aggregates: { u1: aggregate },
      entries: { u1: [ENTRY] },
    });

    // when
    const stats = await readTrainingStats(db, 'u1');

    // then
    expect(stats).toBe(aggregate);
    expect(scanned).toEqual([]);
  });

  it.each([
    ['is missing', undefined],
    ['predates the current version', { reps: 99, version: 1 }],
  ])(
    'should compute it from the entries when the aggregate %s',
    async (_label, aggregate) => {
      // given
      const { db } = fakeDb({
        aggregates: aggregate ? { u1: aggregate } : {},
        entries: { u1: [ENTRY] },
      });

      // when
      const stats = await readTrainingStats(db, 'u1');

      // then
      expect(stats).toMatchObject({
        userId: 'u1',
        reps: 30,
        entries: 1,
        ratesKey: xpRatesKey(null),
        rebuiltAt: READ_TIME.toISOString(),
      });
    }
  );
});

describe('readTrainingStatsMany', () => {
  beforeEach(() => resetXpConfigCache());

  it('should read all aggregates in one call and scan only the missing ones', async () => {
    // given
    const { db, getAll, scanned } = fakeDb({
      aggregates: { a: { reps: 1, version: TRAINING_STATS_VERSION } },
      entries: { a: [ENTRY], b: [ENTRY] },
    });

    // when
    const [a, b] = await readTrainingStatsMany(db, ['a', 'b']);

    // then
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(scanned).toEqual(['b']);
    expect(a.reps).toBe(1);
    expect(b.reps).toBe(30);
  });
});
