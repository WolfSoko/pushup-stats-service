import { describe, expect, it } from '@jest/globals';
import { Timestamp } from 'firebase-admin/firestore';

import { FakeFirestore } from './fake-firestore.testing';
import {
  DELETED_ACCOUNTS_COLLECTION,
  isPurgedEntryDeletion,
  markAccountDeleted,
  TOMBSTONE_ACTIVE_MS,
} from './tombstone';

const NOW_MS = Date.parse('2026-09-23T10:00:00Z');

describe('markAccountDeleted', () => {
  it('should write a tombstone that expires after the active window', async () => {
    // given
    const fake = new FakeFirestore();

    // when
    await markAccountDeleted(fake.asFirestore(), 'uid-1', NOW_MS);

    // then
    const doc = fake.docs.get(`${DELETED_ACCOUNTS_COLLECTION}/uid-1`) as {
      deletedAt: { toMillis(): number };
      expiresAt: { toMillis(): number };
    };
    expect(doc.deletedAt.toMillis()).toBe(NOW_MS);
    expect(doc.expiresAt.toMillis() - NOW_MS).toBe(TOMBSTONE_ACTIVE_MS);
  });
});

describe('isPurgedEntryDeletion', () => {
  const purged = () =>
    new FakeFirestore()
      .seed(`${DELETED_ACCOUNTS_COLLECTION}/gone`, {
        expiresAt: Timestamp.fromMillis(NOW_MS + 1000),
      })
      .asFirestore();

  it('should report the deletion of an entry of a purged account', async () => {
    // given / when / then
    await expect(
      isPurgedEntryDeletion(purged(), { userId: 'gone' }, undefined, NOW_MS)
    ).resolves.toBe(true);
  });

  it('should not report the deletion of an entry of a live account', async () => {
    // given / when / then
    await expect(
      isPurgedEntryDeletion(purged(), { userId: 'alive' }, undefined, NOW_MS)
    ).resolves.toBe(false);
  });

  it('should never report a create or an update', async () => {
    // given / when / then
    await expect(
      isPurgedEntryDeletion(purged(), undefined, { userId: 'gone' })
    ).resolves.toBe(false);
    await expect(
      isPurgedEntryDeletion(purged(), { userId: 'gone' }, { userId: 'gone' })
    ).resolves.toBe(false);
  });

  it('should not report a deleted entry without a userId', async () => {
    // given / when / then
    await expect(
      isPurgedEntryDeletion(purged(), { reps: 3 }, undefined)
    ).resolves.toBe(false);
  });

  it('should no longer report deletions once the tombstone has expired', async () => {
    // given — e.g. a deletion that failed halfway and was never retried
    // when / then the account's entry triggers work normally again
    await expect(
      isPurgedEntryDeletion(
        purged(),
        { userId: 'gone' },
        undefined,
        NOW_MS + 2000
      )
    ).resolves.toBe(false);
  });
});
