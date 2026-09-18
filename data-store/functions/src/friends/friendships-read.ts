import type { Friendship } from '@pu-stats/models';

import { db } from '../firebase-app';
import type { FriendshipDoc } from './logic';

/**
 * Firestore side of the friendship records. Not in the `./friends`
 * barrel, so the pure modules and their tests stay free of the Admin SDK
 * — same split as `photos-read.ts`.
 */
export const FRIENDSHIPS_COLLECTION = 'friendships';

/** Every friendship document `uid` is part of. */
export async function readFriendships(uid: string): Promise<FriendshipDoc[]> {
  const snap = await db
    .collection(FRIENDSHIPS_COLLECTION)
    .where('users', 'array-contains', uid)
    .get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Friendship),
  }));
}

/** Confirmed friendships in `docs` — what the requester's cap counts. */
export function acceptedCount(docs: ReadonlyArray<FriendshipDoc>): number {
  return docs.filter((doc) => doc.status === 'accepted').length;
}
