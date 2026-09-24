import {
  levelForXp,
  USER_XP_VERSION,
  type UserXp,
  type XpLedgerEntry,
} from '@pu-stats/models';

import { berlinParts, periodKeys } from '../user-stats-delta';

type LedgerLine = Pick<XpLedgerEntry, 'exerciseId' | 'timestamp' | 'xp'>;

interface PeriodKeys {
  readonly dailyKey: string;
  readonly weeklyKey: string;
  readonly monthlyKey: string;
}

function keysOf(isoTimestamp: string): PeriodKeys {
  return periodKeys(berlinParts(isoTimestamp));
}

export function emptyUserXp(userId: string, nowIso: string): UserXp {
  const today = keysOf(nowIso);
  return {
    userId,
    total: 0,
    level: 1,
    dailyXp: 0,
    dailyKey: today.dailyKey,
    weeklyXp: 0,
    weeklyKey: today.weeklyKey,
    monthlyXp: 0,
    monthlyKey: today.monthlyKey,
    byExercise: {},
    version: USER_XP_VERSION,
  };
}

/** Resets period buckets whose key has rolled over since the last write. */
function rollPeriods(current: UserXp, today: PeriodKeys): UserXp {
  return {
    ...current,
    dailyXp: current.dailyKey === today.dailyKey ? current.dailyXp : 0,
    dailyKey: today.dailyKey,
    weeklyXp: current.weeklyKey === today.weeklyKey ? current.weeklyXp : 0,
    weeklyKey: today.weeklyKey,
    monthlyXp: current.monthlyKey === today.monthlyKey ? current.monthlyXp : 0,
    monthlyKey: today.monthlyKey,
  };
}

function addLine(
  current: UserXp,
  line: LedgerLine,
  sign: 1 | -1,
  today: PeriodKeys
): UserXp {
  const xp = sign * (Number.isFinite(line.xp) ? line.xp : 0);
  if (xp === 0) return current;
  const keys = keysOf(line.timestamp);
  const exerciseXp = Math.max(
    0,
    (current.byExercise[line.exerciseId] ?? 0) + xp
  );
  const byExercise = { ...current.byExercise };
  if (exerciseXp > 0) byExercise[line.exerciseId] = exerciseXp;
  else delete byExercise[line.exerciseId];
  const total = Math.max(0, current.total + xp);
  return {
    ...current,
    total,
    level: levelForXp(total),
    dailyXp:
      keys.dailyKey === today.dailyKey
        ? Math.max(0, current.dailyXp + xp)
        : current.dailyXp,
    weeklyXp:
      keys.weeklyKey === today.weeklyKey
        ? Math.max(0, current.weeklyXp + xp)
        : current.weeklyXp,
    monthlyXp:
      keys.monthlyKey === today.monthlyKey
        ? Math.max(0, current.monthlyXp + xp)
        : current.monthlyXp,
    byExercise,
  };
}

/**
 * Moves the aggregate from the old ledger line to the new one. Either
 * side may be `null` (booking / cancelling); a changed timestamp is a
 * remove + add so period buckets move with the entry.
 */
export function applyXpChange(
  current: UserXp,
  before: LedgerLine | null,
  after: LedgerLine | null,
  nowIso: string
): UserXp {
  const today = keysOf(nowIso);
  let next = rollPeriods(current, today);
  if (before) next = addLine(next, before, -1, today);
  if (after) next = addLine(next, after, 1, today);
  return next;
}

export function rebuildUserXp(
  userId: string,
  lines: ReadonlyArray<LedgerLine>,
  nowIso: string
): UserXp {
  const today = keysOf(nowIso);
  return lines.reduce(
    (acc, line) => addLine(acc, line, 1, today),
    emptyUserXp(userId, nowIso)
  );
}
