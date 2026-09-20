import { logger } from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import {
  copyWorkout,
  normalizeWorkout,
  shouldPushNotification,
  type Workout,
  workoutShareRejection,
  type WorkoutSource,
} from '@pu-stats/models';

import { requireUid } from './callable-auth';
import { db } from './firebase-app';
import { buildFriendPushPayload, friendPushOptions } from './friends';
import { readFriendUids } from './friends/challenges-read';
import { writeNotification } from './notifications';
import { deliverPushToUser, readPushRecipients } from './push/deliver-user';
import { configureWebPush, VAPID_SECRETS } from './push/vapid';
import { hasRoom } from './workouts/logic';

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
    const pushRecipients = await readPushRecipients([uid, ...recipients]);
    const sharedBy: WorkoutSource = {
      uid,
      workoutId,
      displayName: pushRecipients.get(uid)?.displayName ?? null,
    };
    const outcomes = await Promise.all(
      recipients.map((friend) => copyTo(friend, workout, sharedBy))
    );
    const sent = recipients.filter((_, i) => outcomes[i]);
    const full = recipients.filter((_, i) => !outcomes[i]);

    // Only those who actually got a copy — a friend at the workout cap has
    // nothing to open, so telling them about it would be a dead end.
    await Promise.all(
      sent.map((friend) =>
        writeNotification(
          friend,
          { type: 'workoutShared' },
          {
            type: 'workoutShared',
            createdAt: new Date().toISOString(),
            readAt: null,
            actorUid: uid,
            actorName: sharedBy.displayName,
            url: '/workouts',
            payload: { title: workout.title },
          }
        )
      )
    );

    if (configureWebPush()) {
      const now = new Date();
      await Promise.all(
        sent
          .filter((friend) =>
            shouldPushNotification(
              pushRecipients.get(friend)?.push,
              'workoutShared',
              now
            )
          )
          .map((friend) =>
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
      sent: sent.length,
      full: full.length,
    });
    return { ok: true, sent: sent.length, full };
  }
);

/**
 * One recipient's copy, written only if they still have room. The count
 * and the write share a transaction so two friends sharing at the same
 * moment cannot both slip a 50th and a 51st workout past the cap. A
 * recipient at the limit is skipped, not failed — the others still want
 * their copy, and the sender is told.
 */
async function copyTo(
  friend: string,
  workout: Workout,
  sharedBy: WorkoutSource
): Promise<boolean> {
  const col = db.collection(WORKOUTS);
  return db.runTransaction(async (tx) => {
    const count = await tx.get(col.where('ownerId', '==', friend).count());
    if (!hasRoom(count.data().count)) return false;
    tx.create(
      col.doc(),
      copyWorkout(workout, {
        ownerId: friend,
        sharedBy,
        now: new Date().toISOString(),
      })
    );
    return true;
  });
}
