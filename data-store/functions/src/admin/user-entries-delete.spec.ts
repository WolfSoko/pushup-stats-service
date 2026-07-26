import { describe, it, expect, jest } from '@jest/globals';
import type * as admin from 'firebase-admin';
import {
  COMMIT_CHUNK_SIZE,
  deleteOwnedEntries,
  MAX_DELETE_ENTRY_IDS,
  READ_CHUNK_SIZE,
  validateDeleteUserEntriesPayload,
} from './user-entries-delete';

interface FakeDb {
  db: admin.firestore.Firestore;
  getAllCallSizes: number[];
  commitBatchSizes: number[];
  deletedIds: string[];
}

/**
 * Minimal in-memory stand-in for the Firestore handle `deleteOwnedEntries`
 * uses: `collection().doc()`, `getAll(...refs)` and `batch()`. Records the
 * per-call fan-out so the chunking can be asserted.
 */
function fakeDb(owners: Record<string, string | undefined>): FakeDb {
  const getAllCallSizes: number[] = [];
  const commitBatchSizes: number[] = [];
  const deletedIds: string[] = [];

  const doc = (id: string) => ({ id, path: `exerciseEntries/${id}` });

  const db = {
    collection: () => ({ doc }),
    getAll: (...refs: { id: string }[]) => {
      getAllCallSizes.push(refs.length);
      return Promise.resolve(
        refs.map((ref) => ({
          ref,
          exists: owners[ref.id] !== undefined,
          data: () => ({ userId: owners[ref.id] }),
        }))
      );
    },
    batch: () => {
      const staged: string[] = [];
      return {
        delete: (ref: { id: string }) => staged.push(ref.id),
        commit: () => {
          commitBatchSizes.push(staged.length);
          deletedIds.push(...staged);
          return Promise.resolve([]);
        },
      };
    },
  };

  return {
    db: db as unknown as admin.firestore.Firestore,
    getAllCallSizes,
    commitBatchSizes,
    deletedIds,
  };
}

