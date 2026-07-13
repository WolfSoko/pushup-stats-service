export interface EntryActivity {
  count: number;
  lastTimestamp: string | null;
}

/**
 * Reduce raw `exerciseEntries` docs to a per-user activity summary
 * (entry count + latest timestamp). Docs without a string `userId` are
 * ignored. When `onlyUserIds` is given, entries for other users are
 * skipped so the bulk-cleanup scan can restrict work to the anonymous
 * subset. `lastTimestamp` is the raw ISO string, whose lexicographic
 * order matches chronological order, so callers may compare it directly
 * against a date-only cutoff.
 */
export function aggregateEntryActivity(
  entries: Iterable<{ userId?: unknown; timestamp?: unknown }>,
  onlyUserIds?: ReadonlySet<string>
): Map<string, EntryActivity> {
  const result = new Map<string, EntryActivity>();
  for (const entry of entries) {
    const userId = entry.userId;
    if (typeof userId !== 'string' || !userId) continue;
    if (onlyUserIds && !onlyUserIds.has(userId)) continue;

    const ts = typeof entry.timestamp === 'string' ? entry.timestamp : '';
    const existing = result.get(userId);
    if (!existing) {
      result.set(userId, { count: 1, lastTimestamp: ts || null });
      continue;
    }
    existing.count += 1;
    if (
      ts &&
      (existing.lastTimestamp === null || ts > existing.lastTimestamp)
    ) {
      existing.lastTimestamp = ts;
    }
  }
  return result;
}

export interface UserActivityAggregate {
  entryCount: number;
  lastEntry: string | null;
}

/**
 * Apply a single `exerciseEntries` write (create / update / delete) to a
 * user's precomputed activity aggregate, keeping `adminListUsers` an
 * O(#users) read instead of an O(#entries) scan.
 *
 * `entryCount` is a pure delta. `lastEntry` (max timestamp) can only be
 * bumped up by the surviving entry, so most writes stay delta-only; the one
 * case the delta can't resolve is removing/moving away from the entry that
 * *was* the max, which may lower it — signalled via `needsRecompute` so the
 * caller re-derives the true max from source. Pass `null` for the missing
 * side of a create (`before`) or delete (`after`).
 */
export function nextActivityAggregate(
  current: UserActivityAggregate | null,
  before: { timestamp: string | null } | null,
  after: { timestamp: string | null } | null
): { aggregate: UserActivityAggregate; needsRecompute: boolean } {
  const base = current ?? { entryCount: 0, lastEntry: null };
  const beforeTs = before?.timestamp ?? null;
  const afterTs = after?.timestamp ?? null;

  const entryCount = Math.max(
    0,
    base.entryCount + (after ? 1 : 0) - (before ? 1 : 0)
  );

  let lastEntry = base.lastEntry;
  if (afterTs && (lastEntry === null || afterTs > lastEntry)) {
    lastEntry = afterTs;
  }

  // The entry whose timestamp leaves the collection with this write: a delete
  // removes `beforeTs`; an update that changes the timestamp moves away from
  // the old one. If that timestamp was the running max — and the surviving
  // `afterTs` didn't re-establish an equal-or-higher one — the new max is
  // unknowable from the delta alone.
  const removedTs =
    before && (!after || afterTs !== beforeTs) ? beforeTs : null;
  const needsRecompute =
    removedTs !== null &&
    lastEntry !== null &&
    removedTs === lastEntry &&
    !(afterTs !== null && afterTs >= removedTs);

  return { aggregate: { entryCount, lastEntry }, needsRecompute };
}
