import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  findExerciseDefinition,
  validateExerciseEntry,
} from '@pu-stats/models';

import {
  type AdminEntryPatch,
  serializeEntry,
  validateListUserEntriesPayload,
  validateUpdateUserEntryPayload,
} from './admin/user-entries';
import { db } from './firebase-app';
import { assertAdmin } from './functions-admin';

const EXERCISE_ENTRIES_COLLECTION = 'exerciseEntries';
// Sentinel exercise id for pushup rows (they have no catalog definition).
const PUSHUP_EXERCISE_ID = 'pushup';

// Admin-only read of a single user's exercise history. The Firestore
// rules scope client reads to `userId == request.auth.uid`, so the
// dashboard's per-user drill-down can't query this collection directly —
// it goes through the Admin SDK here. Returns the newest `limit` entries,
// newest first, so a user with a huge history never materialises unbounded.
//
// `where('userId','==').orderBy('timestamp','desc')` needs the composite
// index `(userId ASC, timestamp DESC)` (declared in `firestore.indexes.json`);
// without it the query fails with FAILED_PRECONDITION. Note a `limitToLast`
// on an *ascending* order would need this exact same descending index —
// Firestore reverses the scan internally — so the ascending composite does
// not serve this query.
export const adminListUserEntries = onCall(
  { region: 'europe-west3', timeoutSeconds: 60 },
  async (request) => {
    assertAdmin(request);

    const result = validateListUserEntriesPayload(request.data);
    if (!result.valid) {
      throw new HttpsError('invalid-argument', result.error);
    }
    const { uid, limit } = result;

    try {
      const snap = await db
        .collection(EXERCISE_ENTRIES_COLLECTION)
        .where('userId', '==', uid)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snap.docs.map((doc) => serializeEntry(doc.id, doc.data()));
    } catch (err) {
      // Surface a clear, logged error instead of an opaque `internal`.
      // Log a string (stack when available), not the raw error, so a
      // non-serializable value can't make the log statement itself fail
      // while still preserving the most useful diagnostic detail.
      logger.error('adminListUserEntries failed', {
        uid,
        error: err instanceof Error ? (err.stack ?? err.message) : String(err),
      });
      throw new HttpsError(
        'internal',
        'Einträge konnten nicht geladen werden.'
      );
    }
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
  if (patch.source !== undefined) update.source = patch.source;
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

    // `source` is only meaningful for pushup rows (the shared dialog exposes it
    // there); never let it ride along on a catalog exercise update, even though
    // the payload schema accepts the field.
    if (
      patch.source !== undefined &&
      String(data.exerciseId) !== PUSHUP_EXERCISE_ID
    ) {
      delete patch.source;
    }

    // Only the measurement/variant fields need catalog validation. A
    // timestamp/source-only patch is allowed even for a stale exercise id
    // whose catalog entry was renamed/removed — the edit dialog offers exactly
    // that for such entries. Mirrors `ExerciseFirestoreService.updateEntry`,
    // which validates only when a value field actually changes. Pushup is a
    // first-class catalog exercise (`id: 'pushup'`), so it validates like any
    // other — reps bounds, variant, etc. — through the same path.
    const needsCatalog = (
      [
        'reps',
        'durationSec',
        'distanceM',
        'weightKg',
        'sets',
        'intervals',
        'variantId',
      ] as const
    ).some((k) => patch[k] !== undefined);
    if (needsCatalog) {
      const def = findExerciseDefinition(String(data.exerciseId));
      if (!def) {
        throw new HttpsError('failed-precondition', 'Unbekannte Übung.');
      }
      // `source` is not a catalog-validated field — validate only the
      // measurement/variant fields against the definition.
      const measurementPatch = { ...patch };
      delete measurementPatch.source;
      const violation = validateExerciseEntry(measurementPatch, def, {
        partial: true,
      });
      if (violation) {
        throw new HttpsError('invalid-argument', violation);
      }
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
