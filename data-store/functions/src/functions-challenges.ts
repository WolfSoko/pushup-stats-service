import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  challengeEndDate,
  challengeRejection,
  challengeRespondRejection,
  findExerciseDefinition,
  type Challenge,
} from '@pu-stats/models';

import { requireUid } from './callable-auth';
import { berlinDateParts } from './datetime';
import { db } from './firebase-app';
import {
  activeChallengeCount,
  buildChallengeView,
  buildFriendPushPayload,
  friendPushOptions,
  invitedOf,
  sanitizeExerciseName,
  visibleChallenges,
} from './friends';
import {
  CHALLENGES,
  challengeExpiry,
  readChallengesOf,
  readFriendUids,
  sumChallengeEntries,
  toChallengeDoc,
} from './friends/challenges-read';
import { deliverPushToUser, readPushRecipients } from './push/deliver-user';
import { configureWebPush, VAPID_SECRETS } from './push/vapid';
import { readDisplayNames } from './user-config-read';

/**
 * Friend challenges: a rep target for one exercise, chased by a group of
 * confirmed friends over a few days.
 *
 * Invited friends see the challenge, not the numbers, until they accept —
 * being a participant is the consent to show each other their entries.
 * Every write goes through these callables, so `challenges` is
 * Admin-SDK-only. Progress is summed from `exerciseEntries` on read: the
 * per-exercise aggregates only keep calendar buckets, and a result has to
 * survive the week rolling over. The TTL policy on `expiresAt` drops a
 * challenge once its result is no longer shown.
 */

export const createChallenge = onCall(
  { region: 'europe-west3', timeoutSeconds: 30, secrets: VAPID_SECRETS },
  async (request) => {
    const uid = requireUid(request.auth);
    const friendUids = request.data?.friendUids as unknown;
    const exerciseId = request.data?.exerciseId as unknown;
    const target = request.data?.target as unknown;
    const days = request.data?.days as unknown;

    const today = berlinDateParts().isoDate;
    const friends = await readFriendUids(uid);
    const exercise =
      typeof exerciseId === 'string'
        ? findExerciseDefinition(exerciseId)
        : null;
    const ref = db.collection(CHALLENGES).doc();
    const mine = db.collection(CHALLENGES).where('createdBy', '==', uid);

    // The active-count check and the create share a transaction, so two
    // parallel calls cannot both slip under the limit.
    const result = await db.runTransaction(async (tx) => {
      const own = (await tx.get(mine)).docs.map(toChallengeDoc);
      const rejection = challengeRejection({
        friendUids,
        acceptedFriendUids: friends,
        target,
        days,
        exerciseValid: exercise?.measurement === 'reps',
        activeCount: activeChallengeCount(own, today),
      });
      if (rejection) return { ok: false as const, reason: rejection };

      // Narrowed by `challengeRejection`.
      const invited = [...new Set(friendUids as string[])];
      const to = challengeEndDate(today, days as number);
      const challenge: Challenge = {
        createdBy: uid,
        participants: [uid],
        invited,
        exerciseId: exerciseId as string,
        target: target as number,
        from: today,
        to,
        createdAt: new Date().toISOString(),
      };
      tx.create(ref, { ...challenge, expiresAt: challengeExpiry(to) });
      return { ok: true as const, invited, challenge };
    });
    if (!result.ok) return result;

    if (configureWebPush()) {
      const recipients = await readPushRecipients([uid, ...result.invited]);
      const actorName = recipients.get(uid)?.displayName ?? null;
      const exerciseName = sanitizeExerciseName(
        request.data?.exerciseName,
        result.challenge.exerciseId
      );
      await Promise.all(
        result.invited.map((friend) =>
          deliverPushToUser(
            friend,
            buildFriendPushPayload({
              kind: 'challenge',
              locale: recipients.get(friend)?.locale ?? 'de',
              actorName,
              challenge: {
                target: result.challenge.target,
                exerciseName,
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
      invited: result.invited.length,
    });
    return { ok: true, id: ref.id };
  }
);

/** Accepting moves the user onto the board; declining just takes them off the list. */
export const respondChallenge = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    const uid = requireUid(request.auth);
    const id = requireId(request.data?.id);
    const accept = request.data?.accept === true;

    const ref = db.collection(CHALLENGES).doc(id);
    const today = berlinDateParts().isoDate;
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const doc = snap.exists ? toChallengeDoc(snap) : undefined;
      const rejection = challengeRespondRejection(
        doc && { ...doc, invited: invitedOf(doc) },
        uid,
        today
      );
      if (rejection) return { ok: false as const, reason: rejection };
      tx.update(ref, {
        invited: FieldValue.arrayRemove(uid),
        ...(accept ? { participants: FieldValue.arrayUnion(uid) } : {}),
      });
      return { ok: true as const, accepted: accept };
    });

    logger.info('respondChallenge', { uid, id, ...result });
    return result;
  }
);

/**
 * The viewer's challenges. `progress: false` skips the per-participant
 * sums — a surface that only counts challenges (the dashboard card) has
 * no use for N×M aggregation queries. An invitee gets no sums either way.
 */
export const listChallenges = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    const uid = requireUid(request.auth);
    const withProgress = request.data?.progress !== false;
    const today = berlinDateParts().isoDate;
    const docs = visibleChallenges(await readChallengesOf(uid), today);

    const names = await readDisplayNames(
      docs.flatMap((doc) => [...doc.participants, ...invitedOf(doc)])
    );

    const challenges = await Promise.all(
      docs.map(async (doc) => {
        const sums = new Map<string, number>();
        if (withProgress && !invitedOf(doc).includes(uid)) {
          await Promise.all(
            doc.participants.map(async (participant) => {
              sums.set(
                participant,
                await sumChallengeEntries(participant, doc)
              );
            })
          );
        }
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
    const id = requireId(request.data?.id);

    const ref = db.collection(CHALLENGES).doc(id);
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

function requireId(value: unknown): string {
  if (typeof value !== 'string' || value === '') {
    throw new HttpsError('invalid-argument', 'id fehlt.');
  }
  return value;
}
