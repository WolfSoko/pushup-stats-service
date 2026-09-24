import {
  type XpConfig,
  type XpLedgerEntry,
  xpForEntry,
  xpRateFor,
} from '@pu-stats/models';

type EntryData = Record<string, unknown> | undefined;

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/**
 * The ledger line an entry write leaves behind, or `null` when the entry
 * is gone (or unusable) and its line must be removed.
 *
 * The rate is frozen on the first booking: an edit keeps the rate of the
 * existing line, so re-weighting an exercise in the admin area never
 * changes XP that was already earned.
 */
export function ledgerLineFor(
  entry: EntryData,
  existing: Pick<XpLedgerEntry, 'rate'> | null,
  config: XpConfig | null
): XpLedgerEntry | null {
  if (!entry) return null;
  const userId = entry['userId'];
  const exerciseId = entry['exerciseId'];
  const timestamp = entry['timestamp'];
  if (
    typeof userId !== 'string' ||
    typeof exerciseId !== 'string' ||
    typeof timestamp !== 'string' ||
    !userId ||
    !exerciseId ||
    !timestamp
  ) {
    return null;
  }
  const rate = existing?.rate ?? xpRateFor(exerciseId, config);
  const xp = xpForEntry(
    {
      exerciseId,
      reps: numberOrUndefined(entry['reps']),
      durationSec: numberOrUndefined(entry['durationSec']),
      distanceM: numberOrUndefined(entry['distanceM']),
    },
    rate
  );
  return { userId, exerciseId, timestamp, rate, xp };
}

export function sameLedgerLine(
  a: Omit<XpLedgerEntry, 'source'> | null,
  b: Omit<XpLedgerEntry, 'source'> | null
): boolean {
  if (!a || !b) return a === b;
  return (
    a.userId === b.userId &&
    a.exerciseId === b.exerciseId &&
    a.timestamp === b.timestamp &&
    a.rate === b.rate &&
    a.xp === b.xp
  );
}
