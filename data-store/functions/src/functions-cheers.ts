import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  cheerId,
  cheerRejection,
  friendshipId,
  isValidFriendUid,
  type Cheer,
  type Friendship,
} from '@pu-stats/models';

import { berlinDateParts } from './datetime';
import { db } from './firebase-app';
import { buildFriendPushPayload, friendPushOptions } from './friends';
import { deliverPushToUser, readPushRecipients } from './push/deliver-user';
import { configureWebPush, VAPID_SECRETS } from './push/vapid';

/**
 * "Keep going" from one friend to another: one document per day and
 * pair, and one push to the recipient. Server-side because the cheer
 * count shows on the friends board, and because only a confirmed friend
 * may ring someone's phone.
 */
export const sendCheer = onCall(
  { region: 'europe-west3', timeoutSeconds: 30, secrets: VAPID_SECRETS },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
    }
    const uid = request.auth.uid;
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

    const cheer: Cheer = {
      from: uid,
      to: target,
      day,
      createdAt: new Date().toISOString(),
    };
    // `create`: a second tap racing this one finds the document and is
    // refused instead of sending a second push.
    try {
      await db.collection('cheers').doc(id).create(cheer);
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

/** Today's cheers among a group: how many each received, and whom the viewer already cheered. */
export async function readCheersToday(
  viewerUid: string,
  uids: ReadonlyArray<string>,
  day: string
): Promise<{ received: Map<string, number>; cheeredByViewer: Set<string> }> {
  const received = new Map<string, number>();
  const cheeredByViewer = new Set<string>();
  const col = db.collection('cheers');
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
  const [byViewer, ...toGroup] = await Promise.all([
    col.where('from', '==', viewerUid).where('day', '==', day).get(),
    ...chunks.map((chunk) =>
      col.where('day', '==', day).where('to', 'in', chunk).get()
    ),
  ]);
  for (const snap of byViewer.docs) {
    cheeredByViewer.add(String(snap.data()['to']));
  }
  for (const result of toGroup) {
    for (const snap of result.docs) {
      const to = String(snap.data()['to']);
      received.set(to, (received.get(to) ?? 0) + 1);
    }
  }
  return { received, cheeredByViewer };
}
