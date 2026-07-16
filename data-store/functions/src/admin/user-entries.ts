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

const KNOWN_PATCH_FIELDS: ReadonlySet<string> = new Set<string>([
  'timestamp',
  ...NUMERIC_FIELDS,
  ...BREAKDOWN_FIELDS,
  'variantId',
]);

// ISO-8601 date-time with a *required* timezone suffix (`Z`, `±HH:MM`, or
// `±HHMM` — `appendLocalOffset` may emit the colon-less form):
// the client only ever writes the stored `…Z` form or `appendLocalOffset`
// output (`…+02:00`). Since the admin callable bypasses the Firestore rules
// that pin this shape, re-check it here — `buildEntryUpdate` stores the value
// verbatim and `orderBy('timestamp')` / the activity aggregate assume
// unambiguous, lexicographically-ordered ISO strings. A timezone-less value
// would be parsed in the server's locale and break that invariant.
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

function isIsoTimestamp(value: string): boolean {
  return ISO_TIMESTAMP_RE.test(value) && !Number.isNaN(Date.parse(value));
}

// The *read* path is more lenient than the update-payload check above: the
// timezone suffix is optional. Older entries were stored without an offset
// (e.g. `2026-04-05T22:50`) and are treated as Berlin local time — see
// `docs/gotchas/precomputed-data.md` → "Timestamp format". These are valid,
// `Date`-parseable, and safe for the admin UI's `DatePipe`/`new Date()`; only
// truly unparseable/non-datetime strings must be dropped.
const ISO_DATETIME_READ_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

function isIsoDateTime(value: string): boolean {
  return ISO_DATETIME_READ_RE.test(value) && !Number.isNaN(Date.parse(value));
}

// The fields an admin entry row may carry. Projecting explicitly keeps the
// callable response strictly JSON-serializable — a stray Firestore
// `Timestamp`/`GeoPoint`/`DocumentReference` on a legacy doc would otherwise
// make the callable fail to encode and surface to the client as a generic
// `internal` error.
//
// `userId`/`exerciseId`/`source` are required on the shared `ExerciseEntry`
// model and the admin UI calls string methods on them unconditionally (the
// sort helper does `exerciseDisplayName(exerciseId).toLowerCase()`), so they're
// always emitted with an empty-string default; `variantId` is optional and
// dropped when absent/non-string.
const ENTRY_REQUIRED_STRING_FIELDS = ['userId', 'exerciseId', 'source'];
const ENTRY_OPTIONAL_STRING_FIELDS = ['variantId'];
// `timestamp` is required by the admin UI (`ExerciseEntry.timestamp: string`);
// `createdAt`/`updatedAt` are optional and dropped when absent/malformed.
const ENTRY_OPTIONAL_TS_FIELDS = ['createdAt', 'updatedAt'];

/**
 * Coerce a Firestore timestamp-ish value to an ISO string. Post-cutover docs
 * store ISO strings already, but a legacy/migrated doc might carry a Firestore
 * `Timestamp` (has `.toDate()`), which is not JSON-serializable as-is. Anything
 * else yields `undefined` (the field is dropped from the projection).
 */
export function toIsoString(value: unknown): string | undefined {
  // Keep a valid (possibly offset-less legacy) ISO datetime, drop anything
  // truly unparseable: the admin UI feeds these to Angular's DatePipe, which
  // throws on an unparseable date. `.toDate().toISOString()` always yields a
  // valid `…Z`.
  if (typeof value === 'string') {
    return isIsoDateTime(value) ? value : undefined;
  }
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  return undefined;
}

/**
 * Project a raw `exerciseEntries` document into a strictly JSON-serializable
 * admin row: allowlisted string/number/array fields plus ISO timestamps. Only
 * finite numbers survive (NaN/Infinity are not valid JSON numbers). The
 * required `userId`/`exerciseId`/`source`/`timestamp` are always present (empty
 * string when absent/malformed) so the admin UI can't crash calling string
 * methods on them; `variantId`/`createdAt`/`updatedAt` are optional and omitted
 * when absent/malformed.
 */
export function serializeEntry(
  id: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const entry: Record<string, unknown> = { _id: id };
  // Always emit the required identity strings (empty default) so the admin UI,
  // which calls string methods on them unconditionally, can't crash on a
  // legacy/bad doc.
  for (const f of ENTRY_REQUIRED_STRING_FIELDS) {
    entry[f] = typeof data[f] === 'string' ? data[f] : '';
  }
  for (const f of ENTRY_OPTIONAL_STRING_FIELDS) {
    if (typeof data[f] === 'string') entry[f] = data[f];
  }
  // Always emit `timestamp` so the admin edit dialog (which types it as a
  // required string and calls `.slice()` on it) can't crash on a legacy/bad
  // doc. An empty string is safe for `date` pipe, `new Date()`, and sorting.
  entry['timestamp'] = toIsoString(data['timestamp']) ?? '';
  for (const f of ENTRY_OPTIONAL_TS_FIELDS) {
    const iso = toIsoString(data[f]);
    if (iso !== undefined) entry[f] = iso;
  }
  for (const f of NUMERIC_FIELDS) {
    if (Number.isFinite(data[f])) entry[f] = data[f];
  }
  for (const f of BREAKDOWN_FIELDS) {
    if (Array.isArray(data[f])) {
      entry[f] = (data[f] as unknown[]).filter((n) => Number.isFinite(n));
    }
  }
  return entry;
}

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
  // Reject unknown keys rather than silently dropping them, so a typo like
  // `repss` surfaces as an error instead of a no-op the admin thinks saved.
  for (const key of Object.keys(raw)) {
    if (!KNOWN_PATCH_FIELDS.has(key)) {
      return { valid: false, error: `unknown patch field: ${key}` };
    }
  }

  const patch: AdminEntryPatch = {};

  if (raw.timestamp !== undefined) {
    if (typeof raw.timestamp !== 'string') {
      return { valid: false, error: 'timestamp must be a string' };
    }
    const ts = raw.timestamp.trim();
    if (!isIsoTimestamp(ts)) {
      return {
        valid: false,
        error: 'timestamp must be an ISO date-time string',
      };
    }
    patch.timestamp = ts;
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
    // Trim, and treat a blank/whitespace-only value as `null` ("clear the
    // variant") rather than writing it verbatim as a bogus variant id.
    const trimmed = raw.variantId === null ? null : raw.variantId.trim();
    patch.variantId = trimmed === '' ? null : trimmed;
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
