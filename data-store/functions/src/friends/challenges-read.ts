import { AggregateField, Timestamp } from 'firebase-admin/firestore';
import {
  addDays,
  CHALLENGE_RESULT_VISIBLE_DAYS,
  type Challenge,
  type Friendship,
} from '@pu-stats/models';

import { db } from '../firebase-app';
import { challengeEntryBounds, type ChallengeDoc } from './challenges';
import { acceptedFriendUids } from './logic';

/**
 * Firestore side of friend challenges. Not in the `./friends` barrel, so
 * the pure modules and their tests stay free of the Admin SDK.
 */

export const CHALLENGES = 'challenges';

export function toChallengeDoc(
  snap: FirebaseFirestore.DocumentSnapshot
): ChallengeDoc {
  return { id: snap.id, ...(snap.data() as Challenge) };
}

/** Everything the user is in or asked to join, both queries merged. */
export async function readChallengesOf(uid: string): Promise<ChallengeDoc[]> {
  const col = db.collection(CHALLENGES);
  const [participating, invited] = await Promise.all([
    col.where('participants', 'array-contains', uid).get(),
    col.where('invited', 'array-contains', uid).get(),
  ]);
  return [...participating.docs, ...invited.docs].map(toChallengeDoc);
}

export async function readFriendUids(uid: string): Promise<string[]> {
  const snap = await db
    .collection('friendships')
    .where('users', 'array-contains', uid)
    .get();
  return acceptedFriendUids(
    snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Friendship) })),
    uid
  );
}

/** One participant's reps for the exercise inside the challenge window. */
export async function sumChallengeEntries(
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

/** The TTL field: gone once the result stopped being shown (`visibleChallenges`). */
export function challengeExpiry(to: string): Timestamp {
  return Timestamp.fromDate(
    new Date(`${addDays(to, CHALLENGE_RESULT_VISIBLE_DAYS + 1)}T00:00:00Z`)
  );
}
