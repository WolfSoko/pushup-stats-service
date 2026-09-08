/**
 * Which `reminderDispatchState` documents still carry the fields the retired
 * reminder snooze left behind, and what to strip from them.
 *
 * Pure so it can be tested without Firestore; the `onCall` wrapper in
 * `functions-reminder-snooze-cleanup.ts` supplies the paging and the batch.
 */

/** Fields the snooze action used to write. Nothing reads them any more. */
export const SNOOZE_FIELDS = [
  'snoozedUntil',
  'snoozedAt',
  'snoozeMinutes',
] as const;

export type SnoozeField = (typeof SNOOZE_FIELDS)[number];

/**
 * Whether a dispatch-state document still holds snooze leftovers.
 *
 * A field explicitly set to `null` counts: it occupies the document just as
 * a timestamp would, and leaving it behind is the thing being cleaned up.
 * Only "absent" means clean.
 */
export function hasSnoozeState(
  data: Record<string, unknown> | undefined
): boolean {
  if (!data) return false;
  return SNOOZE_FIELDS.some((field) => data[field] !== undefined);
}

/**
 * The update payload that removes every snooze field, built from the caller's
 * delete sentinel (`FieldValue.delete()`) so this module stays free of the
 * Admin SDK.
 */
export function snoozeDeletionPatch<T>(
  deleteSentinel: T
): Record<SnoozeField, T> {
  return Object.fromEntries(
    SNOOZE_FIELDS.map((field) => [field, deleteSentinel])
  ) as Record<SnoozeField, T>;
}
