import { shouldPushNotification, type Friendship } from '@pu-stats/models';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import {
  buildFriendPushPayload,
  friendPushOptions,
  friendshipPushEvent,
} from './friends';
import { writeNotification } from './notifications';
import { deliverPushToUser, readPushRecipients } from './push/deliver-user';
import { configureWebPush, VAPID_SECRETS } from './push/vapid';

/**
 * Tells people what happened to their friendships while the app was
 * closed: a new request, or a request of theirs that was accepted.
 *
 * A trigger rather than a call from the callables so the referral flow —
 * which creates a request on its own — is covered without knowing about
 * push.
 */
export const notifyFriendshipWrite = onDocumentWritten(
  {
    document: 'friendships/{friendshipId}',
    region: 'europe-west3',
    secrets: VAPID_SECRETS,
  },
  async (event) => {
    const before = event.data?.before?.data() as Friendship | undefined;
    const after = event.data?.after?.data() as Friendship | undefined;
    const push = friendshipPushEvent(before, after);
    if (!push) return;

    const recipients = await readPushRecipients([push.to, push.from]);
    const type = push.kind === 'request' ? 'friendRequest' : 'friendAccepted';
    await writeNotification(
      push.to,
      { type, actorUid: push.from },
      {
        type,
        createdAt: new Date().toISOString(),
        readAt: null,
        actorUid: push.from,
        actorName: recipients.get(push.from)?.displayName ?? null,
        url: '/freunde',
      }
    );

    // Filed first, on purpose: without VAPID there is no push at all, and
    // that is precisely when the inbox has to carry the event.
    if (!configureWebPush()) {
      logger.warn('notifyFriendshipWrite: VAPID secrets not set, skipping');
      return;
    }
    if (
      !shouldPushNotification(recipients.get(push.to)?.push, type, new Date())
    ) {
      logger.info('notifyFriendshipWrite: push suppressed', { to: push.to });
      return;
    }

    const payload = buildFriendPushPayload({
      kind: push.kind,
      locale: recipients.get(push.to)?.locale ?? 'de',
      actorName: recipients.get(push.from)?.displayName ?? null,
    });
    const { sent } = await deliverPushToUser(
      push.to,
      payload,
      friendPushOptions(push.kind),
      'notifyFriendshipWrite'
    );
    logger.info('notifyFriendshipWrite', {
      kind: push.kind,
      to: push.to,
      sent,
    });
  }
);
