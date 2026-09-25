import { toLocalIsoDate } from '@pu-stats/date';
import {
  addDays,
  findExerciseDefinition,
  type ExerciseCategoryId,
  type StatsGranularity,
  type XpEntryInput,
} from '@pu-stats/models';

import { startOfIsoWeek } from './trend-math';

/**
 * XP roll-up for the analysis page's selected range.
 *
 * XP per entry comes from the caller: the booked ledger value where there
 * is one, so the numbers here match what the server counted even after an
 * admin re-weighted an exercise.
 */

export type XpAnalysisEntry = XpEntryInput & {
  readonly _id: string;
  readonly timestamp: string;
};

export type XpBucketGranularity = 'daily' | 'weekly' | 'monthly';

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
  readonly granularity: XpBucketGranularity;
  readonly buckets: ReadonlyArray<XpBucket>;
  readonly byCategory: ReadonlyArray<XpShare<ExerciseCategoryId>>;
  readonly topExercises: ReadonlyArray<XpShare<string>>;
  readonly bestDay: XpBucket | null;
}

const TOP_EXERCISES = 5;

/** The page's chart granularity, with hourly (a single day) shown per day. */
export function xpBucketGranularity(
  granularity: StatsGranularity
): XpBucketGranularity {
  return granularity === 'hourly' ? 'daily' : granularity;
}

function bucketKey(isoDate: string, granularity: XpBucketGranularity): string {
  if (granularity === 'monthly') return `${isoDate.slice(0, 7)}-01`;
  if (granularity === 'weekly') {
    return toLocalIsoDate(startOfIsoWeek(new Date(`${isoDate}T00:00:00`)));
  }
  return isoDate;
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
  entries: ReadonlyArray<XpAnalysisEntry>,
  xpOf: (entry: XpAnalysisEntry) => number,
  range: {
    readonly from: string;
    readonly to: string;
    readonly granularity: XpBucketGranularity;
  }
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
  const granularity = range.granularity;

  const perBucket = new Map<string, number>();
  if (from && to) {
    for (let day = from; day <= to; day = addDays(day, 1)) {
      const key = bucketKey(day, granularity);
      perBucket.set(key, (perBucket.get(key) ?? 0) + (perDay.get(day) ?? 0));
    }
  }
  const buckets: XpBucket[] = [...perBucket].map(([key, xp]) => ({ key, xp }));

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
