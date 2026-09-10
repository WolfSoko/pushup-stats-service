import { logger } from 'firebase-functions';

import {
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  type ReminderGoalState,
} from '@pu-stats/models';

import { db } from '../firebase-app';
import {
  configuredDailyGoal,
  dailyGoalFromTotals,
  planGoalFromTotals,
  reminderGoalExerciseIds,
  reminderPlanDay,
} from './reminder-goal';

/**
 * Firestore side of the reminder goal: what the dispatcher reads to know
 * what the user still has open today. Kept apart from `reminder-goal.ts` so
 * the derivation stays testable without the Admin SDK.
 */

/**
 * Today's logged amount per exercise, from the per-exercise aggregates.
 * A doc whose `dailyKey` is not today has rolled over — its `dailyReps`
 * belong to an earlier day and count as nothing.
 */
async function readDailyTotals(
  uid: string,
  exerciseIds: ReadonlyArray<string>,
  today: string
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (exerciseIds.length === 0) return totals;
  const col = db.collection('userStats').doc(uid).collection('perExercise');
  const snaps = await db.getAll(...exerciseIds.map((id) => col.doc(id)));
  for (const snap of snaps) {
    const data = snap.data();
    if (!data || data['dailyKey'] !== today) continue;
    const value = Number(data['dailyReps'] ?? 0);
    if (Number.isFinite(value) && value > 0) totals.set(snap.id, value);
  }
  return totals;
}

/**
 * The goal the user's reminder should be about: today's plan day while a
 * plan is running, otherwise the configured daily goal. `null` when neither
 * exists — the reminder then carries no goal line and nothing pauses it.
 */
export async function loadReminderGoal(
  uid: string,
  userConfigData: Record<string, unknown> | undefined,
  today: string
): Promise<ReminderGoalState | null> {
  try {
    return await readReminderGoal(uid, userConfigData, today);
  } catch (err) {
    // The goal only enriches the reminder and gates the pause — a failed
    // read must not cost the user the reminder itself.
    logger.warn('loadReminderGoal: failed', {
      uid,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function readReminderGoal(
  uid: string,
  userConfigData: Record<string, unknown> | undefined,
  today: string
): Promise<ReminderGoalState | null> {
  const planSnap = await db.collection('userTrainingPlans').doc(uid).get();
  const planData = planSnap.data();
  const planDay = reminderPlanDay(planData, today);
  if (planDay) {
    const totals = await readDailyTotals(
      uid,
      reminderGoalExerciseIds(planDay.day),
      today
    );
    const goal = planGoalFromTotals(
      planDay.day,
      planDay.dayIndex,
      planData?.['completedItems'] as string[] | undefined,
      totals,
      today
    );
    if (goal) return goal;
  }

  if (configuredDailyGoal(userConfigData) <= 0) return null;
  const totals = await readDailyTotals(
    uid,
    [PUSHUP_QUICK_ADD_EXERCISE_ID],
    today
  );
  return dailyGoalFromTotals(
    userConfigData,
    totals.get(PUSHUP_QUICK_ADD_EXERCISE_ID) ?? 0
  );
}
