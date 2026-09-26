import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Firestore } from 'firebase-admin/firestore';

import { resetXpConfigCache } from '../xp/config-read';
import { readTrainingSummary, readUserXp } from './summary-read';

function fakeDb(opts: {
  entries?: Array<Record<string, unknown>>;
  rates?: Record<string, number>;
  userXp?: Record<string, unknown> | null;
}) {
  const select = jest.fn(() => ({
    get: async () => ({
      docs: (opts.entries ?? []).map((data) => ({ data: () => data })),
    }),
  }));
  const where = jest.fn(() => ({ select }));
  const collection = jest.fn((name: string) =>
    name === 'userXp'
      ? {
          doc: () => ({
            get: async () => ({
              exists: opts.userXp != null,
              data: () => opts.userXp,
            }),
          }),
        }
      : { where }
  );
  const doc = jest.fn(() => ({
    get: async () => ({
      exists: opts.rates != null,
      data: () => ({ rates: opts.rates }),
    }),
  }));
  return {
    db: { collection, doc } as unknown as Firestore,
    where,
    select,
  };
}

describe('readTrainingSummary', () => {
  beforeEach(() => resetXpConfigCache());

  it('should sum the owner entries across exercises', async () => {
    // given
    const { db, where, select } = fakeDb({
      entries: [
        {
          exerciseId: 'pushup',
          timestamp: '2026-09-25T08:00:00+02:00',
          reps: 30,
        },
        {
          exerciseId: 'plank.standard',
          timestamp: '2026-09-26T08:00:00+02:00',
          durationSec: 120,
        },
      ],
    });

    // when
    const summary = await readTrainingSummary(db, 'u1', '2026-09-26');

    // then
    expect(where).toHaveBeenCalledWith('userId', '==', 'u1');
    expect(select).toHaveBeenCalledWith(
      'exerciseId',
      'timestamp',
      'reps',
      'durationSec',
      'distanceM'
    );
    expect(summary).toMatchObject({
      reps: 30,
      durationSec: 120,
      entries: 2,
      days: 2,
      currentStreak: 2,
    });
  });

  it('should price the XP bests with the configured rates', async () => {
    // given
    const { db } = fakeDb({
      rates: { pushup: 2 },
      entries: [
        {
          exerciseId: 'pushup',
          timestamp: '2026-09-26T08:00:00+02:00',
          reps: 30,
        },
        {
          exerciseId: 'pushup',
          timestamp: '2026-09-26T18:00:00+02:00',
          reps: 20,
        },
      ],
    });

    // when
    const summary = await readTrainingSummary(db, 'u1', '2026-09-26');

    // then
    expect(summary.bestEntryXp).toBe(60);
    expect(summary.bestDayXp).toBe(100);
  });

  it('should ignore fields of the wrong type', async () => {
    // given
    const { db } = fakeDb({
      entries: [
        {
          exerciseId: 'pushup',
          timestamp: '2026-09-26T08:00:00+02:00',
          reps: '30',
        },
      ],
    });

    // when
    const summary = await readTrainingSummary(db, 'u1', '2026-09-26');

    // then
    expect(summary.reps).toBe(0);
    expect(summary.entries).toBe(1);
  });
});

describe('readUserXp', () => {
  it('should return the aggregate when it exists', async () => {
    // given
    const { db } = fakeDb({ userXp: { total: 1234 } });

    // when / then
    expect(await readUserXp(db, 'u1')).toEqual({ total: 1234 });
  });

  it('should return null before the first booking', async () => {
    // given
    const { db } = fakeDb({ userXp: null });

    // when / then
    expect(await readUserXp(db, 'u1')).toBeNull();
  });
});
