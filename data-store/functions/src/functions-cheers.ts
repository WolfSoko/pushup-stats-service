import { Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import {
  cheerId,
  cheerRejection,
  friendshipId,
  isValidFriendUid,
  type Cheer,
  type Friendship,
} from '@pu-stats/models';

import { requireUid } from './callable-auth';
import { berlinDateParts } from './datetime';
import { db } from './firebase-app';
import { buildFriendPushPayload, friendPushOptions } from './friends';
import { deliverPushToUser, readPushRecipients } from './push/deliver-user';
import { configureWebPush, VAPID_SECRETS } from './push/vapid';

/** A cheer matters today; the TTL policy on `expiresAt` drops it after. */
const CHEER_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * "Keep going" from one friend to another: one document per day and
 * pair, and one push to the recipient. Server-side because the cheer
 * count shows on the friends board, and because only a confirmed friend
 * may ring someone's phone.
 */
export const sendCheer = onCall(
  { region: 'europe-west3', timeoutSeconds: 30, secrets: VAPID_SECRETS },
  async (request) => {
    const uid = requireUid(request.auth);
    const target = request.data?.uid as unknown;
    if (!isValidFriendUid(target)) return { ok: false, reason: 'invalid' };

    const day = berlinDateParts().isoDate;
    const id = cheerId(uid, target, day);
    const [friendship, existing] = await Promise.all([
      db.collection('friendships').doc(friendshipId(uid, target)).get(),
      db.collection('cheers').doc(id).get(),
    ]);
    const rejection = cheerRejection({
      from: uid,
      to: target,
      isFriend:
        (friendship.data() as Friendship | undefined)?.status === 'accepted',
      alreadyToday: existing.exists,
    });
    if (rejection) return { ok: false, reason: rejection };

    const nowMs = Date.now();
    const cheer: Cheer = {
      from: uid,
      to: target,
      day,
      createdAt: new Date(nowMs).toISOString(),
    };
    // `create`: a second tap racing this one finds the document and is
    // refused instead of sending a second push.
    try {
      await db
        .collection('cheers')
        .doc(id)
        .create({
          ...cheer,
          expiresAt: Timestamp.fromMillis(nowMs + CHEER_RETENTION_MS),
        });
    } catch (err: unknown) {
      const code = (err as { code?: number | string }).code;
      if (code === 6 || code === 'already-exists') {
        return { ok: false, reason: 'already' };
      }
      throw err;
    }

    if (configureWebPush()) {
      const recipients = await readPushRecipients([uid, target]);
      await deliverPushToUser(
        target,
        buildFriendPushPayload({
          kind: 'cheer',
          locale: recipients.get(target)?.locale ?? 'de',
          actorName: recipients.get(uid)?.displayName ?? null,
        }),
        friendPushOptions('cheer'),
        'sendCheer'
      );
    }

    logger.info('sendCheer', { uid, target, day });
    return { ok: true };
  }
);
