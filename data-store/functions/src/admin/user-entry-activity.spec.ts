import { describe, it, expect } from '@jest/globals';
import {
  aggregateEntryActivity,
  nextActivityAggregate,
} from './user-entry-activity';

describe('aggregateEntryActivity', () => {
  it('should count entries and keep the latest timestamp per user', () => {
    // given
    const entries = [
      { userId: 'a', timestamp: '2026-01-01T08:00:00.000Z' },
      { userId: 'a', timestamp: '2026-03-05T09:00:00.000Z' },
      { userId: 'b', timestamp: '2026-02-02T10:00:00.000Z' },
    ];
    // when
    const result = aggregateEntryActivity(entries);
    // then
    expect(result.get('a')).toEqual({
      count: 2,
      lastTimestamp: '2026-03-05T09:00:00.000Z',
    });
    expect(result.get('b')).toEqual({
      count: 1,
      lastTimestamp: '2026-02-02T10:00:00.000Z',
    });
  });

  it('should ignore entries without a string userId', () => {
    // given
    const entries = [
      { timestamp: '2026-01-01T08:00:00.000Z' },
      { userId: '', timestamp: '2026-01-01T08:00:00.000Z' },
      { userId: 42, timestamp: '2026-01-01T08:00:00.000Z' },
      { userId: 'a', timestamp: '2026-01-01T08:00:00.000Z' },
    ];
    // when
    const result = aggregateEntryActivity(entries);
    // then
    expect(result.size).toBe(1);
    expect(result.get('a')?.count).toBe(1);
  });

  it('should treat a missing/non-string timestamp as no last entry but still count it', () => {
    // given
    const entries = [{ userId: 'a' }, { userId: 'a', timestamp: 123 }];
    // when
    const result = aggregateEntryActivity(entries);
    // then
    expect(result.get('a')).toEqual({ count: 2, lastTimestamp: null });
  });

  it('should keep a later timestamp even when it arrives after an empty one', () => {
    // given
    const entries = [
      { userId: 'a' },
      { userId: 'a', timestamp: '2026-05-05T00:00:00.000Z' },
    ];
    // when
    const result = aggregateEntryActivity(entries);
    // then
    expect(result.get('a')?.lastTimestamp).toBe('2026-05-05T00:00:00.000Z');
  });

  it('should only aggregate the allowed user ids when onlyUserIds is given', () => {
    // given
    const entries = [
      { userId: 'anon-1', timestamp: '2026-01-01T08:00:00.000Z' },
      { userId: 'named-1', timestamp: '2026-01-02T08:00:00.000Z' },
    ];
    // when
    const result = aggregateEntryActivity(entries, new Set(['anon-1']));
    // then
    expect(result.size).toBe(1);
    expect(result.has('anon-1')).toBe(true);
    expect(result.has('named-1')).toBe(false);
  });

  it('should accumulate across calls when an existing map is passed as `into`', () => {
    // given a first page already folded into a map
    const acc = aggregateEntryActivity([
      { userId: 'a', timestamp: '2026-01-01T08:00:00.000Z' },
    ]);
    // when a second page is folded into the same map
    const result = aggregateEntryActivity(
      [
        { userId: 'a', timestamp: '2026-03-01T08:00:00.000Z' },
        { userId: 'b', timestamp: '2026-02-01T08:00:00.000Z' },
      ],
      undefined,
      acc
    );
    // then counts sum and the latest timestamp wins across pages
    expect(result).toBe(acc);
    expect(result.get('a')).toEqual({
      count: 2,
      lastTimestamp: '2026-03-01T08:00:00.000Z',
    });
    expect(result.get('b')?.count).toBe(1);
  });

  it('should produce an ISO last timestamp that compares correctly against a date-only cutoff', () => {
    // given
    const entries = [{ userId: 'a', timestamp: '2026-06-23T05:00:00.000Z' }];
    // when
    const last = aggregateEntryActivity(entries).get('a')?.lastTimestamp ?? '';
    // then — same-day activity counts as active (>= cutoff), earlier day does not
    expect(last >= '2026-06-23').toBe(true);
    expect(last >= '2026-06-24').toBe(false);
  });
});

