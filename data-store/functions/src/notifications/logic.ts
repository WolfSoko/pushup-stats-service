import { Timestamp } from 'firebase-admin/firestore';
import {
  NOTIFICATION_RETENTION_MS,
  type UserNotification,
} from '@pu-stats/models';

/**
 * Pure side of the message inbox: what a stored entry looks like. Kept
 * out of `write.ts` so it is testable without pulling in `firebase-app`,
 * which initialises Sentry and the Admin SDK on import.
 */
export function notificationDoc(
  notification: UserNotification,
  nowMs: number
): FirebaseFirestore.DocumentData {
  return {
    ...notification,
    // A real Timestamp, not an ISO string: the TTL policy only reads
    // timestamp fields and silently ignores anything else.
    expiresAt: Timestamp.fromMillis(nowMs + NOTIFICATION_RETENTION_MS),
  };
}
