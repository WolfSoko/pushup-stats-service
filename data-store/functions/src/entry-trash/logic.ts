/**
 * Pure logic for the deleted-entry trash bin.
 *
 * Every `exerciseEntries` delete is archived into `deletedExerciseEntries`
 * so a removal stays traceable after the fact. The archive is server-only
 * (Admin SDK): `firestore.rules` denies clients any access, and nothing in
 * the app reads it back.
 *
 * Retention is enforced by a Firestore TTL policy on `expiresAt`, not by a
 * scheduled function — see `docs/cloud-functions.md` for the one-time
 * `gcloud firestore fields ttls update` setup per environment. Without that
 * policy the documents pile up forever, so a new environment has to run it.
 */

export const TRASH_COLLECTION = 'deletedExerciseEntries';

/** How long a deleted entry stays in the bin before Firestore drops it. */
export const TRASH_RETENTION_DAYS = 365;

export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Archive payload. `deletedAtMs` / `expiresAtMs` are epoch millis here and
 * are converted to Firestore `Timestamp`s at the write site — TTL policies
 * only act on real timestamp fields, an ISO string is ignored and the doc
 * would never expire.
 */
export interface TrashRecordDraft {
  /** Doc id of the deleted `exerciseEntries` document. */
  entryId: string;
  /**
   * Lifted out of the entry so deletions can be traced per user without
   * unpacking `entry`. `null` for documents that predate the `userId` field
   * or were written by an admin path without one.
   */
  userId: string | null;
  deletedAtMs: number;
  expiresAtMs: number;
  /** The deleted document's data, verbatim. */
  entry: Record<string, unknown>;
}

/**
 * Builds the archive record for a deleted entry.
 *
 * The original data is kept nested under `entry` rather than spread at the
 * top level: an entry field named `deletedAt`/`expiresAt` would otherwise
 * overwrite the retention bookkeeping and either break the TTL or expire
 * the record immediately.
 */
export function buildTrashRecord(
  entryId: string,
  data: Record<string, unknown>,
  deletedAtMs: number
): TrashRecordDraft {
  const rawUserId = data['userId'];
  return {
    entryId,
    userId: typeof rawUserId === 'string' && rawUserId ? rawUserId : null,
    deletedAtMs,
    expiresAtMs: deletedAtMs + TRASH_RETENTION_MS,
    entry: data,
  };
}
