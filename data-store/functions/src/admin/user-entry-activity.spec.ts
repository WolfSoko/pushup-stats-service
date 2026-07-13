import { describe, it, expect } from '@jest/globals';
import { aggregateEntryActivity } from './user-entry-activity';

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
