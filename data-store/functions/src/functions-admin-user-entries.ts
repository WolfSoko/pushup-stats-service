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

// The fields an admin entry row may carry. Projecting explicitly keeps the
// callable response strictly JSON-serializable — a stray Firestore
// `Timestamp`/`GeoPoint`/`DocumentReference` on a legacy doc would otherwise
// make the callable fail to encode and surface to the client as a generic
// `internal` error.
const ENTRY_STRING_FIELDS = [
  'userId',
  'exerciseId',
  'variantId',
  'source',
] as const;
const ENTRY_TS_FIELDS = ['timestamp', 'createdAt', 'updatedAt'] as const;
const ENTRY_NUMBER_FIELDS = [
  'reps',
  'durationSec',
  'distanceM',
  'weightKg',
] as const;
const ENTRY_ARRAY_FIELDS = ['sets', 'intervals'] as const;

// Coerce a Firestore timestamp-ish value to an ISO string: post-cutover docs
// store ISO strings already, but a legacy/migrated doc might carry a Firestore
// `Timestamp` (has `.toDate()`), which is not JSON-serializable as-is.
function toIsoString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  return undefined;
}

function serializeEntry(
  id: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const entry: Record<string, unknown> = { _id: id };
  for (const f of ENTRY_STRING_FIELDS) {
    if (typeof data[f] === 'string') entry[f] = data[f];
  }
  for (const f of ENTRY_TS_FIELDS) {
    const iso = toIsoString(data[f]);
    if (iso !== undefined) entry[f] = iso;
  }
  for (const f of ENTRY_NUMBER_FIELDS) {
    if (typeof data[f] === 'number') entry[f] = data[f];
  }
  for (const f of ENTRY_ARRAY_FIELDS) {
    if (Array.isArray(data[f])) {
      entry[f] = (data[f] as unknown[]).filter((n) => typeof n === 'number');
    }
  }
  return entry;
}

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

    try {
      const snap = await db
        .collection(EXERCISE_ENTRIES_COLLECTION)
        .where('userId', '==', uid)
        .orderBy('timestamp', 'asc')
        .limitToLast(limit)
        .get();

      return snap.docs
        .reverse()
        .map((doc) => serializeEntry(doc.id, doc.data()));
    } catch (err) {
      // Surface a clear, logged error instead of an opaque `internal`.
      logger.error('adminListUserEntries failed', { uid, err });
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

    // Only the measurement/variant fields need catalog validation. A
    // timestamp-only patch is allowed even for a stale exercise id whose
    // catalog entry was renamed/removed — the edit dialog offers exactly
    // that for such entries. Mirrors `ExerciseFirestoreService.updateEntry`,
    // which validates only when a value field actually changes.
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
      const violation = validateExerciseEntry(patch, def, { partial: true });
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
