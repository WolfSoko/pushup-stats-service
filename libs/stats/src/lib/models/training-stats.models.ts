import { findExerciseDefinition } from './exercise.catalog';
import { xpBaseValue, type XpEntryInput } from './xp.models';

/**
 * Cross-exercise aggregate at `userStats/{uid}/aggregates/training`,
 * written by the entry trigger only.
 *
 * Volume is kept per unit — reps, seconds and metres cannot be added up.
 * Days are kept as a map rather than a counter: training days, the streak
 * and the best day then follow exactly from the map, deletes included,
 * instead of drifting like a counter that cannot tell whether a day still
 * holds another entry.
 */
export interface TrainingStats {
  readonly userId: string;
  /** Reps of all rep-counted exercises. */
  readonly reps: number;
  /** Seconds of all time-based exercises (planks, holds). */
  readonly durationSec: number;
  /** Metres of all distance exercises, runs included. */
  readonly distanceM: number;
  readonly entries: number;
  /** Per Berlin day (`YYYY-MM-DD`); days without entries are dropped. */
  readonly days: Readonly<Record<string, TrainingDay>>;
  /** XP per Berlin `<weekday>-<HH>` slot, the profile's heatmap key. */
  readonly heatmap: Readonly<Record<string, number>>;
  /** Highest XP of a single entry. Only grows by delta; see `needsRebuild`. */
  readonly bestEntryXp: number;
  readonly version: number;
  /** Ids of the last trigger events folded in, for at-least-once delivery. */
  readonly recentEventIds?: ReadonlyArray<string>;
  readonly updatedAt: string;
}

export interface TrainingDay {
  readonly entries: number;
  readonly xp: number;
}

/** A doc below this version is rebuilt from the entries on the next write. */
export const TRAINING_STATS_VERSION = 1;

export const TRAINING_STATS_DOC = 'aggregates/training';

/** One entry as the aggregate sees it, XP already priced by the caller. */
export interface TrainingLine extends XpEntryInput {
  readonly timestamp: string;
  readonly xp: number;
}

export function emptyTrainingStats(userId: string): TrainingStats {
  return {
    userId,
    reps: 0,
    durationSec: 0,
    distanceM: 0,
    entries: 0,
    days: {},
    heatmap: {},
    bestEntryXp: 0,
    version: TRAINING_STATS_VERSION,
    updatedAt: '',
  };
}

const BERLIN = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** The German abbreviations the heatmap slots have always been keyed by. */
const WEEKDAY_KEYS: Readonly<Record<string, string>> = {
  Mon: 'Mo',
  Tue: 'Di',
  Wed: 'Mi',
  Thu: 'Do',
  Fri: 'Fr',
  Sat: 'Sa',
  Sun: 'So',
};

/** Berlin day and heatmap slot of a timestamp; `null` when unparsable. */
export function berlinDayAndSlot(
  timestamp: string
): { day: string; slot: string } | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const parts: Record<string, string> = {};
  for (const part of BERLIN.formatToParts(date)) parts[part.type] = part.value;
  return {
    day: `${parts['year']}-${parts['month']}-${parts['day']}`,
    slot: `${WEEKDAY_KEYS[parts['weekday']]}-${parts['hour']}`,
  };
}

function nonNegative(value: number): number {
  return value > 0 ? value : 0;
}

function bump(
  map: Readonly<Record<string, number>>,
  key: string,
  delta: number
): Record<string, number> {
  const next = { ...map };
  const value = (next[key] ?? 0) + delta;
  if (value > 0) next[key] = value;
  else delete next[key];
  return next;
}

/**
 * Adds (`sign = 1`) or removes (`sign = -1`) one entry. Lines of unknown
 * exercises or with an unparsable timestamp change nothing, on either
 * side, so an add and its later removal always cancel out.
 *
 * `needsRebuild` is set when a removal may have taken the best entry
 * with it: a running maximum cannot shrink by delta.
 */
export function applyTrainingLine(
  stats: TrainingStats,
  line: TrainingLine,
  sign: 1 | -1
): { stats: TrainingStats; needsRebuild: boolean } {
  const definition = findExerciseDefinition(line.exerciseId);
  const where = berlinDayAndSlot(line.timestamp);
  if (!definition || !where) return { stats, needsRebuild: false };

  const value = sign * xpBaseValue(definition, line);
  const xp = Number.isFinite(line.xp) && line.xp > 0 ? line.xp : 0;
  const measurement = definition.measurement;
  const day = stats.days[where.day] ?? { entries: 0, xp: 0 };
  const nextDay = {
    entries: day.entries + sign,
    xp: nonNegative(day.xp + sign * xp),
  };
  const days = { ...stats.days };
  if (nextDay.entries > 0) days[where.day] = nextDay;
  else delete days[where.day];

  return {
    stats: {
      ...stats,
      reps: nonNegative(stats.reps + (measurement === 'reps' ? value : 0)),
      durationSec: nonNegative(
        stats.durationSec + (measurement === 'time' ? value : 0)
      ),
      distanceM: nonNegative(
        stats.distanceM +
          (measurement === 'distance' || measurement === 'distance-time'
            ? value
            : 0)
      ),
      entries: nonNegative(stats.entries + sign),
      days,
      heatmap: bump(stats.heatmap, where.slot, sign * xp),
      bestEntryXp:
        sign > 0 ? Math.max(stats.bestEntryXp, xp) : stats.bestEntryXp,
    },
    needsRebuild: sign < 0 && xp > 0 && xp >= stats.bestEntryXp,
  };
}

export function rebuildTrainingStats(
  userId: string,
  lines: ReadonlyArray<TrainingLine>
): TrainingStats {
  return lines.reduce(
    (acc, line) => applyTrainingLine(acc, line, 1).stats,
    emptyTrainingStats(userId)
  );
}

/** Appends `eventId`, keeping only the newest 50. */
export function rememberTrainingEvent(
  ids: ReadonlyArray<string> | undefined,
  eventId: string
): string[] {
  return [...(ids ?? []), eventId].slice(-50);
}
