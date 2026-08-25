import { getAuth } from 'firebase-admin/auth';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import webpush from 'web-push';

import {
  type AndroidTestAccount,
  androidTestStatusPatch,
  buildAndroidTestInvitePayload,
  canBeAndroidTester,
  isAndroidTestCandidate,
  validateAndroidTestConfirmPayload,
  validateAndroidTesterAddedPayload,
  validateAndroidTestThresholdsPayload,
} from './android-test';
import { batchArray } from './admin';
import { assertAdmin } from './functions-admin';
import { readUserActivity } from './admin/user-data-ops';
import { db, DEMO_USER_ID } from './firebase-app';
import { isExpiredSubscriptionError, PUSH_SEND_OPTIONS } from './push';

interface AndroidTestState {
  status?: 'candidate' | 'confirmed' | 'declined' | 'optedIn' | 'notified';
}

/**
 * Scans every user's precomputed activity aggregate and stamps
 * `androidTest.status = 'candidate'` on engaged, still-active users that
 * don't have an `androidTest` status yet. Idempotent — never touches a doc
 * that already went through the confirm/decline/opt-in flow. Manually
 * triggered from the admin UI (this is a one-off recruitment pass, not a
 * recurring job, so no scheduler is wired up).
 */
export const adminComputeAndroidTestCandidates = onCall(
  { region: 'europe-west3', timeoutSeconds: 120 },
  async (request) => {
    assertAdmin(request);

    const thresholdResult = validateAndroidTestThresholdsPayload(request.data);
    if (!thresholdResult.valid) {
      throw new HttpsError('invalid-argument', thresholdResult.error);
    }
    const { thresholds } = thresholdResult;

    const accounts = new Map<string, AndroidTestAccount>();
    let pageToken: string | undefined;
    do {
      const result = await getAuth().listUsers(1000, pageToken);
      for (const user of result.users) {
        if (user.uid === DEMO_USER_ID) continue;
        accounts.set(user.uid, {
          anonymous: user.providerData.length === 0,
          email: user.email ?? null,
        });
      }
      pageToken = result.pageToken;
    } while (pageToken);

    // Ineligible accounts (anonymous / no email) can never become testers,
    // so they are dropped before the per-user activity and config reads —
    // on this app they are the bulk of the user base.
    const uids = [...accounts.keys()].filter((uid) =>
      canBeAndroidTester(accounts.get(uid) as AndroidTestAccount)
    );

    const activity = await readUserActivity(uids);
    const nowMs = Date.now();

    const configMap = new Map<string, AndroidTestState>();
    for (let i = 0; i < uids.length; i += 10) {
      const batch = uids.slice(i, i + 10);
      const snaps = await db
        .collection('userConfigs')
        .where(FieldPath.documentId(), 'in', batch)
        .get();
      for (const snap of snaps.docs) {
        configMap.set(
          snap.id,
          (snap.data().androidTest ?? {}) as AndroidTestState
        );
      }
    }

    const newCandidates = uids.filter(
      (uid) =>
        // already went through the flow — never re-stamp
        !configMap.get(uid)?.status &&
        isAndroidTestCandidate(
          accounts.get(uid) as AndroidTestAccount,
          activity.get(uid),
          nowMs,
          thresholds
        )
    );

    // Repair pass: an earlier version of this scan had no eligibility gate
    // and stamped anonymous accounts as candidates. They can never become
    // testers, so clear the stray marks instead of making the admin decline
    // each one by hand. Only untouched `candidate` marks are cleared — a
    // status an admin or the user already acted on is never discarded.
    const staleSnap = await db
      .collection('userConfigs')
      .where('androidTest.status', '==', 'candidate')
      .get();
    const staleUids = staleSnap.docs
      .map((doc) => doc.id)
      .filter((uid) => {
        const account = accounts.get(uid);
        // No account at all = deleted user; also worth clearing.
        return !account || !canBeAndroidTester(account);
      });
    for (const chunk of batchArray(staleUids, 500)) {
      const batch = db.batch();
      for (const uid of chunk) {
        batch.set(
          db.collection('userConfigs').doc(uid),
          { androidTest: FieldValue.delete() },
          { merge: true }
        );
      }
      await batch.commit();
    }

    const patch = androidTestStatusPatch('candidate', new Date().toISOString());
    // A Firestore write batch caps at 500 operations — chunk so a large
    // recruitment pass can't blow up mid-commit.
    for (const chunk of batchArray(newCandidates, 500)) {
      const batch = db.batch();
      for (const uid of chunk) {
        batch.set(db.collection('userConfigs').doc(uid), patch, {
          merge: true,
        });
      }
      await batch.commit();
    }
    const found = newCandidates.length;

    logger.info('adminComputeAndroidTestCandidates', {
      found,
      thresholds,
      cleaned: staleUids.length,
      eligible: uids.length,
      accounts: accounts.size,
      by: request.auth?.uid,
    });
    return { found, cleaned: staleUids.length };
  }
);

/**
 * Admin confirms or declines an auto-detected Android-test candidate.
 * Mirrors `adminSetLeaderboardExclusion`'s shape.
 */
