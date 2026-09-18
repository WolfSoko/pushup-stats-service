import { getAuth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  friendshipId,
  isValidFriendUid,
  newFriendship,
  type Friendship,
} from '@pu-stats/models';

import { requireUid } from './callable-auth';
import { db, DEMO_USER_ID } from './firebase-app';
import {
  friendLists,
  requestRejection,
  respondRejection,
  withProfiles,
  type FriendshipDoc,
} from './friends';
import { readFriendPhotoUrls } from './friends/photos-read';
import { displayNames, readUserConfigs } from './user-config-read';

/**
 * Friendships — mutual, and therefore the thing that unlocks the
 * `friends` visibility tier on a profile.
 *
 * Every write goes through these callables: the status decides what the
 * other side may see, so `friendships` is Admin-SDK-only in
 * `firestore.rules`. Clients read their own records directly.
 */

const COLLECTION = 'friendships';

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
 *
 * Only the confirmed friends carry an avatar. A pending request is not
 * yet an audience anyone agreed to, and a picture is exactly the kind of
 * thing a stranger's request should not hand out.
 */
export const listFriends = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    const uid = requireUid(request.auth);
    const lists = friendLists(await readFriendships(uid), uid);

    const configs = await readUserConfigs(
      [...lists.friends, ...lists.incoming, ...lists.outgoing].map(
        (entry) => entry.uid
      )
    );
    const photos = await readFriendPhotoUrls(
      new Map(lists.friends.map((entry) => [entry.uid, configs.get(entry.uid)]))
    );

    return withProfiles(lists, displayNames(configs), photos);
  }
);
