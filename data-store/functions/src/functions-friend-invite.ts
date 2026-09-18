import { randomBytes } from 'node:crypto';

import { getAuth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { friendshipId, newFriendship, type Friendship } from '@pu-stats/models';

import { requireUid } from './callable-auth';
import { db, DEMO_USER_ID } from './firebase-app';
import { inviteRejection, type FriendshipDoc } from './friends';
import {
  acceptedCount,
  FRIENDSHIPS_COLLECTION,
  readFriendships,
} from './friends/friendships-read';
import {
  inviteExpiryMs,
  inviteTokenRejection,
  isValidInviteToken,
  type FriendInviteRecord,
} from './friends/invites';

/**
 * The invite link, in two halves: minting a token and redeeming one.
 *
 * Sharing the link is the invitation, so redeeming it opens the
 * friendship as a request *from the inviter* and the other side only has
 * to accept. What makes that safe is the token — see `friends/invites.ts`
 * for why the inviter's uid could not play that role.
 */

const INVITES_COLLECTION = 'friendInvites';
const REGION = 'europe-west3';

/**
 * Guests are not people anyone agreed to train with, and their account
 * disappears on sign-out. `requireUid` admits them, so both halves say so
 * explicitly — the claiming one especially, since it runs off a hook
 * rather than a button.
 */
function isAnonymous(request: CallableRequest): boolean {
  return request.auth?.token.firebase?.sign_in_provider === 'anonymous';
}

/**
 * The caller's invite token, minted on first use and reused afterwards so
 * a link already sitting in somebody's chat keeps working. Every call
 * pushes the expiry out again: a link the owner is still handing around
 * is a link they still mean.
 */
export const createFriendInvite = onCall(
  { region: REGION, timeoutSeconds: 30 },
  async (request) => {
    const uid = requireUid(request.auth);
    if (isAnonymous(request)) return { ok: false, reason: 'anonymous' };

    const expiresAtMs = inviteExpiryMs(Date.now());
    const existing = await db
      .collection(INVITES_COLLECTION)
      .where('uid', '==', uid)
      .limit(1)
      .get();

    if (!existing.empty) {
      const doc = existing.docs[0];
      await doc.ref.update({ expiresAtMs, expiresAt: new Date(expiresAtMs) });
      return { ok: true, token: doc.id };
    }

    const token = randomBytes(24).toString('base64url');
    await db
      .collection(INVITES_COLLECTION)
      .doc(token)
      .create({
        uid,
        createdAt: new Date().toISOString(),
        expiresAtMs,
        // Mirrored as a Date for the Firestore TTL policy, which needs a
        // timestamp field; `expiresAtMs` is what the code compares.
        expiresAt: new Date(expiresAtMs),
      });

    logger.info('createFriendInvite', { uid });
    return { ok: true, token };
  }
);

/**
 * Redeems an invite token into a pending request from whoever minted it.
 *
 * The inviter is the requester, so their friend cap and a request they
 * previously declined both still apply.
 */
export const claimFriendInvite = onCall(
  { region: REGION, timeoutSeconds: 30 },
  async (request) => {
    const uid = requireUid(request.auth);
    if (isAnonymous(request)) return { ok: false, reason: 'anonymous' };

    const token = request.data?.token as unknown;
    if (!isValidInviteToken(token)) return { ok: false, reason: 'invalid' };

    const snap = await db.collection(INVITES_COLLECTION).doc(token).get();
    const data = snap.data();
    const record: FriendInviteRecord | undefined = data
      ? {
          uid: String(data['uid'] ?? ''),
          expiresAtMs: Number(data['expiresAtMs']),
        }
      : undefined;

    const tokenRejection = inviteTokenRejection({ record, nowMs: Date.now() });
    if (tokenRejection || !record) {
      return { ok: false, reason: tokenRejection ?? 'invalid' };
    }

    const inviter = record.uid;
    if (inviter === DEMO_USER_ID) return { ok: false, reason: 'invalid' };

    const user = await getAuth()
      .getUser(inviter)
      .catch(() => null);
    if (!user) return { ok: false, reason: 'invalid' };

    const inviterFriendCount = acceptedCount(await readFriendships(inviter));
    const id = friendshipId(inviter, uid);
    const ref = db.collection(FRIENDSHIPS_COLLECTION).doc(id);

    // In a transaction rather than a `create` whose `ALREADY_EXISTS` gets
    // swallowed: that told the caller the invite had landed while the
    // stored record sat untouched. `set` is deliberate — the one case
    // `inviteRejection` lets through with a record present is a decline
    // the *invitee* wrote, and the inviter asking on their own initiative
    // is allowed to replace it.
    const result = await db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      const existing = current.exists
        ? ({ id, ...(current.data() as Friendship) } as FriendshipDoc)
        : undefined;
      const rejection = inviteRejection({
        inviter,
        invitee: uid,
        existing,
        inviterFriendCount,
      });
      if (rejection) return { ok: false as const, reason: rejection };
      tx.set(ref, newFriendship(inviter, uid, new Date().toISOString()));
      return { ok: true as const, id };
    });

    logger.info('claimFriendInvite', { uid, inviter, ok: result.ok });
    return result;
  }
);