describe('admin/user-entries-delete', () => {
  describe('validateDeleteUserEntriesPayload', () => {
    it('should accept a uid with one or more trimmed entryIds', () => {
      // given / when
      const result = validateDeleteUserEntriesPayload({
        uid: ' user-1 ',
        entryIds: [' entry-1 ', 'entry-2'],
      });

      // then
      expect(result).toEqual({
        valid: true,
        uid: 'user-1',
        entryIds: ['entry-1', 'entry-2'],
      });
    });

    it('should reject a missing or empty uid', () => {
      // given / when / then
      expect(validateDeleteUserEntriesPayload({ entryIds: ['e'] }).valid).toBe(
        false
      );
      expect(
        validateDeleteUserEntriesPayload({ uid: '  ', entryIds: ['e'] }).valid
      ).toBe(false);
      expect(validateDeleteUserEntriesPayload(null).valid).toBe(false);
    });

    it('should reject a missing, empty, or non-array entryIds', () => {
      // given / when / then
      expect(validateDeleteUserEntriesPayload({ uid: 'u' }).valid).toBe(false);
      expect(
        validateDeleteUserEntriesPayload({ uid: 'u', entryIds: [] }).valid
      ).toBe(false);
      expect(
        validateDeleteUserEntriesPayload({ uid: 'u', entryIds: 'e' }).valid
      ).toBe(false);
    });

    it('should reject entryIds exceeding the maximum batch size', () => {
      // given
      const entryIds = Array.from(
        { length: MAX_DELETE_ENTRY_IDS + 1 },
        (_, i) => `e${i}`
      );

      // when
      const result = validateDeleteUserEntriesPayload({ uid: 'u', entryIds });

      // then
      expect(result.valid).toBe(false);
    });

    it('should accept entryIds at exactly the maximum batch size', () => {
      // given
      const entryIds = Array.from(
        { length: MAX_DELETE_ENTRY_IDS },
        (_, i) => `e${i}`
      );

      // when
      const result = validateDeleteUserEntriesPayload({ uid: 'u', entryIds });

      // then
      expect(result.valid).toBe(true);
    });

    it('should reject a non-string or blank entryId in the array', () => {
      // given / when / then
      expect(
        validateDeleteUserEntriesPayload({ uid: 'u', entryIds: ['e', 42] })
          .valid
      ).toBe(false);
      expect(
        validateDeleteUserEntriesPayload({ uid: 'u', entryIds: ['e', '   '] })
          .valid
      ).toBe(false);
    });
  });

  describe('deleteOwnedEntries', () => {
    it('should delete only the entries owned by the given user', async () => {
      // given
      const { db, deletedIds } = fakeDb({
        mine1: 'user-1',
        mine2: 'user-1',
        theirs: 'user-2',
      });

      // when
      const result = await deleteOwnedEntries(db, 'exerciseEntries', 'user-1', [
        'mine1',
        'theirs',
        'mine2',
      ]);

      // then
      expect(result).toEqual({ deleted: 2, skipped: 1 });
      expect(deletedIds.sort()).toEqual(['mine1', 'mine2']);
    });

    it('should skip ids with no matching document', async () => {
      // given
      const { db, commitBatchSizes } = fakeDb({ mine: 'user-1' });

      // when
      const result = await deleteOwnedEntries(db, 'exerciseEntries', 'user-1', [
        'mine',
        'gone',
      ]);

      // then
      expect(result).toEqual({ deleted: 1, skipped: 1 });
      expect(commitBatchSizes).toEqual([1]);
    });

    it('should not commit a batch when nothing is owned', async () => {
      // given
      const { db, commitBatchSizes } = fakeDb({ theirs: 'user-2' });

      // when
      const result = await deleteOwnedEntries(db, 'exerciseEntries', 'user-1', [
        'theirs',
      ]);

      // then
      expect(result).toEqual({ deleted: 0, skipped: 1 });
      expect(commitBatchSizes).toEqual([]);
    });

    it('should chunk getAll reads so no single request exceeds the read chunk size', async () => {
      // given a full-size request, larger than one read chunk
      const entryIds = Array.from(
        { length: MAX_DELETE_ENTRY_IDS },
        (_, i) => `e${i}`
      );
      const owners = Object.fromEntries(entryIds.map((id) => [id, 'user-1']));
      const { db, getAllCallSizes } = fakeDb(owners);

      // when
      await deleteOwnedEntries(db, 'exerciseEntries', 'user-1', entryIds);

      // then
      expect(Math.max(...getAllCallSizes)).toBeLessThanOrEqual(READ_CHUNK_SIZE);
      expect(getAllCallSizes.reduce((a, b) => a + b, 0)).toBe(
        MAX_DELETE_ENTRY_IDS
      );
    });

    it('should keep every commit under the Firestore 500-write batch limit', async () => {
      // given a full-size request, all owned by the user
      const entryIds = Array.from(
        { length: MAX_DELETE_ENTRY_IDS },
        (_, i) => `e${i}`
      );
      const owners = Object.fromEntries(entryIds.map((id) => [id, 'user-1']));
      const { db, commitBatchSizes } = fakeDb(owners);

      // when
      const result = await deleteOwnedEntries(
        db,
        'exerciseEntries',
        'user-1',
        entryIds
      );

      // then
      expect(result).toEqual({ deleted: MAX_DELETE_ENTRY_IDS, skipped: 0 });
      expect(Math.max(...commitBatchSizes)).toBeLessThanOrEqual(
        COMMIT_CHUNK_SIZE
      );
      expect(Math.max(...commitBatchSizes)).toBeLessThan(500);
    });

    it('should leave earlier chunks committed when a later commit fails', async () => {
      // given a full-size request whose second commit chunk rejects
      const entryIds = Array.from(
        { length: MAX_DELETE_ENTRY_IDS },
        (_, i) => `e${i}`
      );
      const owners = Object.fromEntries(entryIds.map((id) => [id, 'user-1']));
      const { db, deletedIds } = fakeDb(owners);
      const realBatch = db.batch.bind(db);
      let commits = 0;
      jest.spyOn(db, 'batch').mockImplementation(() => {
        const batch = realBatch();
        const commit = batch.commit.bind(batch);
        batch.commit = () =>
          ++commits > 1 ? Promise.reject(new Error('UNAVAILABLE')) : commit();
        return batch;
      });

      // when
      const failure = deleteOwnedEntries(
        db,
        'exerciseEntries',
        'user-1',
        entryIds
      );

      // then the caller sees the failure, but the first chunk is already gone —
      // the admin client must reload rather than trust its local rows
      await expect(failure).rejects.toThrow('UNAVAILABLE');
      expect(deletedIds.length).toBe(COMMIT_CHUNK_SIZE);
    });

    it('should propagate a Firestore read failure to the caller', async () => {
      // given a db whose ownership read rejects
      const { db, commitBatchSizes } = fakeDb({ mine: 'user-1' });
      jest
        .spyOn(db, 'getAll')
        .mockRejectedValue(new Error('DEADLINE_EXCEEDED') as never);

      // when / then nothing is deleted — the failure happens before any commit
      await expect(
        deleteOwnedEntries(db, 'exerciseEntries', 'user-1', ['mine'])
      ).rejects.toThrow('DEADLINE_EXCEEDED');
      expect(commitBatchSizes).toEqual([]);
    });

    it('should propagate a Firestore commit failure to the caller', async () => {
      // given a db whose commit rejects
      const { db } = fakeDb({ mine: 'user-1' });
      const boom = new Error('DEADLINE_EXCEEDED');
      jest.spyOn(db, 'batch').mockReturnValue({
        delete: () => undefined,
        commit: () => Promise.reject(boom),
      } as unknown as admin.firestore.WriteBatch);

      // when / then
      await expect(
        deleteOwnedEntries(db, 'exerciseEntries', 'user-1', ['mine'])
      ).rejects.toThrow('DEADLINE_EXCEEDED');
    });
  });
});
