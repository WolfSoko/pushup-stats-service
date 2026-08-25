/**
 * Admin bulk-delete of a user's exercise entries — payload validation plus the
 * ownership-checked delete itself. Split out of `user-entries.ts` (list/update
 * payload validation) to keep both files under the repo's per-file LOC
 * guideline; the callable in `functions-admin-user-entries.ts` stays a thin
 * auth/validate/log wrapper around `deleteOwnedEntries`.
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { batchArray } from './logic';

/**
 * Upper bound for a single `adminDeleteUserEntries` call. Kept at the
 * historical value the admin client chunks against; the delete itself splits
 * the work further (see {@link COMMIT_CHUNK_SIZE}).
 */
export const MAX_DELETE_ENTRY_IDS = 500;

/**
 * Documents per `getAll` round-trip. Matches `readUserActivity`'s chunking —
 * one `BatchGetDocuments` per few hundred refs keeps the RPC well inside
 * Firestore's request-size limit.
 */
export const READ_CHUNK_SIZE = 300;

/**
 * Deletes per `WriteBatch` commit. Firestore rejects a batch above 500
 * operations, so a full {@link MAX_DELETE_ENTRY_IDS} request must not be
 * committed as one batch that sits exactly on the limit.
 */
export const COMMIT_CHUNK_SIZE = 400;

/**
 * Validates the `adminDeleteUserEntries` payload: a non-empty `uid` and a
 * non-empty array of `entryIds` (non-empty strings), capped at
 * {@link MAX_DELETE_ENTRY_IDS}.
 */
export function validateDeleteUserEntriesPayload(
  data: unknown
):
  | { valid: true; uid: string; entryIds: string[] }
  | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'payload must be an object' };
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.uid !== 'string' || obj.uid.trim().length === 0) {
    return { valid: false, error: 'uid missing or empty' };
  }
  if (!Array.isArray(obj.entryIds) || obj.entryIds.length === 0) {
    return { valid: false, error: 'entryIds must be a non-empty array' };
  }
  if (obj.entryIds.length > MAX_DELETE_ENTRY_IDS) {
    return {
      valid: false,
      error: `entryIds must not exceed ${MAX_DELETE_ENTRY_IDS}`,
    };
  }
  const entryIds: string[] = [];
  for (const id of obj.entryIds) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      return { valid: false, error: 'entryIds must contain non-empty strings' };
    }
    entryIds.push(id.trim());
  }

  return { valid: true, uid: obj.uid.trim(), entryIds };
}

export interface DeleteEntriesResult {
  deleted: number;
  skipped: number;
}

/**
 * Deletes the given entry ids from `collectionPath`, but only those that
 * actually belong to `uid`. A stale or foreign id is counted as `skipped`
 * rather than aborting the request, mirroring
 * `adminBulkDeleteInactiveAnonymous`'s `{ deleted, skipped }` shape.
 *
 * Reads and writes are chunked independently: ownership is re-checked via
 * `getAll` in {@link READ_CHUNK_SIZE} batches, deletions commit in
 * {@link COMMIT_CHUNK_SIZE} batches. Commits are therefore not atomic across
 * chunks — a mid-run failure leaves earlier chunks deleted, which is the same
 * partial-progress contract the admin client already handles when it splits a
 * large selection across calls.
 */
export async function deleteOwnedEntries(
  db: Firestore,
  collectionPath: string,
  uid: string,
  entryIds: string[]
): Promise<DeleteEntriesResult> {
  const collection = db.collection(collectionPath);
  const owned: DocumentReference[] = [];
  let skipped = 0;

  for (const idChunk of batchArray(entryIds, READ_CHUNK_SIZE)) {
    const snaps = await db.getAll(...idChunk.map((id) => collection.doc(id)));
    for (const snap of snaps) {
      if (snap.exists && snap.data()?.userId === uid) {
        owned.push(snap.ref);
      } else {
        skipped++;
      }
    }
  }

  let deleted = 0;
  for (const refChunk of batchArray(owned, COMMIT_CHUNK_SIZE)) {
    const batch = db.batch();
    for (const ref of refChunk) {
      batch.delete(ref);
    }
    await batch.commit();
    deleted += refChunk.length;
  }

  return { deleted, skipped };
}
