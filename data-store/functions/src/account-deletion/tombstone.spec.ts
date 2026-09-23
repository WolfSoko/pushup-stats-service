import { describe, expect, it } from '@jest/globals';

import { FakeFirestore } from './fake-firestore.testing';
import {
  DELETED_ACCOUNTS_COLLECTION,
  isPurgedEntryDeletion,
  markAccountDeleted,
  TOMBSTONE_RETENTION_DAYS,
} from './tombstone';

const NOW_MS = Date.parse('2026-09-23T10:00:00Z');

describe('markAccountDeleted', () => {
  it('should write a tombstone that expires after the retention period', async () => {
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
    expect(doc.expiresAt.toMillis() - NOW_MS).toBe(
      TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
  });
});

describe('isPurgedEntryDeletion', () => {
  const purged = () =>
    new FakeFirestore()
      .seed(`${DELETED_ACCOUNTS_COLLECTION}/gone`, {})
      .asFirestore();

  it('should report the deletion of an entry of a purged account', async () => {
    // given / when / then
    await expect(
      isPurgedEntryDeletion(purged(), { userId: 'gone' }, undefined)
    ).resolves.toBe(true);
  });

  it('should not report the deletion of an entry of a live account', async () => {
    // given / when / then
    await expect(
      isPurgedEntryDeletion(purged(), { userId: 'alive' }, undefined)
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
});
