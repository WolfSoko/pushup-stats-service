import {
  nextTrainingStats,
  xpRatesKey,
  type TrainingStats,
} from '@pu-stats/models';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import { isPurgedEntryDeletion } from './account-deletion/tombstone';
import { db } from './firebase-app';
import { trainingLineOf } from './training/lines';
import {
  buildTrainingStats,
  isCurrentTrainingStats,
  trainingStatsRef,
} from './training/stats-read';
import { rememberEvent } from './xp/aggregate';
import { readXpConfig } from './xp/config-read';

/**
 * Keeps `userStats/{uid}/aggregates/training` — every exercise in one
 * place — in step with the entries. A missing or outdated doc, one priced
 * at other XP rates, or a removal that may have taken the best entry is
 * rebuilt from all of the user's entries instead of patched.
 *
 * A rebuild already contains every write committed up to its read time,
 * so the events of those writes are skipped rather than applied twice.
 */
export const updateTrainingStatsOnEntryWrite = onDocumentWritten(
  { document: 'exerciseEntries/{entryId}', region: 'europe-west3' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const userId = (after?.['userId'] ?? before?.['userId']) as
      | string
      | undefined;
    if (!userId) return;
    if (await isPurgedEntryDeletion(db, before, after)) return;

    const config = await readXpConfig(db);
    const ratesKey = xpRatesKey(config);
    const ref = trainingStatsRef(db, userId);
    const nowIso = new Date().toISOString();

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      const current = isCurrentTrainingStats(data) ? data : null;
      if (current?.recentEventIds?.includes(event.id)) return;
      if (current && isContainedIn(event.time, current)) return;

      const next =
        nextTrainingStats(
          current,
          trainingLineOf(before, config),
          trainingLineOf(after, config),
          ratesKey
        ) ?? (await buildTrainingStats(db, userId, config, tx));

      tx.set(ref, {
        ...next,
        recentEventIds: rememberEvent(
          (data as TrainingStats | undefined)?.recentEventIds,
          event.id
        ),
        updatedAt: nowIso,
      });
    });
  }
);

function isContainedIn(eventTime: string, stats: TrainingStats): boolean {
  return (
    stats.rebuiltAt !== '' &&
    Date.parse(eventTime) <= Date.parse(stats.rebuiltAt)
  );
}
