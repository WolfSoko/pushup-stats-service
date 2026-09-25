import {
  USER_XP_VERSION,
  type UserXp,
  type XpLedgerEntry,
} from '@pu-stats/models';

import { berlinParts, periodKeys } from '../user-stats-delta';

type LedgerLine = Pick<XpLedgerEntry, 'exerciseId' | 'timestamp' | 'xp'>;

const PERIODS = ['daily', 'weekly', 'monthly'] as const;
type Period = (typeof PERIODS)[number];
type PeriodKeys = Record<`${Period}Key`, string>;
type MutableUserXp = { -readonly [K in keyof UserXp]: UserXp[K] };

/** How many ledger event ids the aggregate remembers for dedupe. */
export const RECENT_EVENT_IDS_MAX = 50;

function keysOf(isoTimestamp: string): PeriodKeys {
  return periodKeys(berlinParts(isoTimestamp));
}

export function emptyUserXp(userId: string, nowIso: string): UserXp {
  const today = keysOf(nowIso);
  return {
    userId,
    total: 0,
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
  const next: MutableUserXp = { ...current };
  for (const p of PERIODS) {
    if (current[`${p}Key`] !== today[`${p}Key`]) next[`${p}Xp`] = 0;
    next[`${p}Key`] = today[`${p}Key`];
  }
  return next;
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
  const next: MutableUserXp = {
    ...current,
    total: Math.max(0, current.total + xp),
    byExercise,
  };
  for (const p of PERIODS) {
    if (keys[`${p}Key`] === today[`${p}Key`]) {
      next[`${p}Xp`] = Math.max(0, current[`${p}Xp`] + xp);
    }
  }
  return next;
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

/** Appends `eventId`, keeping only the newest {@link RECENT_EVENT_IDS_MAX}. */
export function rememberEvent(
  ids: ReadonlyArray<string> | undefined,
  eventId: string
): string[] {
  return [...(ids ?? []), eventId].slice(-RECENT_EVENT_IDS_MAX);
}
