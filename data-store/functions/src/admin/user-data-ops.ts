import { db } from '../firebase-app';
import { type UserActivityAggregate } from './user-entry-activity';

// Hard-delete a user's exercise history. Post-cutover writes land in
// `exerciseEntries`, but the pushup unification migration deliberately
// left the legacy `pushups` source intact — so a full erasure must purge
// both collections, otherwise pre-cutover rows outlive the deleted uid.
// Pages through the results (`limit` + re-query) so a user with a huge
// history never materialises more than one batch of docs at a time.
export async function deleteUserExerciseData(uid: string): Promise<void> {
  const BATCH_SIZE = 500;
  for (const collection of ['exerciseEntries', 'pushups']) {
    for (;;) {
      const snap = await db
        .collection(collection)
        .where('userId', '==', uid)
        .limit(BATCH_SIZE)
        .get();
      if (snap.empty) break;
      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      if (snap.size < BATCH_SIZE) break;
    }
  }
}

// Read the precomputed `adminUserActivity/{uid}` aggregates for the given
// uids via `getAll` (fetch-by-reference, no 10-item `in`-query cap), so it
// stays O(#uids) rather than scanning the whole `exerciseEntries`
// collection. The `updateAdminUserActivityOnEntryWrite` trigger keeps the
// docs current; `backfillAdminUserActivity` seeds history.
export async function readUserActivity(
  uids: string[]
): Promise<Map<string, UserActivityAggregate>> {
  const activity = new Map<string, UserActivityAggregate>();
  if (uids.length === 0) return activity;

  const collection = db.collection('adminUserActivity');
  const CHUNK = 300;
  for (let i = 0; i < uids.length; i += CHUNK) {
    const refs = uids.slice(i, i + CHUNK).map((uid) => collection.doc(uid));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (snap.exists) {
        activity.set(snap.id, snap.data() as UserActivityAggregate);
      }
    }
  }
  return activity;
}

// Bounded source-of-truth check for whether a user has any entry on/after
// `cutoff`. Used as a fallback in the inactive-anonymous cleanup for users
// with no `adminUserActivity` aggregate yet (e.g. the window after deploy
// before `backfillAdminUserActivity` has run) so an active user is never
// deleted. Served by the (userId, timestamp) composite index.
export async function hasEntrySince(
  uid: string,
  cutoff: string
): Promise<boolean> {
  const snap = await db
    .collection('exerciseEntries')
    .where('userId', '==', uid)
    .where('timestamp', '>=', cutoff)
    .limit(1)
    .get();
  return !snap.empty;
}
