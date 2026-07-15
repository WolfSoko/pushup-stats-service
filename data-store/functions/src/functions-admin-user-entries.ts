import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  findExerciseDefinition,
  validateExerciseEntry,
} from '@pu-stats/models';

import {
  type AdminEntryPatch,
  validateListUserEntriesPayload,
  validateUpdateUserEntryPayload,
} from './admin/user-entries';
import { db } from './firebase-app';
import { assertAdmin } from './functions-admin';

const EXERCISE_ENTRIES_COLLECTION = 'exerciseEntries';

// Admin-only read of a single user's exercise history. The Firestore
// rules scope client reads to `userId == request.auth.uid`, so the
// dashboard's per-user drill-down can't query this collection directly —
// it goes through the Admin SDK here. Returns the newest `limit` entries,
// newest first, so a user with a huge history never materialises unbounded.
//
// Uses `orderBy(timestamp, asc).limitToLast(limit)` + a client-side
// reverse rather than `orderBy(desc)`: the only declared composite index
// is `(userId ASC, timestamp ASC)`, which serves this in its native
// direction. A `desc` order would need a separate descending index and
// otherwise fail with FAILED_PRECONDITION in production. Same trick the
// `updateAdminUserActivityOnEntryWrite` trigger uses to read the max
// timestamp.
export const adminListUserEntries = onCall(
  { region: 'europe-west3', timeoutSeconds: 60 },
  async (request) => {
    assertAdmin(request);

    const result = validateListUserEntriesPayload(request.data);
    if (!result.valid) {
      throw new HttpsError('invalid-argument', result.error);
    }
    const { uid, limit } = result;

    const snap = await db
      .collection(EXERCISE_ENTRIES_COLLECTION)
      .where('userId', '==', uid)
      .orderBy('timestamp', 'asc')
      .limitToLast(limit)
      .get();

    return snap.docs.reverse().map((doc) => ({ _id: doc.id, ...doc.data() }));
  }
);

// Translate an admin entry patch into a Firestore update map. Cleared
// breakdowns (`[]`) and a cleared variant (`null`) map to `deleteField()`
// so the doc actually drops the stale value instead of silently keeping
// it — mirrors `ExerciseFirestoreService.updateEntry`.
function buildEntryUpdate(patch: AdminEntryPatch): Record<string, unknown> {
  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (patch.timestamp !== undefined) update.timestamp = patch.timestamp;
  for (const f of ['reps', 'durationSec', 'distanceM', 'weightKg'] as const) {
    if (patch[f] !== undefined) update[f] = patch[f];
  }
  for (const f of ['sets', 'intervals'] as const) {
    const v = patch[f];
    if (v === undefined) continue;
    update[f] = v.length === 0 ? admin.firestore.FieldValue.delete() : v;
  }
  if (patch.variantId !== undefined) {
    update.variantId =
      patch.variantId === null || patch.variantId === ''
        ? admin.firestore.FieldValue.delete()
        : patch.variantId;
  }
  return update;
}

// Admin-only patch of a single user's exercise entry. Verifies the entry
// belongs to `uid` (so a stale/foreign entryId can't be edited), then
// runs the same catalog-backed validation the client path uses before
// writing. The `exerciseId` stays immutable — enforced in the payload
// validator. The `updateExerciseStatsOnEntryWrite` and
// `updateAdminUserActivityOnEntryWrite` triggers keep aggregates current.
export const adminUpdateUserEntry = onCall(
  { region: 'europe-west3', timeoutSeconds: 60 },
  async (request) => {
    assertAdmin(request);

    const result = validateUpdateUserEntryPayload(request.data);
    if (!result.valid) {
      throw new HttpsError('invalid-argument', result.error);
    }
    const { uid, entryId, patch } = result;

    const ref = db.collection(EXERCISE_ENTRIES_COLLECTION).doc(entryId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Eintrag nicht gefunden.');
    }
    const data = snap.data() ?? {};
    if (data.userId !== uid) {
      throw new HttpsError(
        'failed-precondition',
        'Eintrag gehört nicht zu diesem Benutzer.'
      );
    }

    const def = findExerciseDefinition(String(data.exerciseId));
    if (!def) {
      throw new HttpsError('failed-precondition', 'Unbekannte Übung.');
    }
    const violation = validateExerciseEntry(patch, def, { partial: true });
    if (violation) {
      throw new HttpsError('invalid-argument', violation);
    }

    await ref.update(buildEntryUpdate(patch));

    logger.info('adminUpdateUserEntry', {
      uid,
      entryId,
      by: request.auth?.uid,
    });
    return { ok: true };
  }
);
