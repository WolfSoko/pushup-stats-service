import type { Friendship } from '@pu-stats/models';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import {
  buildFriendPushPayload,
  friendPushOptions,
  friendshipPushEvent,
} from './friends';
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
    if (!configureWebPush()) {
      logger.warn('notifyFriendshipWrite: VAPID secrets not set, skipping');
      return;
    }

    const recipients = await readPushRecipients([push.to, push.from]);
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
