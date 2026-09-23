import {
  FieldPath,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

import {
  UID_KEYED_COLLECTIONS,
  UID_PREFIXED_COLLECTIONS,
  uidOfPrefixedId,
} from './plan';

const SCAN_PAGE_SIZE = 5000;

/** `getUsers` accepts at most 100 identifiers per call. */
export const AUTH_LOOKUP_CHUNK = 100;

export interface AuthLookup {
  getUsers(identifiers: { uid: string }[]): Promise<{
    notFound: unknown[];
  }>;
}

/**
 * Collects a field's values from a whole collection, paged by document id
 * and reading only that field, so memory stays O(#distinct values).
 */
async function scanField(
  db: Firestore,
  collection: string,
  field: string,
  into: Set<string>
): Promise<void> {
  let cursor: QueryDocumentSnapshot | undefined;
  for (;;) {
    let query = db
      .collection(collection)
      .select(field)
      .orderBy(FieldPath.documentId())
      .limit(SCAN_PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const doc of page.docs) {
      const value: unknown = doc.get(field);
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) if (typeof v === 'string' && v) into.add(v);
    }
    if (page.size < SCAN_PAGE_SIZE) return;
    cursor = page.docs[page.docs.length - 1];
  }
}

/**
 * Every uid that still has data somewhere. `listDocuments` also returns
 * parents that exist only because a subcollection hangs under them
 * (`pushSubscriptions/{uid}`, `notifications/{uid}`), which a plain query
 * would miss.
 */
export async function collectDataOwnerUids(db: Firestore): Promise<string[]> {
  const uids = new Set<string>();
  for (const collection of UID_KEYED_COLLECTIONS) {
    const refs = await db.collection(collection).listDocuments();
    for (const ref of refs) uids.add(ref.id);
  }
  for (const collection of UID_PREFIXED_COLLECTIONS) {
    const refs = await db.collection(collection).listDocuments();
    for (const ref of refs) uids.add(uidOfPrefixedId(ref.id));
  }
  await scanField(db, 'exerciseEntries', 'userId', uids);
  await scanField(db, 'workouts', 'ownerId', uids);
  await scanField(db, 'friendships', 'users', uids);
  return [...uids].sort();
}

/**
 * The uids among `candidates` that have no Firebase Auth account anymore:
 * data left behind by accounts deleted before the purge trigger existed.
 * `keep` is never reported, e.g. the demo user whose data is seeded
 * without an Auth account behind it.
 */
export async function findOrphanUids(
  auth: AuthLookup,
  candidates: readonly string[],
  keep: ReadonlySet<string>
): Promise<string[]> {
  const orphans: string[] = [];
  const checked = candidates.filter((uid) => !keep.has(uid));
  for (let i = 0; i < checked.length; i += AUTH_LOOKUP_CHUNK) {
    const chunk = checked.slice(i, i + AUTH_LOOKUP_CHUNK);
    const { notFound } = await auth.getUsers(chunk.map((uid) => ({ uid })));
    for (const identifier of notFound) {
      const uid = (identifier as { uid?: unknown }).uid;
      if (typeof uid === 'string') orphans.push(uid);
    }
  }
  return orphans;
}
