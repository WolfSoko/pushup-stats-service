import type { Firestore, Query } from 'firebase-admin/firestore';

import { userPhotoPrefix } from '../profile/photo-storage';
import {
  ANONYMIZED_QUERIES,
  challengeWithoutUser,
  OWNED_QUERIES,
  UID_KEYED_COLLECTIONS,
} from './plan';
import { markAccountDeleted } from './tombstone';

/** Documents per page/commit; Firestore caps a batch at 500 writes. */
export const PURGE_PAGE_SIZE = 400;

export interface PhotoBucket {
  deleteFiles(options: { prefix: string }): Promise<unknown>;
}

export interface PurgeDeps {
  readonly db: Firestore;
  readonly photoBucket: PhotoBucket;
  readonly nowMs: number;
}

export interface PurgeResult {
  readonly deletedDocs: number;
  readonly anonymizedDocs: number;
  readonly updatedChallenges: number;
}

/**
 * Deletes a query's matches page by page. Re-queries after each commit
 * instead of paging with a cursor: the committed documents no longer match,
 * so the next page is simply the next `limit`.
 */
async function deleteMatches(db: Firestore, query: Query): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snap = await query.limit(PURGE_PAGE_SIZE).get();
    if (snap.empty) return deleted;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    deleted += snap.size;
    if (snap.size < PURGE_PAGE_SIZE) return deleted;
  }
}

async function anonymizeMatches(
  db: Firestore,
  query: Query,
  patch: Readonly<Record<string, null>>
): Promise<number> {
  let updated = 0;
  for (;;) {
    const snap = await query.limit(PURGE_PAGE_SIZE).get();
    if (snap.empty) return updated;
    const batch = db.batch();
    for (const doc of snap.docs) batch.update(doc.ref, { ...patch });
    await batch.commit();
    updated += snap.size;
    if (snap.size < PURGE_PAGE_SIZE) return updated;
  }
}

async function removeFromChallenges(
  db: Firestore,
  uid: string
): Promise<number> {
  const col = db.collection('challenges');
  const [asParticipant, asInvitee] = await Promise.all([
    col.where('participants', 'array-contains', uid).get(),
    col.where('invited', 'array-contains', uid).get(),
  ]);
  const docs = new Map(
    [...asParticipant.docs, ...asInvitee.docs].map((d) => [d.id, d])
  );
  for (const doc of docs.values()) {
    const removal = challengeWithoutUser(doc.data(), uid);
    if (removal.kind === 'delete') await doc.ref.delete();
    if (removal.kind === 'update') {
      await doc.ref.update({
        participants: removal.participants,
        invited: removal.invited,
      });
    }
  }
  return docs.size;
}

/**
 * Removes everything stored about `uid`: Firestore documents, the
 * profile photo, and the user's traces in shared documents (friendships,
 * challenges, cheers). Reports they sent are kept but anonymized.
 *
 * Idempotent — every step deletes what still matches — so a retried or
 * repeated run finishes what an interrupted one started.
 *
 * Not covered: inbox entries in *other* users' inboxes that name this user
 * as the actor. They carry only a display name and expire through the
 * inbox TTL policy.
 */
export async function purgeUserData(
  deps: PurgeDeps,
  uid: string
): Promise<PurgeResult> {
  const { db } = deps;
  if (!uid) throw new Error('purgeUserData: uid is required');

  await markAccountDeleted(db, uid, deps.nowMs);

  let deletedDocs = 0;
  for (const { collection, field, op } of OWNED_QUERIES) {
    deletedDocs += await deleteMatches(
      db,
      db.collection(collection).where(field, op, uid)
    );
  }

  const updatedChallenges = await removeFromChallenges(db, uid);

  let anonymizedDocs = 0;
  for (const { collection, patch } of ANONYMIZED_QUERIES) {
    anonymizedDocs += await anonymizeMatches(
      db,
      db.collection(collection).where('userId', '==', uid),
      patch
    );
  }

  await deps.photoBucket.deleteFiles({ prefix: userPhotoPrefix(uid) });

  for (const collection of UID_KEYED_COLLECTIONS) {
    await db.recursiveDelete(db.collection(collection).doc(uid));
  }

  return { deletedDocs, anonymizedDocs, updatedChallenges };
}
