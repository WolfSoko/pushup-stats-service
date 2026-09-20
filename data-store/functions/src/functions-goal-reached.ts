import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import { berlinDateParts } from './datetime';
import { db } from './firebase-app';
import { writeNotificationOnce } from './notifications';
import { loadReminderGoal } from './push/reminder-goal-read';

/**
 * Files an inbox entry the first time a user meets their goal for the day.
 *
 * Hangs off the per-exercise aggregates rather than `exerciseEntries`:
 * the aggregates already carry the day's total, so this costs one config
 * read instead of re-summing every entry on every write.
 *
 * The dashboard celebrates the moment with a dialog, but only for
 * whoever is looking at it. Someone who logged the last reps from the
 * quick-add button on another screen, or whose tab was closed, has
 * nothing to look back at — the inbox is that record.
 */
export const notifyGoalReachedOnStatsWrite = onDocumentWritten(
  {
    document: 'userStats/{userId}/perExercise/{exerciseId}',
    region: 'europe-west3',
  },
  async (event) => {
    const userId = event.params['userId'];
    if (!userId) return;

    const after = event.data?.after?.data();
    const today = berlinDateParts().isoDate;
    // A write that did not raise today's total cannot have crossed the
    // goal: a correction, a different day's bucket, a deletion.
    if (!after || after['dailyKey'] !== today) return;
    const before = event.data?.before?.data();
    const grew =
      Number(after['dailyReps'] ?? 0) >
      (before?.['dailyKey'] === today ? Number(before['dailyReps'] ?? 0) : 0);
    if (!grew) return;

    const config = (
      await db.collection('userConfigs').doc(userId).get()
    ).data();
    const goal = await loadReminderGoal(userId, config, today);
    if (!goal?.reached) return;

    // `writeNotificationOnce`: every further entry today still lands here,
    // and rewriting the row would resurrect a notification already read.
    await writeNotificationOnce(
      userId,
      { type: 'goalReached', day: today },
      {
        type: 'goalReached',
        createdAt: new Date().toISOString(),
        readAt: null,
        actorUid: null,
        actorName: null,
        url: '/app',
        payload: { done: goal.done, target: goal.target, kind: goal.kind },
      }
    );

    logger.info('notifyGoalReachedOnStatsWrite', { userId, kind: goal.kind });
  }
);
