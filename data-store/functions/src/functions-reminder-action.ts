import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './firebase-app';
import {
  decideReminderAction,
  parseReminderActionRequest,
  type PendingReminderAction,
  type ReminderActionRejection,
} from './push/reminder-action';

/**
 * Completes a reminder notification action on behalf of the push service
 * worker. Unauthenticated by design — the SW has no Firebase session — so
 * the single-use token issued with the reminder is the credential. Verify,
 * consume and write share one transaction: a second tap with the same token
 * (or a replayed request) finds nothing pending and is refused.
 */
export const reminderAction = onCall(
  { region: 'europe-west3' },
  async (request) => {
    const parsed = parseReminderActionRequest(request.data);
    if (!parsed) {
      throw new HttpsError('invalid-argument', 'Ungültige Aktion.');
    }

    const dispatchRef = db.collection('reminderDispatchState').doc(parsed.uid);
    const configRef = db.collection('userConfigs').doc(parsed.uid);
    const nowMs = Date.now();

    const decision = await db.runTransaction(async (tx) => {
      const [dispatchSnap, configSnap] = await tx.getAll(
        dispatchRef,
        configRef
      );
      const pending = dispatchSnap.data()?.['pendingAction'] as
        PendingReminderAction | undefined;
      const timezone = (
        configSnap.data()?.['reminder'] as { timezone?: string } | undefined
      )?.timezone;

      const result = decideReminderAction(parsed, pending, timezone, nowMs);
      if (!result.ok) return result;

      const statePatch: Record<string, unknown> = {
        uid: parsed.uid,
        pendingAction: FieldValue.delete(),
      };
      tx.set(db.collection('exerciseEntries').doc(), result.entry);
      tx.set(dispatchRef, statePatch, { merge: true });
      return result;
    });

    if (!decision.ok) {
      logger.warn('reminderAction: refused', {
        uid: parsed.uid,
        action: parsed.action,
        reason: decision.reason,
      });
      throw new HttpsError(rejectionCode(decision.reason), decision.reason);
    }

    logger.info('reminderAction', { uid: parsed.uid, action: decision.action });
    return { ok: true, action: 'quick-log', reps: decision.reps };
  }
);

function rejectionCode(
  reason: ReminderActionRejection
): 'permission-denied' | 'failed-precondition' {
  return reason === 'quick-log-not-offered'
    ? 'failed-precondition'
    : 'permission-denied';
}
