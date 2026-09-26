import { addDays } from './challenge.models';
import {
  rebuildTrainingStats,
  type TrainingStats,
} from './training-stats.models';
import type { XpEntryInput } from './xp.models';

export interface TrainingSummaryEntry extends XpEntryInput {
  readonly timestamp: string;
}

/**
 * Lifetime totals across every exercise.
 *
 * Volume is kept per unit — reps, seconds and metres cannot be added up
 * — while entries, days and the streak count any catalog exercise. The
 * dashboard derives it from its live entries, the public profile from
 * the `TrainingStats` aggregate; both go through the same fold.
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
 * The lifetime numbers of an aggregate.
 *
 * @param today Berlin ISO date the streak is measured against.
 */
export function summaryFromTrainingStats(
  stats: TrainingStats,
  today: string
): TrainingSummary {
  const days = Object.keys(stats.days).sort();
  return {
    reps: stats.reps,
    durationSec: stats.durationSec,
    distanceM: stats.distanceM,
    entries: stats.entries,
    days: days.length,
    currentStreak: streakOf(days, today),
    bestEntryXp: stats.bestEntryXp,
    bestDayXp: Math.max(0, ...Object.values(stats.days).map((d) => d.xp)),
  };
}

/**
 * The same numbers straight from the entries — what the dashboard shows
 * from its live feed, through the very fold the trigger applies.
 *
 * @param xpOf XP an entry is worth; only needed for the XP bests.
 */
export function summarizeTraining(
  entries: ReadonlyArray<TrainingSummaryEntry>,
  today: string,
  xpOf?: (entry: TrainingSummaryEntry) => number
): TrainingSummary {
  const lines = entries.map((entry) => ({
    ...entry,
    xp: xpOf ? xpOf(entry) : 0,
  }));
  return summaryFromTrainingStats(rebuildTrainingStats('', lines), today);
}
