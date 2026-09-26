import {
  summarizeTraining,
  xpForEntry,
  xpRateFor,
  type TrainingSummary,
  type TrainingSummaryEntry,
} from '@pu-stats/models';
import type { Firestore } from 'firebase-admin/firestore';

import { readXpConfig } from '../xp/config-read';
import type { UserXpForPublicProfile } from './public-profile.types';

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * Lifetime numbers across every exercise, from the owner's entries — the
 * same input and the same arithmetic as the dashboard's all-time row.
 *
 * A per-entry read rather than an aggregate: training days and the streak
 * need distinct days across exercises, which no per-exercise doc can
 * answer. `select` keeps each read to the five fields the sum needs.
 * The XP bests use today's rates, not the frozen ledger rates.
 */
export async function readTrainingSummary(
  db: Firestore,
  uid: string,
  today: string
): Promise<TrainingSummary> {
  const [snap, config] = await Promise.all([
    db
      .collection('exerciseEntries')
      .where('userId', '==', uid)
      .select('exerciseId', 'timestamp', 'reps', 'durationSec', 'distanceM')
      .get(),
    readXpConfig(db),
  ]);
  const entries: TrainingSummaryEntry[] = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      exerciseId: String(data['exerciseId'] ?? ''),
      timestamp: String(data['timestamp'] ?? ''),
      reps: numberOrNull(data['reps']),
      durationSec: numberOrNull(data['durationSec']),
      distanceM: numberOrNull(data['distanceM']),
    };
  });
  return summarizeTraining(entries, today, (entry) =>
    xpForEntry(entry, xpRateFor(entry.exerciseId, config))
  );
}

export async function readUserXp(
  db: Firestore,
  uid: string
): Promise<UserXpForPublicProfile | null> {
  const snap = await db.collection('userXp').doc(uid).get();
  return snap.exists ? (snap.data() as UserXpForPublicProfile) : null;
}
