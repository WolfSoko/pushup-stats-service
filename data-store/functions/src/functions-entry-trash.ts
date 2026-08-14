import * as admin from 'firebase-admin';
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { db } from './firebase-app';
import { buildTrashRecord, TRASH_COLLECTION } from './entry-trash/logic';

/**
 * Archives every deleted `exerciseEntries` document into the trash bin.
 *
 * Sits on the delete trigger rather than in the client's delete call so it
 * covers all paths — the entries page, the training-plan reset, the admin
 * entry-delete callable and any Admin-SDK cleanup — and cannot be skipped
 * by a client that talks to Firestore directly.
 *
 * The archive doc reuses the entry id, which makes the write idempotent:
 * a retried trigger invocation (Firestore delivers at-least-once) rewrites
 * the same document instead of stacking duplicates.
 */
export const archiveDeletedExerciseEntry = onDocumentDeleted(
  {
    document: 'exerciseEntries/{entryId}',
    region: 'europe-west3',
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      logger.warn('archiveDeletedExerciseEntry: no snapshot data, skipping', {
        entryId: event.params.entryId,
      });
      return;
    }

    const { deletedAtMs, expiresAtMs, ...record } = buildTrashRecord(
      event.params.entryId,
      data,
      Date.now()
    );

    await db
      .collection(TRASH_COLLECTION)
      .doc(event.params.entryId)
      .set({
        ...record,
        deletedAt: admin.firestore.Timestamp.fromMillis(deletedAtMs),
        expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
      });
  }
);
