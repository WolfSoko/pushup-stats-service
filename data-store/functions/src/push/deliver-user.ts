import { logger } from 'firebase-functions';
import type { ReminderLocale } from '@pu-stats/models';

import { db } from '../firebase-app';
import {
  sendToSubscriptions,
  type FailedSend,
  type PushSendOptions,
} from './deliver';
import { pushLocaleFromConfig } from './user-locale';

/**
 * Firestore side of a one-off push to a user: every device they registered,
 * expired ones dropped on the way. The caller has already called
 * `configureWebPush()`.
 */
export async function deliverPushToUser(
  uid: string,
  payload: string,
  options: PushSendOptions,
  label: string
): Promise<{ sent: number }> {
  const subsCol = await db
    .collection('pushSubscriptions')
    .doc(uid)
    .collection('subs')
    .get();
  if (subsCol.empty) return { sent: 0 };

  const result = await sendToSubscriptions(
    subsCol.docs.map((doc) => ({ key: doc.ref, data: doc.data() })),
    payload,
    options
  );

  if (result.expired.length > 0) {
    const batch = db.batch();
    result.expired.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  logFailedSends(label, uid, result.failed);
  logger.info(`${label}: delivered`, {
    uid,
    sent: result.sent,
    expired: result.expired.length,
    failed: result.failed.length,
  });
  return { sent: result.sent };
}

/** One line per failure, message and code next to the status, so the
 * next unknown failure mode is diagnosable without a second investigation. */
export function logFailedSends(
  label: string,
  uid: string,
  failed: ReadonlyArray<FailedSend>
): void {
  for (const failure of failed) {
    logger.warn(`${label}: send failed`, { uid, ...failure });
  }
}

export interface PushRecipient {
  readonly locale: ReminderLocale;
  readonly displayName: string | null;
}

/** What a notification about or for this user needs from their config. */
export async function readPushRecipients(
  uids: ReadonlyArray<string>
): Promise<Map<string, PushRecipient>> {
  const recipients = new Map<string, PushRecipient>();
  if (uids.length === 0) return recipients;
  const col = db.collection('userConfigs');
  const snaps = await db.getAll(...uids.map((uid) => col.doc(uid)));
  for (const snap of snaps) {
    const data = snap.data();
    recipients.set(snap.id, {
      locale: pushLocaleFromConfig(data),
      displayName: String(data?.['displayName'] ?? '').trim() || null,
    });
  }
  return recipients;
}
