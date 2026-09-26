import { berlinParts, heatmapSlot } from './berlin-time';
import { EXERCISE_CATALOG, findExerciseDefinition } from './exercise.catalog';
import {
  type XpConfig,
  type XpEntryInput,
  xpBaseValue,
  xpRateFor,
} from './xp.models';

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
  /**
   * {@link xpRatesKey} of the rates every XP figure here was priced at.
   * A delta priced at other rates would not cancel what was added, so a
   * mismatch means rebuild instead.
   */
  readonly ratesKey: string;
  /**
   * Read time of the entries the last rebuild folded in. Events of writes
   * at or before it are already contained and must not be applied again.
   */
  readonly rebuiltAt: string;
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
export const TRAINING_STATS_VERSION = 2;

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
    ratesKey: '',
    rebuiltAt: '',
    version: TRAINING_STATS_VERSION,
    updatedAt: '',
  };
}

/**
 * Short fingerprint of the effective rate of every catalog exercise —
 * admin overrides and shipped defaults alike, so a changed default in a
 * release counts as a change too.
 */
export function xpRatesKey(config: XpConfig | null | undefined): string {
  const text = EXERCISE_CATALOG.map(
    (e) => `${e.id}=${xpRateFor(e.id, config)}`
  ).join(';');
  // FNV-1a: a fingerprint, not a secret — collisions only cost a missed rebuild.
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Berlin day and heatmap slot of a timestamp; `null` when unparsable. */
export function berlinDayAndSlot(
  timestamp: string
): { day: string; slot: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}/.test(timestamp)) return null;
  if (Number.isNaN(Date.parse(timestamp))) return null;
  const parts = berlinParts(timestamp);
  return { day: parts.isoDate, slot: heatmapSlot(parts.weekday, parts.hour) };
}

interface Contribution {
  readonly day: string;
  readonly slot: string;
  readonly measurement: string;
  readonly value: number;
  readonly xp: number;
}

function contributionOf(line: TrainingLine): Contribution | null {
  const definition = findExerciseDefinition(line.exerciseId);
  const where = berlinDayAndSlot(line.timestamp);
  if (!definition || !where) return null;
  return {
    ...where,
    measurement: definition.measurement,
    value: xpBaseValue(definition, line),
    xp: Number.isFinite(line.xp) && line.xp > 0 ? line.xp : 0,
  };
}

type Totals = { reps: number; durationSec: number; distanceM: number };

function addVolume(totals: Totals, measurement: string, value: number): Totals {
  if (measurement === 'reps') return { ...totals, reps: totals.reps + value };
  if (measurement === 'time') {
    return { ...totals, durationSec: totals.durationSec + value };
  }
  if (measurement === 'distance' || measurement === 'distance-time') {
    return { ...totals, distanceM: totals.distanceM + value };
  }
  return totals;
}

function nonNegative(value: number): number {
  return value > 0 ? value : 0;
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
  const c = contributionOf(line);
  if (!c) return { stats, needsRebuild: false };

  const totals = addVolume(
    {
      reps: stats.reps,
      durationSec: stats.durationSec,
      distanceM: stats.distanceM,
    },
    c.measurement,
    sign * c.value
  );
  const day = stats.days[c.day] ?? { entries: 0, xp: 0 };
  const days = { ...stats.days };
  const entries = day.entries + sign;
  if (entries > 0) {
    days[c.day] = { entries, xp: nonNegative(day.xp + sign * c.xp) };
  } else {
    delete days[c.day];
  }
  const heatmap = { ...stats.heatmap };
  const slotXp = (heatmap[c.slot] ?? 0) + sign * c.xp;
  if (slotXp > 0) heatmap[c.slot] = slotXp;
  else delete heatmap[c.slot];

  return {
    stats: {
      ...stats,
      reps: nonNegative(totals.reps),
      durationSec: nonNegative(totals.durationSec),
      distanceM: nonNegative(totals.distanceM),
      entries: nonNegative(stats.entries + sign),
      days,
      heatmap,
      bestEntryXp:
        sign > 0 ? Math.max(stats.bestEntryXp, c.xp) : stats.bestEntryXp,
    },
    needsRebuild: sign < 0 && c.xp > 0 && c.xp >= stats.bestEntryXp,
  };
}

/**
 * Folds every line in one pass. Deliberately not a reduce over
 * {@link applyTrainingLine}: copying the day map per line would make a
 * long history quadratic, and the dashboard reruns this on every
 * snapshot.
 */
export function rebuildTrainingStats(
  userId: string,
  lines: ReadonlyArray<TrainingLine>,
  meta: { ratesKey?: string; rebuiltAt?: string } = {}
): TrainingStats {
  let totals: Totals = { reps: 0, durationSec: 0, distanceM: 0 };
  let entries = 0;
  let bestEntryXp = 0;
  const days: Record<string, TrainingDay> = {};
  const heatmap: Record<string, number> = {};
  for (const line of lines) {
    const c = contributionOf(line);
    if (!c) continue;
    totals = addVolume(totals, c.measurement, c.value);
    entries += 1;
    bestEntryXp = Math.max(bestEntryXp, c.xp);
    const day = days[c.day] ?? { entries: 0, xp: 0 };
    days[c.day] = { entries: day.entries + 1, xp: day.xp + c.xp };
    if (c.xp > 0) heatmap[c.slot] = (heatmap[c.slot] ?? 0) + c.xp;
  }
  return {
    ...emptyTrainingStats(userId),
    ...totals,
    entries,
    days,
    heatmap,
    bestEntryXp,
    ratesKey: meta.ratesKey ?? '',
    rebuiltAt: meta.rebuiltAt ?? '',
  };
}

function sameLine(a: TrainingLine, b: TrainingLine): boolean {
  return (
    a.exerciseId === b.exerciseId &&
    a.timestamp === b.timestamp &&
    a.xp === b.xp &&
    (a.reps ?? null) === (b.reps ?? null) &&
    (a.durationSec ?? null) === (b.durationSec ?? null) &&
    (a.distanceM ?? null) === (b.distanceM ?? null)
  );
}

/**
 * Moves the aggregate from an entry's old state to its new one, or
 * returns `null` when it has to be rebuilt from all entries: there is no
 * current aggregate, it was priced at other rates, or the removal may
 * have taken the best entry. An edit that leaves every counted field
 * alone (a note, a variant) changes nothing.
 */
export function nextTrainingStats(
  current: TrainingStats | null,
  removed: TrainingLine | null,
  added: TrainingLine | null,
  ratesKey: string
): TrainingStats | null {
  if (!current || current.ratesKey !== ratesKey) return null;
  if (removed && added && sameLine(removed, added)) return current;
  let next = current;
  if (removed) {
    const result = applyTrainingLine(next, removed, -1);
    if (result.needsRebuild) return null;
    next = result.stats;
  }
  return added ? applyTrainingLine(next, added, 1).stats : next;
}
