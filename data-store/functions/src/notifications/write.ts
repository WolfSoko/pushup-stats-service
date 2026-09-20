import { logger } from 'firebase-functions';
import {
  notificationDocId,
  type NotificationIdInput,
  type UserNotification,
} from '@pu-stats/models';

import { db } from '../firebase-app';
import { notificationDoc } from './logic';

/**
 * Firestore side of the message inbox. The collection is Admin-SDK-only
 * except for `readAt`, so every entry is written here.
 */

export function notificationRef(
  uid: string,
  idInput: NotificationIdInput
): FirebaseFirestore.DocumentReference {
  // `inbox` rather than a generic name like `items`: the TTL policy in
  // `firestore.indexes.json` is declared per collection *group*, so a
  // second subcollection sharing the name would silently inherit it.
  const inbox = db.collection('notifications').doc(uid).collection('inbox');
  const id = notificationDocId(idInput);
  return id ? inbox.doc(id) : inbox.doc();
}

/**
 * Files one entry, best-effort: a failure is logged and swallowed. What
 * feeds the inbox is someone's actual action — accepting a friendship,
 * sharing a workout — and none of those should fail because the
 * notification about them could not be stored.
 *
 * Callers that already run a batch (`sendCheer`) skip this and use
 * `notificationRef` / `notificationDoc` directly, so the entry commits
 * atomically with the event itself.
 */
export async function writeNotification(
  uid: string,
  idInput: NotificationIdInput,
  notification: UserNotification
): Promise<void> {
  try {
    await notificationRef(uid, idInput).set(
      notificationDoc(notification, Date.now())
    );
  } catch (err: unknown) {
    logger.error('writeNotification failed', {
      uid,
      type: notification.type,
      err,
    });
  }
}
