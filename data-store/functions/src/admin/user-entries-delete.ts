/**
 * Admin bulk-delete of a user's exercise entries — pure payload validation.
 * Split out of `user-entries.ts` (list/update payload validation) to keep
 * that file under the repo's per-file LOC guideline; the callable in
 * `functions-admin-user-entries.ts` owns the Firestore reads/writes.
 */

/**
 * Upper bound for a single `adminDeleteUserEntries` call — a Firestore
 * `WriteBatch` accepts at most 500 operations.
 */
export const MAX_DELETE_ENTRY_IDS = 500;

/**
 * Validates the `adminDeleteUserEntries` payload: a non-empty `uid` and a
 * non-empty array of `entryIds` (non-empty strings), capped at
 * {@link MAX_DELETE_ENTRY_IDS}.
 */
export function validateDeleteUserEntriesPayload(
  data: unknown
):
  | { valid: true; uid: string; entryIds: string[] }
  | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'payload must be an object' };
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.uid !== 'string' || obj.uid.trim().length === 0) {
    return { valid: false, error: 'uid missing or empty' };
  }
  if (!Array.isArray(obj.entryIds) || obj.entryIds.length === 0) {
    return { valid: false, error: 'entryIds must be a non-empty array' };
  }
  if (obj.entryIds.length > MAX_DELETE_ENTRY_IDS) {
    return {
      valid: false,
      error: `entryIds must not exceed ${MAX_DELETE_ENTRY_IDS}`,
    };
  }
  const entryIds: string[] = [];
  for (const id of obj.entryIds) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      return { valid: false, error: 'entryIds must contain non-empty strings' };
    }
    entryIds.push(id.trim());
  }

  return { valid: true, uid: obj.uid.trim(), entryIds };
}
