/**
 * Users who have entries but no current training aggregate, in a stable
 * order so repeated runs work through the same list. Re-running after
 * the backfill finished is a no-op.
 */
export function pendingTrainingUsers(
  entryUserIds: Iterable<unknown>,
  usersWithCurrentAggregate: ReadonlySet<string>,
  skipUserIds: ReadonlySet<string>
): string[] {
  const pending = new Set<string>();
  for (const userId of entryUserIds) {
    if (typeof userId !== 'string' || !userId) continue;
    if (skipUserIds.has(userId) || usersWithCurrentAggregate.has(userId)) {
      continue;
    }
    pending.add(userId);
  }
  return [...pending].sort();
}
