import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { validateSetMigrationStatusPayload } from './admin';
import { db } from './firebase-app';
import { assertAdmin } from './functions-admin';

const MIGRATION_STATUS_COLLECTION = 'migrationStatus';

export const getMigrationStatuses = onCall(
  { region: 'europe-west3' },
  async (request) => {
    assertAdmin(request);
    const snap = await db.collection(MIGRATION_STATUS_COLLECTION).get();
    const statuses: Record<
      string,
      { completed: boolean; completedAt: string | null; completedBy: string }
    > = {};
    for (const doc of snap.docs) {
      const data = doc.data();
      statuses[doc.id] = {
        completed: Boolean(data.completed),
        completedAt: (data.completedAt as string | null) ?? null,
        completedBy: (data.completedBy as string) ?? '',
      };
    }
    return { statuses };
  }
);

export const setMigrationStatus = onCall(
  { region: 'europe-west3' },
  async (request) => {
    assertAdmin(request);

    const validation = validateSetMigrationStatusPayload(request.data);
    if (!validation.valid || !validation.id) {
      throw new HttpsError('invalid-argument', validation.error ?? 'invalid');
    }

    const nowIso = new Date().toISOString();
    const completed = validation.completed === true;
    const doc = {
      completed,
      completedAt: completed ? nowIso : null,
      completedBy: completed ? (request.auth?.uid ?? '') : '',
    };
    await db
      .collection(MIGRATION_STATUS_COLLECTION)
      .doc(validation.id)
      .set(doc);

    logger.info('setMigrationStatus', {
      id: validation.id,
      completed,
      by: request.auth?.uid,
    });
    return { id: validation.id, ...doc };
  }
);
