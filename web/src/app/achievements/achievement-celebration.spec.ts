import {
  STORAGE_KEY,
  markCelebrated,
  pendingCelebrations,
  readCelebrated,
} from './achievement-celebration';

describe('pendingCelebrations', () => {
  const earned = [
    { id: 'plan-days-1', awardedAt: '2026-01-02T00:00:00.000Z' },
    { id: 'plan-days-10', awardedAt: '2026-03-01T00:00:00.000Z' },
  ];

  it('should return newest first', () => {
    // then
    expect(pendingCelebrations(earned, new Set())).toEqual([
      'plan-days-10',
      'plan-days-1',
    ]);
  });

  it('should skip what was already celebrated', () => {
    // given — the document re-syncs on every visit, so without dedupe the
    // dialog would reopen forever
    // then
    expect(pendingCelebrations(earned, new Set(['plan-days-10']))).toEqual([
      'plan-days-1',
    ]);
  });

  it('should return nothing when all are known', () => {
    expect(
      pendingCelebrations(earned, new Set(['plan-days-1', 'plan-days-10']))
    ).toEqual([]);
  });

  it.each([
    ['an empty list', []],
    ['entries without an id', [{ id: '', awardedAt: 'x' }]],
  ])('should tolerate %s', (_label, input) => {
    expect(pendingCelebrations(input as never, new Set())).toEqual([]);
  });
});

describe('celebration bookkeeping', () => {
  beforeEach(() => globalThis.localStorage?.removeItem(STORAGE_KEY));

  it('should round-trip through storage', () => {
    // when
    markCelebrated(['plan-days-1']);

    // then
    expect(readCelebrated().has('plan-days-1')).toBe(true);
  });

  it('should merge rather than replace', () => {
    // when
    markCelebrated(['plan-days-1']);
    markCelebrated(['plan-days-10']);

    // then
    expect([...readCelebrated()].sort()).toEqual([
      'plan-days-1',
      'plan-days-10',
    ]);
  });

  it('should degrade to empty on unreadable storage', () => {
    // given — sandboxed origins and private mode can throw on access
    globalThis.localStorage?.setItem(STORAGE_KEY, 'kein json');

    // then
    expect(readCelebrated().size).toBe(0);
  });

  it('should not write for an empty list', () => {
    // when
    markCelebrated([]);

    // then
    expect(globalThis.localStorage?.getItem(STORAGE_KEY)).toBeNull();
  });
});
