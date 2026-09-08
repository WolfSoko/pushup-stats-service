import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';

import { batchArray } from './admin';
import { db } from './firebase-app';
import { assertAdmin } from './functions-admin';
import {
  hasSnoozeState,
  SNOOZE_FIELDS,
  snoozeDeletionPatch,
} from './push/snooze-cleanup';

/**
 * One-off cleanup of the fields the retired reminder snooze left behind.
 *
 * `reminderDispatchState/{uid}` docs still carry `snoozedUntil`, `snoozedAt`
 * and `snoozeMinutes` from before the action was removed. Nothing reads them
 * any more — `shouldSendReminder` lost its snooze gate — so they are dead
 * weight that makes the documents read as if a feature were still there.
 */

const COLLECTION = 'reminderDispatchState';

const PAGE_SIZE = 500;
const BATCH_SIZE = 500;

/** Ids of docs still carrying at least one snooze field. */
async function findDocsWithSnoozeState(): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  for (;;) {
    let query = db
      .collection(COLLECTION)
      .select(...SNOOZE_FIELDS)
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (const doc of page.docs) {
      if (hasSnoozeState(doc.data())) ids.push(doc.id);
    }
    cursor = page.docs[page.docs.length - 1].id;
    if (page.size < PAGE_SIZE) break;
  }
  return ids;
}

/**
 * Strips the leftover snooze fields. Idempotent: a second run finds nothing
 * and reports zero. Defaults to a dry run — only an explicit `dryRun: false`
 * writes, matching the other migrations.
 */
export const cleanupReminderSnoozeState = onCall(
  { region: 'europe-west3', timeoutSeconds: 540 },
  async (request) => {
    assertAdmin(request);
    const dryRun = Boolean(request.data?.dryRun ?? true);

    const ids = await findDocsWithSnoozeState();

    if (dryRun) {
      return { dryRun: true, wouldClear: ids.length };
    }

    const patch = snoozeDeletionPatch(FieldValue.delete());
    let cleared = 0;
    for (const chunk of batchArray(ids, BATCH_SIZE)) {
      const batch = db.batch();
      for (const id of chunk) {
        batch.update(db.collection(COLLECTION).doc(id), patch);
        cleared += 1;
      }
      await batch.commit();
    }

    logger.info('cleanupReminderSnoozeState', {
      cleared,
      by: request.auth?.uid,
    });
    return { dryRun: false, cleared };
  }
);
