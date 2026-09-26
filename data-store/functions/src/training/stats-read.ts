import {
  rebuildTrainingStats,
  TRAINING_STATS_DOC,
  TRAINING_STATS_VERSION,
  type TrainingLine,
  type TrainingStats,
} from '@pu-stats/models';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { readXpConfig } from '../xp/config-read';
import { trainingLineOf } from './lines';

export function trainingStatsRef(db: Firestore, uid: string) {
  return db.doc(`userStats/${uid}/${TRAINING_STATS_DOC}`);
}

export function isCurrentTrainingStats(data: unknown): data is TrainingStats {
  return (
    !!data &&
    typeof data === 'object' &&
    ((data as TrainingStats).version ?? 0) >= TRAINING_STATS_VERSION
  );
}

/** All of a user's entries as training lines, optionally inside a transaction. */
export async function readTrainingLines(
  db: Firestore,
  uid: string,
  tx?: Transaction
): Promise<TrainingLine[]> {
  const query = db
    .collection('exerciseEntries')
    .where('userId', '==', uid)
    .select('exerciseId', 'timestamp', 'reps', 'durationSec', 'distanceM');
  const [snap, config] = await Promise.all([
    tx ? tx.get(query) : query.get(),
    readXpConfig(db),
  ]);
  return snap.docs
    .map((doc) => trainingLineOf(doc.data(), config))
    .filter((line): line is TrainingLine => line !== null);
}

/**
 * The user's training aggregate. A user who has not trained since the
 * aggregate shipped has none yet; they get it computed from the entries
 * in memory — read paths must not write, and their next entry has the
 * trigger build the real one.
 */
export async function readTrainingStats(
  db: Firestore,
  uid: string
): Promise<TrainingStats> {
  const snap = await trainingStatsRef(db, uid).get();
  const data = snap.data();
  if (isCurrentTrainingStats(data)) return data;
  return rebuildTrainingStats(uid, await readTrainingLines(db, uid));
}
