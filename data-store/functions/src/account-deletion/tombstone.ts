import { type Firestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Marker that a uid's data is being (or has been) purged.
 *
 * Deleting a user's entries fires the entry triggers once per entry. Left
 * alone they would archive every entry into the trash bin, write zeroed
 * `userStats` aggregates and rebuild the leaderboards thousands of times —
 * re-creating exactly the data the purge just removed. The triggers read
 * this marker on a delete and stand down instead.
 *
 * The marker holds nothing but the uid (as its id) and expires through a
 * TTL policy on `expiresAt`: by then every trigger of the purge has long run.
 */
export const DELETED_ACCOUNTS_COLLECTION = 'deletedAccounts';

export const TOMBSTONE_RETENTION_DAYS = 30;

const TOMBSTONE_RETENTION_MS = TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export async function markAccountDeleted(
  db: Firestore,
  uid: string,
  nowMs: number
): Promise<void> {
  await db
    .collection(DELETED_ACCOUNTS_COLLECTION)
    .doc(uid)
    .set({
      deletedAt: Timestamp.fromMillis(nowMs),
      expiresAt: Timestamp.fromMillis(nowMs + TOMBSTONE_RETENTION_MS),
    });
}

/**
 * Whether an entry-trigger event is one of the deletions of an account
 * purge. Only deletions are checked, so an ordinary entry write never pays
 * for the extra read.
 */
export async function isPurgedEntryDeletion(
  db: Firestore,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): Promise<boolean> {
  if (after !== undefined || before === undefined) return false;
  const userId = before['userId'];
  if (typeof userId !== 'string' || !userId) return false;
  const snap = await db
    .collection(DELETED_ACCOUNTS_COLLECTION)
    .doc(userId)
    .get();
  return snap.exists;
}
