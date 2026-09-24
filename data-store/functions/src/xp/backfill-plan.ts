import type { XpConfig, XpLedgerEntry } from '@pu-stats/models';

import { ledgerLineFor } from './ledger';

export interface BackfillEntry {
  readonly id: string;
  readonly data: Record<string, unknown>;
}

export interface UserBackfill {
  readonly userId: string;
  /** Ledger lines to create, keyed by entry id. */
  readonly missing: ReadonlyArray<{ id: string; line: XpLedgerEntry }>;
  /** Every line the user ends up with — the aggregate is rebuilt from it. */
  readonly lines: ReadonlyArray<XpLedgerEntry>;
}

/**
 * Groups historic entries by user and books the ones that have no ledger
 * line yet at today's rates. A user is only pending when something is
 * missing — a booked line or the aggregate — so re-running the backfill
 * after it finished is a no-op.
 */
export function planXpBackfill(
  entries: ReadonlyArray<BackfillEntry>,
  ledger: ReadonlyMap<string, ReadonlyMap<string, XpLedgerEntry>>,
  usersWithAggregate: ReadonlySet<string>,
  config: XpConfig | null,
  skipUserIds: ReadonlySet<string>
): UserBackfill[] {
  const byUser = new Map<string, BackfillEntry[]>();
  for (const entry of entries) {
    const userId = entry.data['userId'];
    if (typeof userId !== 'string' || !userId || skipUserIds.has(userId)) {
      continue;
    }
    const bucket = byUser.get(userId) ?? [];
    bucket.push(entry);
    byUser.set(userId, bucket);
  }

  const plans: UserBackfill[] = [];
  for (const [userId, userEntries] of [...byUser].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const booked = ledger.get(userId) ?? new Map<string, XpLedgerEntry>();
    const missing: { id: string; line: XpLedgerEntry }[] = [];
    for (const entry of userEntries) {
      if (booked.has(entry.id)) continue;
      const line = ledgerLineFor(entry.data, null, config);
      if (line)
        missing.push({ id: entry.id, line: { ...line, source: 'backfill' } });
    }
    if (missing.length === 0 && usersWithAggregate.has(userId)) continue;
    plans.push({
      userId,
      missing,
      lines: [...booked.values(), ...missing.map((m) => m.line)],
    });
  }
  return plans;
}
