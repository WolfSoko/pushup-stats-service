import { AggregateField, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  challengeEndDate,
  challengeRejection,
  findExerciseDefinition,
  type Challenge,
  type Friendship,
} from '@pu-stats/models';

import { berlinDateParts } from './datetime';
import { db } from './firebase-app';
import {
  acceptedFriendUids,
  activeChallengeCount,
  buildChallengeView,
  buildFriendPushPayload,
  challengeEntryBounds,
  friendPushOptions,
  sanitizeExerciseName,
  visibleChallenges,
  type ChallengeDoc,
} from './friends';
import { deliverPushToUser, readPushRecipients } from './push/deliver-user';
import { configureWebPush, VAPID_SECRETS } from './push/vapid';

/**
 * Friend challenges: a rep target for one exercise, chased by a group of
 * confirmed friends over a few days.
 *
 * Every write goes through these callables — who is in a challenge decides
 * whose numbers the others see, so `challenges` is Admin-SDK-only. Progress
 * is summed from `exerciseEntries` per participant on read: the
 * per-exercise aggregates only keep calendar buckets, and a challenge's
 * result has to survive the week rolling over.
 */

const COLLECTION = 'challenges';

function requireUid(auth: { uid?: string } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
  }
  return auth.uid;
}

async function readChallenges(uid: string): Promise<ChallengeDoc[]> {
  const snap = await db
    .collection(COLLECTION)
    .where('participants', 'array-contains', uid)
    .get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Challenge),
  }));
}

async function readFriendUids(uid: string): Promise<string[]> {
  const snap = await db
    .collection('friendships')
    .where('users', 'array-contains', uid)
    .get();
  return acceptedFriendUids(
    snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Friendship) })),
    uid
  );
}

export const createChallenge = onCall(
  { region: 'europe-west3', timeoutSeconds: 30, secrets: VAPID_SECRETS },
  async (request) => {
    const uid = requireUid(request.auth);
    const friendUids = request.data?.friendUids as unknown;
    const exerciseId = request.data?.exerciseId as unknown;
    const target = request.data?.target as unknown;
    const days = request.data?.days as unknown;

    const today = berlinDateParts().isoDate;
    const [friends, mine] = await Promise.all([
      readFriendUids(uid),
      readChallenges(uid),
    ]);
    const exercise =
      typeof exerciseId === 'string'
        ? findExerciseDefinition(exerciseId)
        : null;
    const rejection = challengeRejection({
      friendUids,
      acceptedFriendUids: friends,
      target,
      days,
      exerciseValid: exercise?.measurement === 'reps',
      activeCount: activeChallengeCount(
        mine.filter((c) => c.createdBy === uid),
        today
      ),
    });
    if (rejection) return { ok: false, reason: rejection };

    // Narrowed by `challengeRejection`.
    const invited = [...new Set(friendUids as string[])];
    const challenge: Challenge = {
      createdBy: uid,
      participants: [uid, ...invited],
      exerciseId: exerciseId as string,
      target: target as number,
      from: today,
      to: challengeEndDate(today, days as number),
      createdAt: new Date().toISOString(),
    };
    const ref = await db.collection(COLLECTION).add(challenge);

    if (configureWebPush()) {
      const recipients = await readPushRecipients([uid, ...invited]);
      const actorName = recipients.get(uid)?.displayName ?? null;
      await Promise.all(
        invited.map((friend) =>
          deliverPushToUser(
            friend,
            buildFriendPushPayload({
              kind: 'challenge',
              locale: recipients.get(friend)?.locale ?? 'de',
              actorName,
              challenge: {
                target: challenge.target,
                exerciseName: sanitizeExerciseName(
                  request.data?.exerciseName,
                  challenge.exerciseId
                ),
                days: days as number,
              },
            }),
            friendPushOptions('challenge'),
            'createChallenge'
          )
        )
      );
    }

    logger.info('createChallenge', {
      uid,
      id: ref.id,
      invited: invited.length,
    });
    return { ok: true, id: ref.id };
  }
);

/** One participant's reps for the exercise inside the challenge window. */
async function sumEntries(
  uid: string,
  challenge: ChallengeDoc
): Promise<number> {
  const bounds = challengeEntryBounds(challenge);
  const snap = await db
    .collection('exerciseEntries')
    .where('userId', '==', uid)
    .where('exerciseId', '==', challenge.exerciseId)
    .where('timestamp', '>=', bounds.fromInclusive)
    .where('timestamp', '<', bounds.toExclusive)
    .aggregate({ total: AggregateField.sum('reps') })
    .get();
  return Number(snap.data().total ?? 0);
}

export const listChallenges = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    const uid = requireUid(request.auth);
    const today = berlinDateParts().isoDate;
    const docs = visibleChallenges(await readChallenges(uid), today);

    const uids = [...new Set(docs.flatMap((doc) => doc.participants))];
    const names = new Map<string, string>();
    if (uids.length > 0) {
      const col = db.collection('userConfigs');
      const snaps = await db.getAll(...uids.map((id) => col.doc(id)));
      for (const snap of snaps) {
        const name = String(snap.data()?.['displayName'] ?? '').trim();
        if (name) names.set(snap.id, name);
      }
    }

    const challenges = await Promise.all(
      docs.map(async (doc) => {
        const sums = new Map<string, number>();
        await Promise.all(
          doc.participants.map(async (participant) => {
            sums.set(participant, await sumEntries(participant, doc));
          })
        );
        return buildChallengeView(doc, sums, names, uid, today);
      })
    );

    return { challenges };
  }
);

/**
 * Leaving takes only the leaver out. The last one out deletes the
 * document — a challenge nobody is in is not a result anyone can see.
 */
export const leaveChallenge = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    const uid = requireUid(request.auth);
    const id = request.data?.id as unknown;
    if (typeof id !== 'string' || id === '') {
      throw new HttpsError('invalid-argument', 'id fehlt.');
    }

    const ref = db.collection(COLLECTION).doc(id);
    const left = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      const participants = (snap.data() as Challenge).participants ?? [];
      if (!participants.includes(uid)) return false;
      if (participants.length <= 1) tx.delete(ref);
      else tx.update(ref, { participants: FieldValue.arrayRemove(uid) });
      return true;
    });

    logger.info('leaveChallenge', { uid, id, left });
    return { ok: left };
  }
);
