import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { isPurgedEntryDeletion } from './account-deletion/tombstone';
import { rebuildExerciseLeaderboardsCore } from './exercise-leaderboard/rebuild';
import { db, TZ } from './firebase-app';
import { rebuildXpLeaderboardCore } from './xp/leaderboard';

// Scheduled rebuild every 15 min + a write-driven refresh so the snapshot
// stays fresh between scheduled runs.
export const rebuildExerciseLeaderboards = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: TZ,
    region: 'europe-west3',
    retryCount: 1,
  },
  async () => {
    await rebuildExerciseLeaderboardsCore({ includeAllTime: true });
    await rebuildXpLeaderboardCore(db, { includeAllTime: true });
  }
);

export const refreshExerciseLeaderboardsOnEntryWrite = onDocumentWritten(
  {
    document: 'exerciseEntries/{entryId}',
    region: 'europe-west3',
    retry: false,
  },
  async (event) => {
    const { before, after } = event.data ?? {};
    // A purge deletes thousands of entries at once; the scheduled rebuild
    // drops the user within 15 minutes without one full rebuild per entry.
    if (await isPurgedEntryDeletion(db, before?.data(), after?.data())) return;
    // Post-cutover pushups (`exerciseId:'pushup'`) aggregate + rank like
    // every other exercise, so there is no exercise-id guard here.

    // Carry the previous snapshot's allTime forward and let the
    // scheduled rebuild refresh it. See `rebuildExerciseLeaderboardsCore`
    // for the race-safety + cost rationale.
    await rebuildExerciseLeaderboardsCore({ includeAllTime: false });
  }
);