describe('nextActivityAggregate', () => {
  it('should seed a fresh aggregate on the first create', () => {
    // given no existing aggregate
    // when a first entry is created
    const { aggregate, needsRecompute } = nextActivityAggregate(null, null, {
      timestamp: '2026-03-01T08:00:00.000Z',
    });
    // then
    expect(aggregate).toEqual({
      entryCount: 1,
      lastEntry: '2026-03-01T08:00:00.000Z',
    });
    expect(needsRecompute).toBe(false);
  });

  it('should bump count and lastEntry when a newer entry is created', () => {
    // given
    const current = { entryCount: 2, lastEntry: '2026-03-01T08:00:00.000Z' };
    // when
    const { aggregate, needsRecompute } = nextActivityAggregate(current, null, {
      timestamp: '2026-05-01T08:00:00.000Z',
    });
    // then
    expect(aggregate).toEqual({
      entryCount: 3,
      lastEntry: '2026-05-01T08:00:00.000Z',
    });
    expect(needsRecompute).toBe(false);
  });

  it('should keep lastEntry when a create is older than the current max', () => {
    // given
    const current = { entryCount: 1, lastEntry: '2026-05-01T08:00:00.000Z' };
    // when
    const { aggregate } = nextActivityAggregate(current, null, {
      timestamp: '2026-01-01T08:00:00.000Z',
    });
    // then
    expect(aggregate).toEqual({
      entryCount: 2,
      lastEntry: '2026-05-01T08:00:00.000Z',
    });
  });

  it('should decrement without recompute when a non-max entry is deleted', () => {
    // given
    const current = { entryCount: 3, lastEntry: '2026-05-01T08:00:00.000Z' };
    // when an older entry is deleted
    const { aggregate, needsRecompute } = nextActivityAggregate(
      current,
      { timestamp: '2026-01-01T08:00:00.000Z' },
      null
    );
    // then
    expect(aggregate).toEqual({
      entryCount: 2,
      lastEntry: '2026-05-01T08:00:00.000Z',
    });
    expect(needsRecompute).toBe(false);
  });

  it('should signal recompute when the max entry is deleted', () => {
    // given
    const current = { entryCount: 2, lastEntry: '2026-05-01T08:00:00.000Z' };
    // when the latest entry is deleted
    const { aggregate, needsRecompute } = nextActivityAggregate(
      current,
      { timestamp: '2026-05-01T08:00:00.000Z' },
      null
    );
    // then — count drops, lastEntry is stale until the caller recomputes
    expect(aggregate.entryCount).toBe(1);
    expect(needsRecompute).toBe(true);
  });

  it('should not signal recompute on a same-timestamp update', () => {
    // given
    const current = { entryCount: 1, lastEntry: '2026-05-01T08:00:00.000Z' };
    // when an entry is updated without changing its timestamp
    const { aggregate, needsRecompute } = nextActivityAggregate(
      current,
      { timestamp: '2026-05-01T08:00:00.000Z' },
      { timestamp: '2026-05-01T08:00:00.000Z' }
    );
    // then count is unchanged and no recompute is needed
    expect(aggregate.entryCount).toBe(1);
    expect(needsRecompute).toBe(false);
  });

  it('should signal recompute when the max entry is moved to an earlier time', () => {
    // given
    const current = { entryCount: 2, lastEntry: '2026-05-01T08:00:00.000Z' };
    // when the max entry's timestamp moves earlier
    const { needsRecompute } = nextActivityAggregate(
      current,
      { timestamp: '2026-05-01T08:00:00.000Z' },
      { timestamp: '2026-02-01T08:00:00.000Z' }
    );
    // then
    expect(needsRecompute).toBe(true);
  });

  it('should re-establish the max without recompute when an update moves later', () => {
    // given
    const current = { entryCount: 2, lastEntry: '2026-05-01T08:00:00.000Z' };
    // when the max entry moves to an even later time
    const { aggregate, needsRecompute } = nextActivityAggregate(
      current,
      { timestamp: '2026-05-01T08:00:00.000Z' },
      { timestamp: '2026-06-01T08:00:00.000Z' }
    );
    // then
    expect(aggregate).toEqual({
      entryCount: 2,
      lastEntry: '2026-06-01T08:00:00.000Z',
    });
    expect(needsRecompute).toBe(false);
  });

  it('should never drive entryCount below zero', () => {
    // given a (corrupt) empty aggregate
    const current = { entryCount: 0, lastEntry: null };
    // when a delete arrives with nothing to remove
    const { aggregate } = nextActivityAggregate(
      current,
      { timestamp: '2026-05-01T08:00:00.000Z' },
      null
    );
    // then
    expect(aggregate.entryCount).toBe(0);
  });
});
