import { describe, expect, it } from '@jest/globals';

import { isBackfillCreation, ledgerLineFor, sameLedgerLine } from './ledger';

const entry = {
  userId: 'u1',
  exerciseId: 'pull.pullups',
  timestamp: '2026-09-24T10:00:00+02:00',
  reps: 10,
};

describe('ledgerLineFor', () => {
  it('should book a new entry at the configured rate', () => {
    // when
    const line = ledgerLineFor(entry, null, { rates: { 'pull.pullups': 4 } });

    // then
    expect(line).toEqual({
      userId: 'u1',
      exerciseId: 'pull.pullups',
      timestamp: entry.timestamp,
      rate: 4,
      xp: 40,
    });
  });

  it('should fall back to the default rate without a config', () => {
    // when
    const line = ledgerLineFor(entry, null, null);

    // then
    expect(line?.rate).toBe(3);
    expect(line?.xp).toBe(30);
  });

  it('should keep the frozen rate when an entry is edited', () => {
    // given — the admin has since doubled the rate
    const edited = { ...entry, reps: 20 };

    // when
    const line = ledgerLineFor(
      edited,
      { rate: 3 },
      {
        rates: { 'pull.pullups': 6 },
      }
    );

    // then
    expect(line?.xp).toBe(60);
  });

  it('should return null for a deleted or malformed entry', () => {
    // then
    expect(ledgerLineFor(undefined, null, null)).toBeNull();
    expect(ledgerLineFor({ ...entry, userId: '' }, null, null)).toBeNull();
    expect(
      ledgerLineFor({ ...entry, timestamp: 42 } as never, null, null)
    ).toBeNull();
  });
});

describe('sameLedgerLine', () => {
  it('should treat identical lines as unchanged and ignore the source flag', () => {
    // given
    const line = ledgerLineFor(entry, null, null);
    if (!line) throw new Error('expected a ledger line');

    // then
    expect(sameLedgerLine(line, { ...line, source: 'backfill' })).toBe(true);
    expect(sameLedgerLine(line, { ...line, xp: 1 })).toBe(false);
    expect(sameLedgerLine(null, null)).toBe(true);
    expect(sameLedgerLine(line, null)).toBe(false);
  });
});

describe('isBackfillCreation', () => {
  it('should only flag lines the backfill created', () => {
    // then
    expect(isBackfillCreation(undefined, { source: 'backfill' })).toBe(true);
    expect(isBackfillCreation(undefined, { xp: 1 })).toBe(false);
    expect(
      isBackfillCreation({ source: 'backfill' }, { source: 'backfill' })
    ).toBe(false);
    expect(isBackfillCreation({ source: 'backfill' }, undefined)).toBe(false);
  });
});
