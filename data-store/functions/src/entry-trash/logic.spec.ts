import { describe, expect, it } from '@jest/globals';
import {
  buildTrashRecord,
  TRASH_COLLECTION,
  TRASH_RETENTION_DAYS,
  TRASH_RETENTION_MS,
} from './logic';

describe('buildTrashRecord', () => {
  const deletedAtMs = Date.UTC(2026, 7, 13, 10, 0, 0);
  const entry = {
    userId: 'u1',
    exerciseId: 'pushup',
    reps: 20,
    timestamp: '2026-08-13T12:00+02:00',
    source: 'web',
  };

  it('should keep the deleted document verbatim under `entry`', () => {
    // given a deleted entry document
    // when it is archived
    const record = buildTrashRecord('e1', entry, deletedAtMs);

    // then the original data survives unchanged, keyed by its entry id
    expect(record.entryId).toBe('e1');
    expect(record.entry).toEqual(entry);
  });

  it('should expire the record exactly 365 days after the deletion', () => {
    // given a deletion at a known instant
    // when the record is built
    const record = buildTrashRecord('e1', entry, deletedAtMs);

    // then the TTL field sits one retention window later
    expect(record.deletedAtMs).toBe(deletedAtMs);
    expect(record.expiresAtMs).toBe(deletedAtMs + TRASH_RETENTION_MS);
    expect(record.expiresAtMs - record.deletedAtMs).toBe(
      TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
  });

  it('should lift userId to the top level so deletions stay traceable per user', () => {
    // given an entry owned by a user
    // when it is archived
    const record = buildTrashRecord('e1', entry, deletedAtMs);

    // then the owner is queryable without unpacking `entry`
    expect(record.userId).toBe('u1');
  });

  it.each([
    ['missing', {}],
    ['empty', { userId: '' }],
    ['non-string', { userId: 42 }],
  ])('should fall back to a null userId when it is %s', (_case, data) => {
    // given a document without a usable userId (legacy or admin-written)
    // when it is archived
    const record = buildTrashRecord('e1', data, deletedAtMs);

    // then the record is still written, just without an owner
    expect(record.userId).toBeNull();
  });

  // The retention bookkeeping lives outside `entry` on purpose: a document
  // carrying its own `expiresAt` would otherwise overwrite the TTL field and
  // could expire the archive immediately (or never).
  it('should not let entry fields overwrite the retention bookkeeping', () => {
    // given an entry that itself carries deletedAt/expiresAt fields
    const hostile = {
      userId: 'u1',
      expiresAt: 'yesterday',
      deletedAt: 'whenever',
    };

    // when it is archived
    const record = buildTrashRecord('e1', hostile, deletedAtMs);

    // then the computed retention window wins
    expect(record.expiresAtMs).toBe(deletedAtMs + TRASH_RETENTION_MS);
    expect(record.deletedAtMs).toBe(deletedAtMs);
    expect(record.entry).toEqual(hostile);
  });

  it('should archive into the server-only trash collection', () => {
    expect(TRASH_COLLECTION).toBe('deletedExerciseEntries');
  });
});
