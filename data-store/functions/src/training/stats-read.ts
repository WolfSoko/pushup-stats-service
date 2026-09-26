import {
  rebuildTrainingStats,
  TRAINING_STATS_DOC,
  TRAINING_STATS_VERSION,
  xpRatesKey,
  type TrainingLine,
  type TrainingStats,
  type XpConfig,
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

/**
 * All of a user's entries as training lines, plus the time they were
 * read at — inside a transaction, the aggregate built from them holds
 * exactly the writes committed up to that time.
 */
export async function readTrainingLines(
  db: Firestore,
  uid: string,
  config: XpConfig | null,
  tx?: Transaction
): Promise<{ lines: TrainingLine[]; readTime: string }> {
  const query = db
    .collection('exerciseEntries')
    .where('userId', '==', uid)
    .select('exerciseId', 'timestamp', 'reps', 'durationSec', 'distanceM');
  const snap = await (tx ? tx.get(query) : query.get());
  return {
    lines: snap.docs
      .map((doc) => trainingLineOf(doc.data(), config))
      .filter((line): line is TrainingLine => line !== null),
    readTime: snap.readTime.toDate().toISOString(),
  };
}

/** Builds the aggregate from scratch, stamped with its rates and read time. */
export async function buildTrainingStats(
  db: Firestore,
  uid: string,
  config: XpConfig | null,
  tx?: Transaction
): Promise<TrainingStats> {
  const { lines, readTime } = await readTrainingLines(db, uid, config, tx);
  return rebuildTrainingStats(uid, lines, {
    ratesKey: xpRatesKey(config),
    rebuiltAt: readTime,
  });
}

/**
 * The training aggregates of several users in one `getAll`. A user
 * without a current one — nobody before `backfillTrainingStats` ran, a
 * brand-new account after — gets it computed from the entries in memory:
 * read paths never write it.
 */
export async function readTrainingStatsMany(
  db: Firestore,
  uids: ReadonlyArray<string>
): Promise<TrainingStats[]> {
  if (uids.length === 0) return [];
  const snaps = await db.getAll(
    ...uids.map((uid) => trainingStatsRef(db, uid))
  );
  const missing = uids.filter(
    (_, i) => !isCurrentTrainingStats(snaps[i].data())
  );
  const config = missing.length > 0 ? await readXpConfig(db) : null;
  return Promise.all(
    uids.map((uid, i) => {
      const data = snaps[i].data();
      return isCurrentTrainingStats(data)
        ? Promise.resolve(data)
        : buildTrainingStats(db, uid, config);
    })
  );
}

export async function readTrainingStats(
  db: Firestore,
  uid: string
): Promise<TrainingStats> {
  const [stats] = await readTrainingStatsMany(db, [uid]);
  return stats;
}
