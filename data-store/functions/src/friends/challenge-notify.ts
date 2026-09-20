import { shouldPushNotification } from '@pu-stats/models';

import { buildFriendPushPayload, friendPushOptions } from './notifications';
import { writeNotification } from '../notifications';
import { deliverPushToUser, readPushRecipients } from '../push/deliver-user';
import { configureWebPush } from '../push/vapid';

/**
 * Telling people about a challenge: the inbox entry first, the push
 * after. Split out of `functions-challenges.ts` so the callables there
 * stay about challenges and this stays about notifying.
 */

interface ChallengeInvite {
  readonly target: number;
  readonly exerciseName: string;
  readonly days: number;
}

export async function notifyChallengeInvited(
  actorUid: string,
  invited: ReadonlyArray<string>,
  challenge: ChallengeInvite
): Promise<void> {
  if (invited.length === 0) return;
  const recipients = await readPushRecipients([actorUid, ...invited]);
  const actorName = recipients.get(actorUid)?.displayName ?? null;
  const createdAt = new Date().toISOString();

  await Promise.all(
    invited.map((friend) =>
      writeNotification(
        friend,
        { type: 'challenge' },
        {
          type: 'challenge',
          createdAt,
          readAt: null,
          actorUid,
          actorName,
          url: '/freunde',
          payload: {
            target: challenge.target,
            exerciseName: challenge.exerciseName,
            days: challenge.days,
          },
        }
      )
    )
  );

  if (!configureWebPush()) return;
  const now = new Date();
  await Promise.all(
    invited
      .filter((friend) =>
        shouldPushNotification(recipients.get(friend)?.push, 'challenge', now)
      )
      .map((friend) =>
        deliverPushToUser(
          friend,
          buildFriendPushPayload({
            kind: 'challenge',
            locale: recipients.get(friend)?.locale ?? 'de',
            actorName,
            challenge,
          }),
          friendPushOptions('challenge'),
          'createChallenge'
        )
      )
  );
}

export async function notifyChallengeAccepted(
  actorUid: string,
  others: ReadonlyArray<string>
): Promise<void> {
  if (others.length === 0) return;
  const recipients = await readPushRecipients([actorUid, ...others]);
  const actorName = recipients.get(actorUid)?.displayName ?? null;
  const createdAt = new Date().toISOString();

  await Promise.all(
    others.map((participant) =>
      writeNotification(
        participant,
        { type: 'challengeAccepted' },
        {
          type: 'challengeAccepted',
          createdAt,
          readAt: null,
          actorUid,
          actorName,
          url: '/freunde',
        }
      )
    )
  );

  if (!configureWebPush()) return;
  const now = new Date();
  await Promise.all(
    others
      .filter((participant) =>
        shouldPushNotification(
          recipients.get(participant)?.push,
          'challengeAccepted',
          now
        )
      )
      .map((participant) =>
        deliverPushToUser(
          participant,
          buildFriendPushPayload({
            kind: 'challengeAccepted',
            locale: recipients.get(participant)?.locale ?? 'de',
            actorName,
          }),
          friendPushOptions('challengeAccepted'),
          'respondChallenge'
        )
      )
  );
}
