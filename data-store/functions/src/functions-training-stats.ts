import {
  rebuildTrainingStats,
  rememberTrainingEvent,
  type TrainingStats,
} from '@pu-stats/models';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import { isPurgedEntryDeletion } from './account-deletion/tombstone';
import { db } from './firebase-app';
import { nextTrainingStats } from './training/aggregate';
import { trainingLineOf } from './training/lines';
import {
  isCurrentTrainingStats,
  readTrainingLines,
  trainingStatsRef,
} from './training/stats-read';
import { readXpConfig } from './xp/config-read';

/**
 * Keeps `userStats/{uid}/aggregates/training` — every exercise in one
 * place — in step with the entries. A missing or outdated doc, or a
 * removal that may have taken the best entry, is rebuilt from all of
 * the user's entries instead of patched.
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
    const ref = trainingStatsRef(db, userId);
    const nowIso = new Date().toISOString();

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      const current = isCurrentTrainingStats(data) ? data : null;
      if (current?.recentEventIds?.includes(event.id)) return;

      const next =
        nextTrainingStats(
          current,
          trainingLineOf(before, config),
          trainingLineOf(after, config)
        ) ??
        rebuildTrainingStats(userId, await readTrainingLines(db, userId, tx));

      tx.set(ref, {
        ...next,
        recentEventIds: rememberTrainingEvent(
          (data as TrainingStats | undefined)?.recentEventIds,
          event.id
        ),
        updatedAt: nowIso,
      });
    });
  }
);
