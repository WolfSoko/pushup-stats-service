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
