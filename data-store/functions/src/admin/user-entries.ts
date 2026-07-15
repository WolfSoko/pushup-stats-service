/**
 * Admin per-user exercise-entry management — pure payload validation.
 *
 * The Firestore rules only let a user read/write their own
 * `exerciseEntries`, so an admin inspecting or correcting someone
 * else's history has to go through the Admin SDK. These helpers validate
 * the callable payloads before any Firestore I/O; the callables in
 * `functions-admin-user-entries.ts` own the reads/writes.
 */

/** Upper bound for a single `adminListUserEntries` page. */
export const MAX_USER_ENTRIES_LIMIT = 2000;
const DEFAULT_USER_ENTRIES_LIMIT = 1000;

export interface AdminEntryPatch {
  timestamp?: string;
  reps?: number;
  durationSec?: number;
  distanceM?: number;
  weightKg?: number;
  sets?: number[];
  intervals?: number[];
  /**
   * `string` sets the variant, `null` clears it (the callable maps this
   * to a Firestore `deleteField()`), `undefined` leaves it untouched.
   */
  variantId?: string | null;
}

const NUMERIC_FIELDS = [
  'reps',
  'durationSec',
  'distanceM',
  'weightKg',
] as const;
const BREAKDOWN_FIELDS = ['sets', 'intervals'] as const;

/**
 * Validates the `adminListUserEntries` payload: a non-empty `uid` and an
 * optional positive integer `limit` capped at {@link MAX_USER_ENTRIES_LIMIT}.
 */
export function validateListUserEntriesPayload(
  data: unknown
):
  | { valid: true; uid: string; limit: number }
  | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'payload must be an object' };
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.uid !== 'string' || obj.uid.trim().length === 0) {
    return { valid: false, error: 'uid missing or empty' };
  }
  let limit = DEFAULT_USER_ENTRIES_LIMIT;
  if (obj.limit !== undefined) {
    if (
      typeof obj.limit !== 'number' ||
      !Number.isInteger(obj.limit) ||
      obj.limit <= 0
    ) {
      return { valid: false, error: 'limit must be a positive integer' };
    }
    limit = Math.min(obj.limit, MAX_USER_ENTRIES_LIMIT);
  }
  return { valid: true, uid: obj.uid.trim(), limit };
}

function validateNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  for (const n of value) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  }
  return value as number[];
}

/**
 * Validates the `adminUpdateUserEntry` payload. Requires a non-empty
 * `uid` and `entryId`, plus a `patch` object carrying at least one
 * editable field. `exerciseId` is intentionally rejected — a different
 * exercise must be modelled as delete + create so the per-exercise stats
 * trigger can decrement the old aggregate (mirrors
 * `ExerciseFirestoreService.updateEntry`). Per-field value bounds are
 * NOT checked here; the callable runs the shared `validateExerciseEntry`
 * against the catalog definition of the stored entry.
 */
export function validateUpdateUserEntryPayload(
  data: unknown
):
  | { valid: true; uid: string; entryId: string; patch: AdminEntryPatch }
  | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'payload must be an object' };
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.uid !== 'string' || obj.uid.trim().length === 0) {
    return { valid: false, error: 'uid missing or empty' };
  }
  if (typeof obj.entryId !== 'string' || obj.entryId.trim().length === 0) {
    return { valid: false, error: 'entryId missing or empty' };
  }
  if (!obj.patch || typeof obj.patch !== 'object') {
    return { valid: false, error: 'patch must be an object' };
  }
  const raw = obj.patch as Record<string, unknown>;
  if ('exerciseId' in raw) {
    return { valid: false, error: 'exerciseId is immutable' };
  }

  const patch: AdminEntryPatch = {};

  if (raw.timestamp !== undefined) {
    if (
      typeof raw.timestamp !== 'string' ||
      raw.timestamp.trim().length === 0
    ) {
      return { valid: false, error: 'timestamp must be a non-empty string' };
    }
    patch.timestamp = raw.timestamp;
  }

  for (const f of NUMERIC_FIELDS) {
    if (raw[f] === undefined) continue;
    if (typeof raw[f] !== 'number' || !Number.isFinite(raw[f])) {
      return { valid: false, error: `${f} must be a finite number` };
    }
    patch[f] = raw[f] as number;
  }

  for (const f of BREAKDOWN_FIELDS) {
    if (raw[f] === undefined) continue;
    const arr = validateNumberArray(raw[f]);
    if (arr === null) {
      return { valid: false, error: `${f} must be an array of numbers` };
    }
    patch[f] = arr;
  }

  if (raw.variantId !== undefined) {
    if (raw.variantId !== null && typeof raw.variantId !== 'string') {
      return { valid: false, error: 'variantId must be a string or null' };
    }
    patch.variantId = raw.variantId as string | null;
  }

  if (Object.keys(patch).length === 0) {
    return { valid: false, error: 'patch must contain at least one field' };
  }

  return {
    valid: true,
    uid: obj.uid.trim(),
    entryId: obj.entryId.trim(),
    patch,
  };
}
