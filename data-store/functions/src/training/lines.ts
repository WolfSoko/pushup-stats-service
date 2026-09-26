import {
  xpForEntry,
  xpRateFor,
  type TrainingLine,
  type XpConfig,
} from '@pu-stats/models';

type EntryData = Record<string, unknown> | undefined;

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * An entry as the training aggregate folds it, or `null` when there is
 * nothing to fold (a create's `before`, a delete's `after`).
 *
 * XP is priced at today's rate, not the rate frozen in the XP ledger:
 * the ledger line may not exist yet when this runs, and both sides of an
 * edit are priced alike, so they still cancel out.
 */
export function trainingLineOf(
  entry: EntryData,
  config: XpConfig | null
): TrainingLine | null {
  if (!entry) return null;
  const exerciseId = entry['exerciseId'];
  const timestamp = entry['timestamp'];
  if (typeof exerciseId !== 'string' || typeof timestamp !== 'string') {
    return null;
  }
  const input = {
    exerciseId,
    reps: numberOrNull(entry['reps']),
    durationSec: numberOrNull(entry['durationSec']),
    distanceM: numberOrNull(entry['distanceM']),
  };
  return {
    ...input,
    timestamp,
    xp: xpForEntry(input, xpRateFor(exerciseId, config)),
  };
}
