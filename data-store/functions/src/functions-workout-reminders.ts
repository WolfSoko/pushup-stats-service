import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { db, TZ } from './firebase-app';
import { deliverPushToUser } from './push/deliver-user';
import { pushLocaleFromConfig } from './push/user-locale';
import { configureWebPush, VAPID_SECRETS } from './push/vapid';
import { decideWorkoutReminder } from './workouts/reminder-dispatch';
import {
  buildWorkoutReminderPayload,
  workoutReminderPushOptions,
} from './workouts/reminder-push';

const REMINDERS = 'workoutReminders';
const BATCH_LIMIT = 500;

type Outcome = 'sent' | 'advanced' | 'disabled' | 'orphaned' | 'skipped';

/**
 * Claims one occurrence: `nextAt` moves on inside a transaction before
 * anything is sent, so an overlapping tick finds nothing due and a
 * reminder goes out at most once. A failed send is lost rather than
 * repeated — a duplicate reminder is worse than a missed one.
 */
async function claim(
  ref: FirebaseFirestore.DocumentReference,
  now: Date
): Promise<ReturnType<typeof decideWorkoutReminder>> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { action: 'wait' } as const;
    const decision = decideWorkoutReminder(snap.id, snap.data(), now);
    if (decision.action === 'disable') {
      tx.update(ref, { enabled: false });
    } else if (decision.action !== 'wait') {
      tx.update(ref, {
        nextAt: decision.nextAt,
        ...(decision.action === 'send'
          ? { lastSentAt: now.toISOString() }
          : {}),
      });
    }
    return decision;
  });
}

async function dispatchOne(
  ref: FirebaseFirestore.DocumentReference,
  now: Date
): Promise<Outcome> {
  const decision = await claim(ref, now);
  if (decision.action === 'wait') return 'skipped';
  if (decision.action === 'disable') return 'disabled';
  if (decision.action === 'advance') return 'advanced';

  const { reminder } = decision;
  const [workoutSnap, configSnap] = await Promise.all([
    db.collection('workouts').doc(reminder.workoutId).get(),
    db.collection('userConfigs').doc(reminder.ownerId).get(),
  ]);
  const workout = workoutSnap.data();
  // The client deletes the reminder with its workout; this catches the
  // one it missed (offline delete, account removed) for good.
  if (!workout || workout['ownerId'] !== reminder.ownerId) {
    await ref.delete();
    return 'orphaned';
  }
  const title = typeof workout['title'] === 'string' ? workout['title'] : '';
  await deliverPushToUser(
    reminder.ownerId,
    buildWorkoutReminderPayload({
      locale: pushLocaleFromConfig(configSnap.data()),
      workoutId: reminder.workoutId,
      title,
    }),
    workoutReminderPushOptions(reminder.workoutId, reminder.nextAt, now),
    'dispatchWorkoutReminders'
  );
  return 'sent';
}

/**
 * Session reminders: every 5 minutes, push each reminder whose `nextAt`
 * has come. The time is one the user picked for this session, so quiet
 * hours and the daily reminder's settings do not apply.
 */
export const dispatchWorkoutReminders = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: TZ,
    region: 'europe-west3',
    secrets: VAPID_SECRETS,
  },
  async () => {
    if (!configureWebPush()) {
      logger.warn('dispatchWorkoutReminders: VAPID secrets not set, skipping');
      return;
    }
    const due = await db
      .collection(REMINDERS)
      .where('enabled', '==', true)
      .where('nextAt', '<=', new Date().toISOString())
      .limit(BATCH_LIMIT)
      .get();

    const results: Record<Outcome | 'errors', number> = {
      sent: 0,
      advanced: 0,
      disabled: 0,
      orphaned: 0,
      skipped: 0,
      errors: 0,
    };
    for (const doc of due.docs) {
      try {
        // A fresh clock per reminder: a long batch must not judge the
        // grace window by the time the tick started.
        results[await dispatchOne(doc.ref, new Date())]++;
      } catch (err: unknown) {
        results.errors++;
        logger.error('dispatchWorkoutReminders: error for reminder', {
          id: doc.id,
          err: (err as Error).message,
        });
      }
    }
    logger.info('dispatchWorkoutReminders: done', {
      due: due.size,
      ...results,
    });
  }
);
