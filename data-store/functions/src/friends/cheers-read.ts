import { logger } from 'firebase-functions';
import { cheerId } from '@pu-stats/models';

import { db } from '../firebase-app';
import type { ChallengeViewExtras } from './challenges';
import { readFriendUids } from './challenges-read';
import type { CheersToday } from './leaderboard';

/**
 * Today's cheers among a group: how many each received, and whom the
 * viewer already cheered. Firestore-side, so it stays out of the
 * `./friends` barrel that the pure modules and their tests share.
 */
export async function readCheersToday(
  viewerUid: string,
  uids: ReadonlyArray<string>,
  day: string
): Promise<CheersToday> {
  const received = new Map<string, number>();
  const cheeredByViewer = new Set<string>();
  const col = db.collection('cheers');
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
  const [byViewer, ...toGroup] = await Promise.all([
    readCheeredBy(viewerUid, day),
    ...chunks.map((chunk) =>
      col.where('day', '==', day).where('to', 'in', chunk).get()
    ),
  ]);
  for (const to of byViewer) cheeredByViewer.add(to);
  for (const result of toGroup) {
    for (const snap of result.docs) {
      const to = String(snap.data()['to']);
      received.set(to, (received.get(to) ?? 0) + 1);
    }
  }
  return { received, cheeredByViewer };
}

/** Everyone `viewerUid` cheered on `day`. */
export async function readCheeredBy(
  viewerUid: string,
  day: string
): Promise<Set<string>> {
  const snap = await db
    .collection('cheers')
    .where('from', '==', viewerUid)
    .where('day', '==', day)
    .get();
  return new Set(snap.docs.map((doc) => String(doc.data()['to'])));
}

/** Whether `from` cheered `to` on `day` — one get by deterministic id. */
export async function hasCheered(
  from: string,
  to: string,
  day: string
): Promise<boolean> {
  const snap = await db
    .collection('cheers')
    .doc(cheerId(from, to, day))
    .get();
  return snap.exists;
}

/**
 * Whom the viewer may cheer and already did. A failed read costs the
 * buttons, not the list the invitation answers live on.
 */
export async function readChallengeCheerContext(
  uid: string,
  today: string
): Promise<ChallengeViewExtras> {
  try {
    const [friends, cheered] = await Promise.all([
      readFriendUids(uid),
      readCheeredBy(uid, today),
    ]);
    return { friendUids: new Set(friends), cheeredByViewer: cheered };
  } catch (error) {
    logger.error('listChallenges: cheer context failed', {
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}
