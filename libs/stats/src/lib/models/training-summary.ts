import { addDays } from './challenge.models';
import { findExerciseDefinition } from './exercise.catalog';
import { xpBaseValue, type XpEntryInput } from './xp.models';

export interface TrainingSummaryEntry extends XpEntryInput {
  readonly timestamp: string;
}

/**
 * Lifetime totals across every exercise.
 *
 * Volume is kept per unit — reps, seconds and metres cannot be added up
 * — while entries, days and the streak count any catalog exercise. The
 * dashboard feeds it the live entries, the public profile the same
 * entries read server-side, so both show the same numbers.
 */
export interface TrainingSummary {
  /** Reps of all rep-counted exercises. */
  readonly reps: number;
  /** Seconds of all time-based exercises (planks, holds). */
  readonly durationSec: number;
  /** Metres of all distance exercises, runs included. */
  readonly distanceM: number;
  readonly entries: number;
  /** Distinct Berlin days with at least one entry. */
  readonly days: number;
  /** Consecutive training days ending today or yesterday. */
  readonly currentStreak: number;
  /** Highest XP of a single entry; 0 without an `xpOf`. */
  readonly bestEntryXp: number;
  /** Highest XP of a single Berlin day; 0 without an `xpOf`. */
  readonly bestDayXp: number;
}

export const EMPTY_TRAINING_SUMMARY: TrainingSummary = {
  reps: 0,
  durationSec: 0,
  distanceM: 0,
  entries: 0,
  days: 0,
  currentStreak: 0,
  bestEntryXp: 0,
  bestDayXp: 0,
};

/** `en-CA` formats as `YYYY-MM-DD`; models may not import `@pu-stats/date`. */
const BERLIN_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function berlinDay(timestamp: string): string | null {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : BERLIN_DAY.format(date);
}

function streakOf(sortedDays: ReadonlyArray<string>, today: string): number {
  const last = sortedDays[sortedDays.length - 1];
  if (!last || (last !== today && addDays(last, 1) !== today)) return 0;
  let streak = 1;
  for (let i = sortedDays.length - 1; i > 0; i--) {
    if (addDays(sortedDays[i - 1], 1) !== sortedDays[i]) break;
    streak += 1;
  }
  return streak;
}

/**
 * @param today Berlin ISO date the streak is measured against.
 * @param xpOf XP an entry is worth; only needed for the two XP bests.
 */
export function summarizeTraining(
  entries: ReadonlyArray<TrainingSummaryEntry>,
  today: string,
  xpOf?: (entry: TrainingSummaryEntry) => number
): TrainingSummary {
  let reps = 0;
  let durationSec = 0;
  let distanceM = 0;
  let count = 0;
  let bestEntryXp = 0;
  const xpByDay = new Map<string, number>();

  for (const entry of entries) {
    const definition = findExerciseDefinition(entry.exerciseId);
    const day = berlinDay(entry.timestamp);
    if (!definition || !day) continue;
    count += 1;
    const value = xpBaseValue(definition, entry);
    if (definition.measurement === 'reps') reps += value;
    else if (definition.measurement === 'time') durationSec += value;
    else if (
      definition.measurement === 'distance' ||
      definition.measurement === 'distance-time'
    ) {
      distanceM += value;
    }
    const xp = xpOf ? xpOf(entry) : 0;
    bestEntryXp = Math.max(bestEntryXp, xp);
    xpByDay.set(day, (xpByDay.get(day) ?? 0) + xp);
  }

  const days = [...xpByDay.keys()].sort();
  return {
    reps,
    durationSec,
    distanceM,
    entries: count,
    days: days.length,
    currentStreak: streakOf(days, today),
    bestEntryXp,
    bestDayXp: Math.max(0, ...xpByDay.values()),
  };
}
