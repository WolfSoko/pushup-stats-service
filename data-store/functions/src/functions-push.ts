import { normalizeReminderLocale } from '@pu-stats/models';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import webpush from 'web-push';

import { db, TZ } from './firebase-app';
import { flattenTiers, type TieredQuotes } from './motivation';
import type { ReminderConfig } from './push';
import {
  buildNotificationPayload,
  buildReminderActions,
  isExpiredSubscriptionError,
  isLeaseStale,
  pushSubscriptionId,
  PUSH_SEND_OPTIONS,
  sanitizeQuickLogReps,
  shouldSendReminder,
  STALE_LEASE_MS,
  validateSubscriptionPayload,
} from './push';

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

const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = defineSecret('VAPID_PUBLIC_KEY');

/**
 * Reads the cached motivation pool a user has for `lang` and returns a
 * flat list of quote strings. Tolerant of legacy doc shapes (flat
 * `quotes: string[]` / `quotes: {text}[]`) and the new tiered shape.
 * Returns an empty array on any error so the caller falls back to the
 * built-in localised messages.
 */
async function loadMotivationPool(
  uid: string,
  lang: string
): Promise<string[]> {
  try {
    const snap = await db
      .collection('motivationQuotes')
      .doc(`${uid}__${lang}`)
      .get();
    if (!snap.exists) return [];
    const data = snap.data() as
      | {
          tiers?: TieredQuotes;
          quotes?: ReadonlyArray<unknown>;
        }
      | undefined;
    if (!data) return [];
    if (data.tiers) return flattenTiers(data.tiers);
    if (Array.isArray(data.quotes)) {
      return data.quotes
        .map((q) =>
          typeof q === 'string'
            ? q
            : typeof q === 'object' && q !== null && 'text' in q
              ? String((q as { text?: unknown }).text ?? '')
              : String(q ?? '')
        )
        .filter((q) => q.trim().length > 0);
    }
    return [];
  } catch (err) {
    // Defensive against non-Error throws (string, null, etc.) — we don't
    // want the logger itself to throw and surface as an unhandled
    // rejection in the dispatch loop.
    logger.warn('loadMotivationPool: failed', {
      uid,
      lang,
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export const dispatchPushReminders = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: TZ,
    region: 'europe-west3',
    secrets: [VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY],
  },
  async () => {
    const vapidPrivate = VAPID_PRIVATE_KEY.value().trim();
    const vapidPublic = VAPID_PUBLIC_KEY.value().trim();

    if (!vapidPrivate || !vapidPublic) {
      logger.warn('dispatchPushReminders: VAPID secrets not set, skipping');
      return;
    }

    webpush.setVapidDetails(
      'mailto:einstein-openclaw@gmail.com',
      vapidPublic,
      vapidPrivate
    );

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
          | Partial<ReminderConfig>
          | undefined;
        // Prefer the explicit top-level `locale` written by recent clients.
        // Fall back to the legacy `reminder.language` field on docs created
        // before that field migrated up — without this, a user who set
        // English reminders and never re-saved settings would silently
        // start receiving German push body / actions / URLs after deploy.
        // Final fallback (`undefined`) lands on the default locale via
        // `normalizeReminderLocale`.
        const legacyLanguage = (reminder as { language?: unknown } | undefined)
          ?.language;
        const userLocale = normalizeReminderLocale(
          userConfigData.locale ?? legacyLanguage
        );

        const dispatchRef = db.collection('reminderDispatchState').doc(uid);
        let leaseAcquired = false;

        await db.runTransaction(async (tx) => {
          const dispatchSnap = await tx.get(dispatchRef);
          const lastSentAt = dispatchSnap.data()?.lastSentAt || null;
          const snoozedUntil = dispatchSnap.data()?.snoozedUntil || null;
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
                leaseAcquiredAt: admin.firestore.FieldValue.delete(),
              },
              { merge: true }
            );
          }
          if (!shouldSendReminder(reminder, lastSentAt, nowMs, snoozedUntil))
            return;

          tx.set(
            dispatchRef,
            {
              uid,
              inProgress: true,
              leaseAcquiredAt: admin.firestore.FieldValue.serverTimestamp(),
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
        try {
          const subsCol = await userRef.collection('subs').get();
          if (subsCol.empty) {
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
          const body = buildNotificationPayload(userLocale, pool);
          // Single source of truth: sanitize once, then use the same value for
          // both the action title and the data payload. Computing them
          // independently caused the title to clamp to 500 while the payload
          // shipped the raw (potentially absurd) Firestore value, so the SW
          // logged a different count than the user saw on the button.
          const quickLogReps = sanitizeQuickLogReps(reminder?.quickLogReps);
          const actions = buildReminderActions(userLocale, quickLogReps);
          const payload = JSON.stringify({
            title: 'PushUp Stats',
            body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            tag: 'reminder',
            renotify: true,
            data: {
              url: `/${userLocale}/app`,
              locale: userLocale,
              ...(quickLogReps ? { quickLogReps } : {}),
            },
            actions,
          });

          const expiredSubs: FirebaseFirestore.DocumentReference[] = [];

          for (const subDoc of subsCol.docs) {
            const { endpoint, keys } = subDoc.data();
            if (!endpoint || !keys?.p256dh || !keys?.auth) continue;

            const pushSub = {
              endpoint,
              keys: { p256dh: keys.p256dh, auth: keys.auth },
            };

            try {
              await webpush.sendNotification(
                pushSub,
                payload,
                PUSH_SEND_OPTIONS
              );
              sentToUser = true;
            } catch (err: unknown) {
              const pushErr = err as {
                statusCode?: number;
                code?: string;
                message?: string;
              };
              if (isExpiredSubscriptionError(pushErr, endpoint)) {
                expiredSubs.push(subDoc.ref);
                results.expired++;
              } else {
                // Log message+code alongside status so the next unknown
                // failure mode (e.g. the zombie `.invalid` endpoints that
                // silently DNS-failed for weeks) is diagnosable in one
                // dispatch cycle instead of needing a separate investigation.
                logger.warn('dispatchPushReminders: send failed', {
                  uid,
                  endpoint: endpoint.slice(-20),
                  status: pushErr.statusCode,
                  code: pushErr.code,
                  message: pushErr.message,
                });
                results.errors++;
              }
            }
          }

          if (expiredSubs.length > 0) {
            const batch = db.batch();
            expiredSubs.forEach((ref) => batch.delete(ref));
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
            leaseAcquiredAt: admin.firestore.FieldValue.delete(),
          };
          if (sentToUser) {
            releaseData['lastSentAt'] =
              admin.firestore.FieldValue.serverTimestamp();
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

export const snoozeReminder = onCall(
  { region: 'europe-west3' },
  async (request) => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', 'Auth required.');

    const uid = request.auth.uid;
    const snoozeMinutes = request.data?.snoozeMinutes ?? 30;

    if (
      typeof snoozeMinutes !== 'number' ||
      snoozeMinutes < 1 ||
      snoozeMinutes > 1440
    ) {
      throw new HttpsError('invalid-argument', 'snoozeMinutes must be 1–1440.');
    }

    const snoozeMs = snoozeMinutes * 60 * 1000;
    const snoozeUntil = admin.firestore.Timestamp.fromMillis(
      Date.now() + snoozeMs
    );

    const dispatchRef = db.collection('reminderDispatchState').doc(uid);
    await dispatchRef.set(
      {
        snoozedUntil: snoozeUntil,
        uid,
        snoozedAt: admin.firestore.FieldValue.serverTimestamp(),
        snoozeMinutes,
        inProgress: false,
      },
      { merge: true }
    );

    logger.info('snoozeReminder', { uid, snoozeMinutes });
    return { ok: true, snoozeUntil: snoozeUntil.toDate().toISOString() };
  }
);
