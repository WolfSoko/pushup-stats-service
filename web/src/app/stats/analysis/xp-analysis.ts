import {
  findExerciseDefinition,
  type ExerciseCategoryId,
  type ExerciseEntry,
} from '@pu-stats/models';

/**
 * XP roll-up for the analysis page's selected range.
 *
 * XP per entry comes from the caller (`XpStore.xpOfEntry`): the booked
 * ledger value where there is one, so the numbers here match what the
 * server counted even after an admin re-weighted an exercise.
 */

export interface XpBucket {
  /** ISO date of the day, or of the Monday for weekly buckets. */
  readonly key: string;
  readonly xp: number;
}

export interface XpShare<TId extends string> {
  readonly id: TId;
  readonly xp: number;
  /** 0…1 share of the range total. */
  readonly share: number;
}

export interface XpAnalysis {
  readonly total: number;
  readonly activeDays: number;
  readonly granularity: 'day' | 'week';
  readonly buckets: ReadonlyArray<XpBucket>;
  readonly byCategory: ReadonlyArray<XpShare<ExerciseCategoryId>>;
  readonly topExercises: ReadonlyArray<XpShare<string>>;
  readonly bestDay: XpBucket | null;
}

/** Ranges longer than this switch the chart to weekly bars. */
export const XP_DAILY_BUCKET_LIMIT = 45;
const TOP_EXERCISES = 5;

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return addDays(isoDate, -((d.getUTCDay() + 6) % 7));
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000
  );
}

function shares<TId extends string>(
  totals: Map<TId, number>,
  total: number
): XpShare<TId>[] {
  return [...totals]
    .filter(([, xp]) => xp > 0)
    .map(([id, xp]) => ({ id, xp, share: total > 0 ? xp / total : 0 }))
    .sort((a, b) => b.xp - a.xp || a.id.localeCompare(b.id));
}

/**
 * Buckets span the whole range, empty days included, so the bars read
 * as a timeline rather than a list of active days. Without a bounded
 * range the buckets span first to last entry.
 */
export function buildXpAnalysis(
  entries: ReadonlyArray<ExerciseEntry>,
  xpOf: (entry: ExerciseEntry) => number,
  range: { readonly from: string; readonly to: string }
): XpAnalysis {
  const perDay = new Map<string, number>();
  const perCategory = new Map<ExerciseCategoryId, number>();
  const perExercise = new Map<string, number>();
  let total = 0;

  for (const entry of entries) {
    const xp = xpOf(entry);
    if (!(xp > 0)) continue;
    total += xp;
    const day = entry.timestamp.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + xp);
    perExercise.set(
      entry.exerciseId,
      (perExercise.get(entry.exerciseId) ?? 0) + xp
    );
    const categoryId = findExerciseDefinition(entry.exerciseId)?.categoryId;
    if (categoryId) {
      perCategory.set(categoryId, (perCategory.get(categoryId) ?? 0) + xp);
    }
  }

  const days = [...perDay.keys()].sort();
  const from = range.from || days[0] || '';
  const to = range.to || days[days.length - 1] || '';
  const span = from && to ? daysBetween(from, to) : -1;
  const granularity = span >= XP_DAILY_BUCKET_LIMIT ? 'week' : 'day';

  const buckets: XpBucket[] = [];
  if (span >= 0) {
    const step = granularity === 'week' ? 7 : 1;
    const start = granularity === 'week' ? mondayOf(from) : from;
    for (let key = start; key <= to; key = addDays(key, step)) {
      let xp = 0;
      for (let i = 0; i < step; i++) xp += perDay.get(addDays(key, i)) ?? 0;
      buckets.push({ key, xp });
    }
  }

  let bestDay: XpBucket | null = null;
  for (const [key, xp] of perDay) {
    if (!bestDay || xp > bestDay.xp) bestDay = { key, xp };
  }

  return {
    total,
    activeDays: perDay.size,
    granularity,
    buckets,
    byCategory: shares(perCategory, total),
    topExercises: shares(perExercise, total).slice(0, TOP_EXERCISES),
    bestDay,
  };
}
