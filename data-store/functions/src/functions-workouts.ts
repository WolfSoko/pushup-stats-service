import { logger } from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import {
  copyWorkout,
  normalizeWorkout,
  workoutShareRejection,
  type WorkoutSource,
} from '@pu-stats/models';

import { requireUid } from './callable-auth';
import { db } from './firebase-app';
import { buildFriendPushPayload, friendPushOptions } from './friends';
import { readFriendUids } from './friends/challenges-read';
import { deliverPushToUser, readPushRecipients } from './push/deliver-user';
import { configureWebPush, VAPID_SECRETS } from './push/vapid';
import { splitByRoom } from './workouts/logic';

const WORKOUTS = 'workouts';

/**
 * Send one of the caller's workouts to confirmed friends. Each recipient
 * gets their own private copy in `workouts`, marked with where it came
 * from, and a push. Server-side because a client may only write its own
 * documents, and because only a friend may put something into someone
 * else's list.
 */
export const shareWorkout = onCall(
  { region: 'europe-west3', timeoutSeconds: 30, secrets: VAPID_SECRETS },
  async (request) => {
    const uid = requireUid(request.auth);
    const workoutId = request.data?.workoutId as unknown;
    const friendUids = request.data?.friendUids as unknown;
    if (typeof workoutId !== 'string' || workoutId === '') {
      return { ok: false, reason: 'not-found' };
    }

    const [snap, friends] = await Promise.all([
      db.collection(WORKOUTS).doc(workoutId).get(),
      readFriendUids(uid),
    ]);
    const raw = snap.data();
    const workout = snap.exists ? normalizeWorkout(snap.id, raw) : null;
    // The owner's own document that no longer validates is their problem
    // to fix in the editor, not a "not found".
    if (raw?.['ownerId'] === uid && !workout) {
      return { ok: false, reason: 'invalid' };
    }
    const rejection = workoutShareRejection({
      uid,
      workout,
      friendUids,
      acceptedFriendUids: friends,
    });
    if (rejection || !workout) {
      return { ok: false, reason: rejection ?? 'not-found' };
    }

    // Narrowed by `workoutShareRejection`.
    const recipients = [...new Set(friendUids as string[])];
    const counts = new Map<string, number>();
    await Promise.all(
      recipients.map(async (friend) => {
        const count = await db
          .collection(WORKOUTS)
          .where('ownerId', '==', friend)
          .count()
          .get();
        counts.set(friend, count.data().count);
      })
    );
    const { send, full } = splitByRoom(recipients, counts);

    const pushRecipients = await readPushRecipients([uid, ...send]);
    const sharedBy: WorkoutSource = {
      uid,
      workoutId,
      displayName: pushRecipients.get(uid)?.displayName ?? null,
    };
    const now = new Date().toISOString();
    const batch = db.batch();
    for (const friend of send) {
      batch.set(
        db.collection(WORKOUTS).doc(),
        copyWorkout(workout, { ownerId: friend, sharedBy, now })
      );
    }
    await batch.commit();

    if (configureWebPush()) {
      await Promise.all(
        send.map((friend) =>
          deliverPushToUser(
            friend,
            buildFriendPushPayload({
              kind: 'workout',
              locale: pushRecipients.get(friend)?.locale ?? 'de',
              actorName: sharedBy.displayName,
              workout: { title: workout.title },
            }),
            friendPushOptions('workout'),
            'shareWorkout'
          )
        )
      );
    }

    logger.info('shareWorkout', {
      uid,
      workoutId,
      sent: send.length,
      full: full.length,
    });
    return { ok: true, sent: send.length, full };
  }
);
