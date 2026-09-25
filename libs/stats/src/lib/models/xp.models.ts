import type { ExerciseDefinition, MeasurementType } from './exercise.models';
import { findExerciseDefinition } from './exercise.catalog';
import { DEFAULT_XP_RATES } from './xp-rates.catalog';

/**
 * Experience points (XP) and levels.
 *
 * Every exercise is worth a number of XP per rate unit (per rep, per
 * minute, per kilometre). An entry's XP is fixed when the server first
 * books it into the ledger (`userXp/{uid}/xpLedger/{entryId}`): an admin
 * changing a rate later only affects entries saved afterwards, so nobody
 * loses a level because of a re-weighting.
 *
 * Rates are stored in the rate unit rather than the catalog unit so the
 * admin never has to type `0.0167 XP/s` — see {@link xpRateUnit}.
 */

export type XpRateUnitKey = 'rep' | 'minute' | 'km';

export interface XpRateUnit {
  readonly key: XpRateUnitKey;
  /** Catalog-unit amount one rate unit covers (60 s, 1000 m). */
  readonly divisor: number;
}

export function xpRateUnit(measurement: MeasurementType): XpRateUnit | null {
  switch (measurement) {
    case 'reps':
      return { key: 'rep', divisor: 1 };
    case 'time':
      return { key: 'minute', divisor: 60 };
    case 'distance':
    case 'distance-time':
      return { key: 'km', divisor: 1000 };
    default:
      return null;
  }
}

/** Admin-editable overrides, stored at `xpConfig/current`. */
export interface XpConfig {
  readonly rates: Readonly<Record<string, number>>;
}

export const XP_CONFIG_DOC_PATH = 'xpConfig/current';

/** Upper bound the admin form and the Firestore rule both accept. */
export const XP_RATE_MAX = 1000;

export function isValidXpRate(rate: unknown): rate is number {
  return (
    typeof rate === 'number' &&
    Number.isFinite(rate) &&
    rate >= 0 &&
    rate <= XP_RATE_MAX
  );
}

/** Keeps only well-formed rates, so a bad admin write cannot poison XP. */
export function parseXpConfig(data: unknown): XpConfig | null {
  const rates = (data as { rates?: unknown } | null | undefined)?.rates;
  if (!rates || typeof rates !== 'object') return null;
  const clean: Record<string, number> = {};
  for (const [id, rate] of Object.entries(rates as Record<string, unknown>)) {
    if (isValidXpRate(rate)) clean[id] = rate;
  }
  return { rates: clean };
}

/**
 * Effective XP per rate unit for an exercise: the admin override if one
 * is set, otherwise the shipped default. Unknown ids (e.g. an exercise
 * dropped from the catalog) are worth nothing.
 */
export function xpRateFor(
  exerciseId: string,
  config: XpConfig | null | undefined
): number {
  const override = config?.rates?.[exerciseId];
  if (isValidXpRate(override)) return override;
  return DEFAULT_XP_RATES[exerciseId] ?? 0;
}

export interface XpEntryInput {
  readonly exerciseId: string;
  readonly reps?: number | null;
  readonly durationSec?: number | null;
  readonly distanceM?: number | null;
}

/** The value XP is computed from, in the exercise's catalog unit. */
export function xpBaseValue(
  definition: Pick<ExerciseDefinition, 'measurement'>,
  entry: XpEntryInput
): number {
  const raw =
    definition.measurement === 'reps'
      ? entry.reps
      : definition.measurement === 'time'
        ? entry.durationSec
        : definition.measurement === 'distance' ||
            definition.measurement === 'distance-time'
          ? entry.distanceM
          : 0;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/** Whole XP an entry is worth at `rate` XP per rate unit. */
export function xpForEntry(entry: XpEntryInput, rate: number): number {
  const definition = findExerciseDefinition(entry.exerciseId);
  if (!definition || !isValidXpRate(rate)) return 0;
  const unit = xpRateUnit(definition.measurement);
  if (!unit) return 0;
  return Math.round((xpBaseValue(definition, entry) / unit.divisor) * rate);
}

// ── Levels ──────────────────────────────────────────────────────────────

/**
 * Total XP needed to reach `level`: 50·n·(n−1), so level 2 costs 100 XP
 * and every further level costs 100 XP more than the one before. A daily
 * hundred pushups reaches level ~27 after a year — the curve keeps early
 * levels quick and later ones meaningful.
 */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return 50 * n * (n - 1);
}

export function levelForXp(totalXp: number): number {
  const xp = Number.isFinite(totalXp) && totalXp > 0 ? totalXp : 0;
  const level = Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2);
  // Guard float rounding at exact level boundaries.
  if (xpForLevel(level + 1) <= xp) return level + 1;
  if (xpForLevel(level) > xp) return level - 1;
  return level;
}

export interface LevelProgress {
  readonly level: number;
  readonly totalXp: number;
  /** XP earned inside the current level. */
  readonly intoLevel: number;
  /** XP the current level spans (next threshold − current threshold). */
  readonly levelSpan: number;
  /** 0…1 progress towards the next level. */
  readonly fraction: number;
}

export function levelProgress(totalXp: number): LevelProgress {
  const xp = Number.isFinite(totalXp) && totalXp > 0 ? totalXp : 0;
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const levelSpan = xpForLevel(level + 1) - floor;
  const intoLevel = xp - floor;
  return {
    level,
    totalXp: xp,
    intoLevel,
    levelSpan,
    fraction: levelSpan > 0 ? Math.min(1, intoLevel / levelSpan) : 0,
  };
}

// ── Stored shapes ───────────────────────────────────────────────────────

/** Ledger line per booked entry: `userXp/{uid}/xpLedger/{entryId}`. */
export interface XpLedgerEntry {
  readonly userId: string;
  readonly exerciseId: string;
  /** Mirrors the entry's timestamp so period windows need no join. */
  readonly timestamp: string;
  /** Rate frozen at booking time; edits of the entry reuse it. */
  readonly rate: number;
  readonly xp: number;
  /** `'backfill'` for the one-off migration, so triggers can skip it. */
  readonly source?: 'backfill';
}

/**
 * Current version of the `userXp/{uid}` aggregate. A doc below it is
 * rebuilt from the ledger on the user's next entry.
 */
export const USER_XP_VERSION = 1;

/** Per-user XP aggregate at `userXp/{uid}`. Written by Cloud Functions only. */
export interface UserXp {
  readonly userId: string;
  /** The level is never stored — derive it with {@link levelForXp}. */
  readonly total: number;
  readonly dailyXp: number;
  readonly dailyKey: string;
  readonly weeklyXp: number;
  readonly weeklyKey: string;
  readonly monthlyXp: number;
  readonly monthlyKey: string;
  readonly byExercise: Readonly<Record<string, number>>;
  readonly version: number;
  /**
   * Ids of the last ledger events folded in. Triggers are delivered at
   * least once, and the delta must not be applied twice.
   */
  readonly recentEventIds?: ReadonlyArray<string>;
}
