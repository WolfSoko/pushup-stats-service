import { getAuth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  friendshipId,
  isValidFriendUid,
  newFriendship,
  type Friendship,
} from '@pu-stats/models';

import { db, DEMO_USER_ID } from './firebase-app';
import {
  friendLists,
  requestRejection,
  respondRejection,
  type FriendshipDoc,
} from './friends';

/**
 * Friendships — mutual, and therefore the thing that unlocks the
 * `friends` visibility tier on a profile.
 *
 * Every write goes through these callables: the status decides what the
 * other side may see, so `friendships` is Admin-SDK-only in
 * `firestore.rules`. Clients read their own records directly.
 */

const COLLECTION = 'friendships';

function requireUid(auth: { uid?: string } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
  }
  return auth.uid;
}

/** Every friendship document `uid` is part of. */
async function readFriendships(uid: string): Promise<FriendshipDoc[]> {
  const snap = await db
    .collection(COLLECTION)
    .where('users', 'array-contains', uid)
    .get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Friendship),
  }));
}

export const sendFriendRequest = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    const uid = requireUid(request.auth);
    const target = request.data?.uid as unknown;

    const docs = await readFriendships(uid);
    const existing = isValidFriendUid(target)
      ? docs.find((doc) => doc.id === friendshipId(uid, target))
      : undefined;
    const rejection = requestRejection({
      requester: uid,
      target,
      existing,
      requesterFriendCount: docs.filter((d) => d.status === 'accepted').length,
    });
    if (rejection) return { ok: false, reason: rejection };

    const targetUid = target as string;
    if (targetUid === DEMO_USER_ID) return { ok: false, reason: 'invalid' };
    const user = await getAuth()
      .getUser(targetUid)
      .catch(() => null);
    if (!user) return { ok: false, reason: 'invalid' };

    const id = friendshipId(uid, targetUid);
    const friendship = newFriendship(uid, targetUid, new Date().toISOString());
    // `create` rather than `set`: a declined record the *target* wrote must
    // not be silently replaced, and a concurrent duplicate request loses
    // here instead of overwriting the first one's state.
    await db
      .collection(COLLECTION)
      .doc(id)
      .create(friendship)
      .catch(async (err: unknown) => {
        const code = (err as { code?: number | string }).code;
        // ALREADY_EXISTS — the pair gained a record between our read and
        // this write; the other side's request wins.
        if (code === 6 || code === 'already-exists') return;
        throw err;
      });

    logger.info('sendFriendRequest', { uid, target: targetUid });
    return { ok: true, id };
  }
);

export const respondFriendRequest = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    const uid = requireUid(request.auth);
    const id = request.data?.id as unknown;
    const accept = request.data?.accept === true;
    if (typeof id !== 'string' || id === '') {
      throw new HttpsError('invalid-argument', 'id fehlt.');
    }

    const ref = db.collection(COLLECTION).doc(id);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const doc = snap.exists
        ? ({ id, ...(snap.data() as Friendship) } as FriendshipDoc)
        : undefined;
      const rejection = respondRejection(doc, uid);
      if (rejection) return { ok: false as const, reason: rejection };
      tx.update(ref, {
        status: accept ? 'accepted' : 'declined',
        respondedAt: new Date().toISOString(),
      });
      return { ok: true as const, accepted: accept };
    });

    logger.info('respondFriendRequest', { uid, id, ...result });
    return result;
  }
);

/**
 * Ends a friendship, from either side and without asking the other.
 *
 * The record is deleted rather than marked: a removal is not a "no" that
 * should block a future request, and keeping a tombstone of every ended
 * friendship would be a list neither side asked for.
 */
export const removeFriend = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    const uid = requireUid(request.auth);
    const id = request.data?.id as unknown;
    if (typeof id !== 'string' || id === '') {
      throw new HttpsError('invalid-argument', 'id fehlt.');
    }

    const ref = db.collection(COLLECTION).doc(id);
    const removed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      const users = (snap.data() as Friendship).users ?? [];
      if (!users.includes(uid)) return false;
      tx.delete(ref);
      return true;
    });

    logger.info('removeFriend', { uid, id, removed });
    return { ok: removed };
  }
);

/**
 * The friends screen in one call: confirmed friends, requests to answer,
 * requests waiting on someone else — each with the display name the other
 * user's config carries, so the client needs no second round of lookups
 * (and no read access to other users' configs).
 */
export const listFriends = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    const uid = requireUid(request.auth);
    const lists = friendLists(await readFriendships(uid), uid);

    const uids = [
      ...new Set(
        [...lists.friends, ...lists.incoming, ...lists.outgoing].map(
          (entry) => entry.uid
        )
      ),
    ];
    const names = new Map<string, string>();
    if (uids.length > 0) {
      const col = db.collection('userConfigs');
      const snaps = await db.getAll(...uids.map((id) => col.doc(id)));
      for (const snap of snaps) {
        const name = String(snap.data()?.['displayName'] ?? '').trim();
        if (name) names.set(snap.id, name);
      }
    }

    const withNames = (entries: typeof lists.friends) =>
      entries.map((entry) => ({
        ...entry,
        displayName: names.get(entry.uid) ?? null,
      }));

    return {
      friends: withNames(lists.friends),
      incoming: withNames(lists.incoming),
      outgoing: withNames(lists.outgoing),
    };
  }
);
