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
  invitedOf,
  notifyChallengeAccepted,
  notifyChallengeInvited,
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
import { readChallengeCheerContext } from './friends/cheers-read';
import { VAPID_SECRETS } from './push/vapid';
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

    await notifyChallengeInvited(uid, result.invited, {
      target: result.challenge.target,
      exerciseName: sanitizeExerciseName(
        request.data?.exerciseName,
        result.challenge.exerciseId
      ),
      days: days as number,
    });

    logger.info('createChallenge', {
      uid,
      id: ref.id,
      invited: result.invited.length,
    });
    return { ok: true, id: ref.id };
  }
);

/**
 * Accepting moves the user onto the board and tells the people already
 * on it; declining just takes them off the list, quietly.
 */
export const respondChallenge = onCall(
  { region: 'europe-west3', timeoutSeconds: 30, secrets: VAPID_SECRETS },
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
      const others = (doc?.participants ?? []).filter((p) => p !== uid);
      return { ok: true as const, accepted: accept, others };
    });

    if (result.ok && result.accepted) {
      await notifyChallengeAccepted(uid, result.others);
    }

    logger.info('respondChallenge', {
      uid,
      id,
      ok: result.ok,
      ...(result.ok
        ? { accepted: result.accepted }
        : { reason: result.reason }),
    });
    return result.ok ? { ok: true, accepted: result.accepted } : result;
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

    // Cheers only matter next to the numbers; a count-only call skips them.
    const [names, cheerContext] = await Promise.all([
      readDisplayNames(
        docs.flatMap((doc) => [...doc.participants, ...invitedOf(doc)])
      ),
      withProgress && docs.length > 0
        ? readChallengeCheerContext(uid, today)
        : Promise.resolve({}),
    ]);

    const challenges = await Promise.all(
      docs.map(async (doc) => {
        const sums = new Map<string, number>();
        const failed = new Set<string>();
        if (withProgress && !invitedOf(doc).includes(uid)) {
          // One participant's failed sum must not take the whole list
          // down — the invitation buttons live on this list.
          await Promise.all(
            doc.participants.map(async (participant) => {
              try {
                sums.set(
                  participant,
                  await sumChallengeEntries(participant, doc)
                );
              } catch (error) {
                failed.add(participant);
                logger.error('listChallenges: sum failed', {
                  uid,
                  id: doc.id,
                  participant,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            })
          );
        }
        return buildChallengeView(doc, sums, names, uid, today, {
          ...cheerContext,
          failedSums: failed,
        });
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
