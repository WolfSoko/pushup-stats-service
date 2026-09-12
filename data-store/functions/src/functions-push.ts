import { shouldPauseForReachedGoal } from '@pu-stats/models';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { berlinDateParts } from './datetime';
import { db, TZ } from './firebase-app';
import type { ReminderConfig } from './push';
import {
  buildNotificationPayload,
  buildReminderPushPayload,
  isLeaseStale,
  loadMotivationPool,
  loadReminderGoal,
  newReminderActionToken,
  pushSubscriptionId,
  PUSH_SEND_OPTIONS,
  reminderActionUrl,
  sanitizeQuickLogReps,
  shouldSendReminder,
  STALE_LEASE_MS,
  validateSubscriptionPayload,
} from './push';
import { sendToSubscriptions } from './push/deliver';
import { logFailedSends } from './push/deliver-user';
import { pushLocaleFromConfig } from './push/user-locale';
import { configureWebPush, VAPID_SECRETS } from './push/vapid';

export async function deleteAllPushSubscriptions(uid: string) {
  const userRef = db.collection('pushSubscriptions').doc(uid);
  const subs = await userRef.collection('subs').listDocuments();
  const batch = db.batch();
  subs.forEach((doc) => batch.delete(doc));
  batch.delete(userRef);
  await batch.commit();
  logger.info('deleteAllPushSubscriptions: cleaned up', {
    uid,
    count: subs.length,
  });
}

export const savePushSubscription = onCall(
  { region: 'europe-west3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
    }

    const uid = request.auth.uid;
    const { endpoint, keys, userAgent, locale } = request.data ?? {};

    const validation = validateSubscriptionPayload(request.data);
    if (!validation.valid) {
      logger.warn('savePushSubscription: rejected', {
        uid,
        reason: validation.error,
      });
      throw new HttpsError(
        'invalid-argument',
        validation.error ?? 'subscription invalid'
      );
    }

    const subId = pushSubscriptionId(endpoint);

    const now = new Date().toISOString();
    const ref = db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('subs')
      .doc(subId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      tx.set(
        ref,
        {
          endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
          userAgent: userAgent || null,
          locale: locale || null,
          updatedAt: now,
          ...(snap.data()?.createdAt ? {} : { createdAt: now }),
        },
        { merge: true }
      );
    });

    const allSubs = await db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('subs')
      .count()
      .get();
    const deviceCount = allSubs.data().count;

    logger.info('savePushSubscription: saved', { uid, subId, deviceCount });
    return { ok: true, subId, deviceCount };
  }
);

export const deletePushSubscription = onCall(
  { region: 'europe-west3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
    }

    const uid = request.auth.uid;
    const { endpoint } = request.data ?? {};

    if (!endpoint || typeof endpoint !== 'string') {
      throw new HttpsError('invalid-argument', 'endpoint fehlt.');
    }

    const subId = pushSubscriptionId(endpoint);

    await db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('subs')
      .doc(subId)
      .delete();

    const remainingSubs = await db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('subs')
      .count()
      .get();
    const deviceCount = remainingSubs.data().count;

    logger.info('deletePushSubscription: removed', { uid, subId, deviceCount });
    return { ok: true, deviceCount };
  }
);

// Removes every push subscription registered against the caller's UID (across
// all devices). The caller stays signed in — this only wipes push records so
// no further Web Push notifications are delivered to any device.
async function handleUnsubscribeAllPushDevices(
  auth: { uid?: string } | undefined,
  callableName: string
): Promise<{ ok: true }> {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
  }
  const uid = auth.uid;
  await deleteAllPushSubscriptions(uid);
  logger.info(`${callableName}: cleaned up`, { uid });
  return { ok: true };
}

export const unsubscribeAllPushDevices = onCall(
  { region: 'europe-west3' },
  (request) =>
    handleUnsubscribeAllPushDevices(request.auth, 'unsubscribeAllPushDevices')
);

// Earlier versions of this callable also called `auth().revokeRefreshTokens`,
// which logged the user out of every device. That behavior was wrong for the
// reminder-page action (users just wanted to drop push subs). The callable is
// kept here purely as a backwards-compatible alias for clients that still
// have the old handler name bundled (cached browser builds pre-refactor); it
// now performs the same safe push-only cleanup as `unsubscribeAllPushDevices`
// and no longer revokes tokens. Can be removed once those clients are gone.
export const revokeAllSessions = onCall({ region: 'europe-west3' }, (request) =>
  handleUnsubscribeAllPushDevices(request.auth, 'revokeAllSessions')
);