export const adminConfirmAndroidTestCandidate = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    assertAdmin(request);

    const result = validateAndroidTestConfirmPayload(request.data);
    if (!result.valid) {
      throw new HttpsError('invalid-argument', result.error);
    }
    const { uid, confirmed } = result;

    // Also the entry point for adding a tester by hand (the admin UI's
    // manual picker calls this with an arbitrary uid), so eligibility is
    // enforced here rather than only in the scan — otherwise the manual
    // path could invite an account that can never be added in Play Console.
    // Declining stays unconditional: it must always be possible to clear a
    // mark, whatever the account looks like now.
    if (confirmed) {
      const user = await getAuth()
        .getUser(uid)
        .catch(() => null);
      if (!user) {
        throw new HttpsError('not-found', 'Benutzer nicht gefunden.');
      }
      if (
        !canBeAndroidTester({
          anonymous: user.providerData.length === 0,
          email: user.email ?? null,
        })
      ) {
        throw new HttpsError(
          'failed-precondition',
          'Account ohne E-Mail-Adresse kann nicht als Tester hinzugefügt werden.'
        );
      }
    }

    await db
      .collection('userConfigs')
      .doc(uid)
      .set(
        androidTestStatusPatch(
          confirmed ? 'confirmed' : 'declined',
          new Date().toISOString()
        ),
        { merge: true }
      );

    logger.info('adminConfirmAndroidTestCandidate', {
      uid,
      confirmed,
      by: request.auth?.uid,
    });
    return { ok: true, uid, confirmed };
  }
);

/**
 * User-initiated opt-in from the invite popup. Only a user whose own
 * `androidTest.status` is `'confirmed'` (i.e. an admin already approved
 * them as a candidate) may opt in — same auth-only, no-admin-check shape as
 * `snoozeReminder`.
 */
export const optInAndroidTest = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
    }
    const uid = request.auth.uid;

    const snap = await db.collection('userConfigs').doc(uid).get();
    const status = (snap.data()?.androidTest as AndroidTestState | undefined)
      ?.status;
    if (status !== 'confirmed') {
      throw new HttpsError(
        'failed-precondition',
        'Kein offenes Android-Test-Angebot für diesen Account.'
      );
    }

    await db
      .collection('userConfigs')
      .doc(uid)
      .set(androidTestStatusPatch('optedIn', new Date().toISOString()), {
        merge: true,
      });

    logger.info('optInAndroidTest', { uid });
    return { ok: true };
  }
);

const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = defineSecret('VAPID_PUBLIC_KEY');

/**
 * The single action the admin takes after manually pasting the opted-in
 * user's email into the Play Console closed-test tester list (the Play
 * Developer API only manages testers via Google Groups, not individual
 * emails — see `docs/android-test-program.md`): marks the user as notified
 * and sends the install-link push in one step, reusing the same
 * `webpush.sendNotification` + `PUSH_SEND_OPTIONS` call as
 * `dispatchPushReminders`. Returns `pushSent: false` (without failing) when
 * the user has no active push subscription, so the admin UI can prompt for
 * a manual follow-up instead of silently doing nothing.
 */
export const adminMarkAndroidTesterAdded = onCall(
  {
    region: 'europe-west3',
    timeoutSeconds: 30,
    secrets: [VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY],
  },
  async (request) => {
    assertAdmin(request);

    const result = validateAndroidTesterAddedPayload(request.data);
    if (!result.valid) {
      throw new HttpsError('invalid-argument', result.error);
    }
    const { uid } = result;

    const configSnap = await db.collection('userConfigs').doc(uid).get();
    const configData = configSnap.data() ?? {};
    const status = (configData.androidTest as AndroidTestState | undefined)
      ?.status;
    if (status !== 'optedIn') {
      throw new HttpsError(
        'failed-precondition',
        'Nutzer hat sich nicht für den Android-Test angemeldet.'
      );
    }

    const subsCol = await db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('subs')
      .get();

    let pushSent = false;
    if (!subsCol.empty) {
      const vapidPrivate = VAPID_PRIVATE_KEY.value().trim();
      const vapidPublic = VAPID_PUBLIC_KEY.value().trim();
      if (vapidPrivate && vapidPublic) {
        webpush.setVapidDetails(
          'mailto:einstein-openclaw@gmail.com',
          vapidPublic,
          vapidPrivate
        );
        const payload = buildAndroidTestInvitePayload(configData.locale);
        const expiredSubs: FirebaseFirestore.DocumentReference[] = [];
        for (const subDoc of subsCol.docs) {
          const { endpoint, keys } = subDoc.data();
          if (!endpoint || !keys?.p256dh || !keys?.auth) continue;
          try {
            await webpush.sendNotification(
              { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
              payload,
              PUSH_SEND_OPTIONS
            );
            pushSent = true;
          } catch (err: unknown) {
            const pushErr = err as { statusCode?: number; code?: string };
            if (isExpiredSubscriptionError(pushErr, endpoint)) {
              expiredSubs.push(subDoc.ref);
            } else {
              logger.warn('adminMarkAndroidTesterAdded: send failed', {
                uid,
                status: pushErr.statusCode,
                code: pushErr.code,
              });
            }
          }
        }
        if (expiredSubs.length > 0) {
          const batch = db.batch();
          expiredSubs.forEach((ref) => batch.delete(ref));
          await batch.commit();
        }
      } else {
        logger.warn(
          'adminMarkAndroidTesterAdded: VAPID secrets not set, skipping push'
        );
      }
    }

    await db
      .collection('userConfigs')
      .doc(uid)
      .set(androidTestStatusPatch('notified', new Date().toISOString()), {
        merge: true,
      });

    logger.info('adminMarkAndroidTesterAdded', {
      uid,
      pushSent,
      by: request.auth?.uid,
    });
    return { ok: true, uid, pushSent };
  }
);
