import { describe, expect, it } from '@jest/globals';
import type { XpLedgerEntry } from '@pu-stats/models';

import { planXpBackfill } from './backfill-plan';

const ts = '2026-09-01T10:00:00+02:00';
const entry = (id: string, userId: string, reps = 10) => ({
  id,
  data: { userId, exerciseId: 'pushup', timestamp: ts, reps },
});
const bookedLine: XpLedgerEntry = {
  userId: 'u1',
  exerciseId: 'pushup',
  timestamp: ts,
  rate: 1,
  xp: 10,
};

describe('planXpBackfill', () => {
  it('should book only entries without a ledger line', () => {
    // given
    const ledger = new Map([['u1', new Map([['e1', bookedLine]])]]);

    // when
    const plans = planXpBackfill(
      [entry('e1', 'u1'), entry('e2', 'u1', 5)],
      ledger,
      new Set(),
      null,
      new Set()
    );

    // then
    expect(plans).toHaveLength(1);
    expect(plans[0].missing).toEqual([
      {
        id: 'e2',
        line: expect.objectContaining({ xp: 5, source: 'backfill' }),
      },
    ]);
    expect(plans[0].lines).toHaveLength(2);
  });

  it('should skip users that are fully booked and aggregated', () => {
    // given
    const ledger = new Map([['u1', new Map([['e1', bookedLine]])]]);

    // when
    const plans = planXpBackfill(
      [entry('e1', 'u1')],
      ledger,
      new Set(['u1']),
      null,
      new Set()
    );

    // then
    expect(plans).toEqual([]);
  });

  it('should still rebuild a fully booked user without an aggregate', () => {
    // given
    const ledger = new Map([['u1', new Map([['e1', bookedLine]])]]);

    // when
    const plans = planXpBackfill(
      [entry('e1', 'u1')],
      ledger,
      new Set(),
      null,
      new Set()
    );

    // then
    expect(plans).toEqual([{ userId: 'u1', missing: [], lines: [bookedLine] }]);
  });

  it('should skip excluded users such as the demo account', () => {
    // when
    const plans = planXpBackfill(
      [entry('e1', 'demo')],
      new Map(),
      new Set(),
      null,
      new Set(['demo'])
    );

    // then
    expect(plans).toEqual([]);
  });
});
