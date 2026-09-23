export interface BulkDeleteCounts {
  deleted: number;
  skipped: number;
  remaining: number;
}

/**
 * Deletes every inactive account among `uids`, at most `limit` per run.
 * Active accounts count as `skipped`; inactive ones beyond the limit as
 * `remaining`, so the caller can tell the admin to run it again.
 */
export async function deleteInactiveAccounts(opts: {
  readonly uids: readonly string[];
  readonly limit: number;
  readonly isActive: (uid: string) => Promise<boolean>;
  readonly deleteAccount: (uid: string) => Promise<unknown>;
}): Promise<BulkDeleteCounts> {
  const counts: BulkDeleteCounts = { deleted: 0, skipped: 0, remaining: 0 };
  for (const uid of opts.uids) {
    if (await opts.isActive(uid)) {
      counts.skipped++;
    } else if (counts.deleted >= opts.limit) {
      counts.remaining++;
    } else {
      await opts.deleteAccount(uid);
      counts.deleted++;
    }
  }
  return counts;
}