export const dispatchPushReminders = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: TZ,
    region: 'europe-west3',
    secrets: VAPID_SECRETS,
  },
  async () => {
    if (!configureWebPush()) {
      logger.warn('dispatchPushReminders: VAPID secrets not set, skipping');
      return;
    }

    const nowMs = Date.now();

    const subsSnap = await db.collection('pushSubscriptions').listDocuments();
    logger.info('dispatchPushReminders: checking users', {
      count: subsSnap.length,
    });

    const results = { sent: 0, skipped: 0, errors: 0, expired: 0 };

    for (const userRef of subsSnap) {
      const uid = userRef.id;

      try {
        const userConfigSnap = await db
          .collection('userConfigs')
          .doc(uid)
          .get();
        const userConfigData = userConfigSnap.data() ?? {};
        const reminder = userConfigData.reminder as
          Partial<ReminderConfig> | undefined;
        const userLocale = pushLocaleFromConfig(userConfigData);

        const dispatchRef = db.collection('reminderDispatchState').doc(uid);
        let leaseAcquired = false;

        await db.runTransaction(async (tx) => {
          const dispatchSnap = await tx.get(dispatchRef);
          const lastSentAt = dispatchSnap.data()?.lastSentAt || null;
          const alreadyInProgress = dispatchSnap.data()?.inProgress === true;

          if (alreadyInProgress) {
            const leaseAcquiredAt =
              dispatchSnap.data()?.leaseAcquiredAt ?? null;
            if (!isLeaseStale(leaseAcquiredAt, nowMs)) {
              return; // Lease is fresh — another invocation is actively sending
            }
            logger.warn(
              'dispatchPushReminders: stale lease detected, resetting',
              {
                uid,
                staleLimitMinutes: STALE_LEASE_MS / 60_000,
              }
            );
            // Clear the stale lease so it doesn't repeat the warning every tick
            // even when shouldSendReminder returns false (quiet hours, etc.)
            tx.set(
              dispatchRef,
              {
                inProgress: false,
                leaseAcquiredAt: FieldValue.delete(),
              },
              { merge: true }
            );
          }
          if (!shouldSendReminder(reminder, lastSentAt, nowMs)) return;

          tx.set(
            dispatchRef,
            {
              uid,
              inProgress: true,
              leaseAcquiredAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          leaseAcquired = true;
        });

        if (!leaseAcquired) {
          results.skipped++;
          continue;
        }

        let sentToUser = false;
        // Declared outside the try so the lease-release `finally` can persist
        // the token the payload carried; both are set before the first send.
        let actionToken: string | null = null;
        let quickLogReps: number | undefined;
        try {
          const subsCol = await userRef.collection('subs').get();
          if (subsCol.empty) {
            results.skipped++;
            continue;
          }

          // The goal the reminder is about — today's plan day, else the
          // configured daily goal. Read only once a send is actually due,
          // so a user inside their interval or in quiet hours costs
          // nothing extra.
          const goal = await loadReminderGoal(
            uid,
            userConfigData,
            berlinDateParts(new Date(nowMs)).isoDate
          );
          if (shouldPauseForReachedGoal(reminder, goal)) {
            results.skipped++;
            continue;
          }

          // Pull the body from the user's pre-generated motivation pool —
          // that pool is locale-aware (`generateMotivationQuotes` writes
          // `motivationQuotes/{uid}__{lang}`) and the Gemini cost is
          // already paid when the user opens the dashboard, so we get
          // fresh, personalised quotes on push without spending any new
          // tokens. Fallback to the per-locale built-in list if the cache
          // is empty (user hasn't opened the app yet today).
          const pool = await loadMotivationPool(uid, userLocale);
          // Single source of truth: sanitize once, then use the same value for
          // both the action title and the data payload. Computing them
          // independently caused the title to clamp to 500 while the payload
          // shipped the raw (potentially absurd) Firestore value, so the SW
          // logged a different count than the user saw on the button.
          quickLogReps = sanitizeQuickLogReps(reminder?.quickLogReps);
          // One token per dispatch, shared by all of the user's devices and
          // persisted below once a push went out. The SW hands it back to
          // `reminderAction`; the server decides what "quick-log" means from
          // `pendingAction.quickLogReps`, never from the notification.
          actionToken = newReminderActionToken();
          const payload = buildReminderPushPayload({
            uid,
            locale: userLocale,
            quote: buildNotificationPayload(userLocale, pool),
            goal,
            quickLogReps,
            actionToken,
            actionUrl: reminderActionUrl(),
          });

          const delivery = await sendToSubscriptions(
            subsCol.docs.map((doc) => ({ key: doc.ref, data: doc.data() })),
            payload,
            PUSH_SEND_OPTIONS
          );
          sentToUser = delivery.sent > 0;
          logFailedSends('dispatchPushReminders', uid, delivery.failed);
          results.errors += delivery.failed.length;
          results.expired += delivery.expired.length;

          if (delivery.expired.length > 0) {
            const batch = db.batch();
            delivery.expired.forEach((ref) => batch.delete(ref));
            await batch.commit();
          }

          if (sentToUser) {
            results.sent++;
          }
        } finally {
          // Release lease and update lastSentAt atomically so a failed
          // lastSentAt write can't leave the lease open for duplicate sends.
          const releaseData: Record<string, unknown> = {
            inProgress: false,
            leaseAcquiredAt: FieldValue.delete(),
          };
          if (sentToUser && actionToken) {
            releaseData['lastSentAt'] = FieldValue.serverTimestamp();
            releaseData['pendingAction'] = {
              token: actionToken,
              issuedAt: FieldValue.serverTimestamp(),
              ...(quickLogReps ? { quickLogReps } : {}),
            };
          }
          await dispatchRef
            .set(releaseData, { merge: true })
            .catch((e: Error) =>
              logger.warn('dispatchPushReminders: failed to release lease', {
                uid,
                err: e.message,
              })
            );
        }
      } catch (err: unknown) {
        const error = err as Error;
        logger.error('dispatchPushReminders: error for user', {
          uid,
          err: error.message,
        });
        results.errors++;
      }
    }

    logger.info('dispatchPushReminders: done', results);
  }
);
