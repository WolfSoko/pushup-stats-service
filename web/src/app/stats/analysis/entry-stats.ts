import {
  canonicalizePushupType,
  displayPushupType,
  type UnifiedEntry,
  type UnifiedEntryFilterKey,
  unifiedEntryFilterKey,
} from '@pu-stats/models';
import type { AnalysisView, TypeBreakdownDatum } from './analysis.types';

export function computeBestSingleEntry(
  rows: ReadonlyArray<UnifiedEntry>
): UnifiedEntry | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => b.reps - a.reps)[0] ?? null;
}

export function computeBestDay(
  rows: ReadonlyArray<UnifiedEntry>
): { date: string; total: number } | null {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const key = row.timestamp.slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + row.reps);
  }
  if (!byDay.size) return null;
  const [date, total] = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
  return { date, total };
}

/** Average reps per individual set across the given entries. */
export function computeAvgSetSize(rows: ReadonlyArray<UnifiedEntry>): number {
  const allSets = rows.flatMap((r) => r.sets ?? []);
  if (!allSets.length) return 0;
  return (
    Math.round((allSets.reduce((s, v) => s + v, 0) / allSets.length) * 10) / 10
  );
}

/** Distribution of entries by number of sets (e.g. "3 sets" → 40%). */
export function computeSetsDistribution(
  rows: ReadonlyArray<UnifiedEntry>
): Array<{ setCount: number; count: number; percent: number }> {
  const entriesWithSets = rows.filter(
    (r): r is typeof r & { sets: number[] } => !!r.sets?.length
  );
  if (!entriesWithSets.length) return [];
  const byCount = new Map<number, number>();
  for (const row of entriesWithSets) {
    const setCount = row.sets.length;
    byCount.set(setCount, (byCount.get(setCount) ?? 0) + 1);
  }
  const total = entriesWithSets.length;
  return [...byCount.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([setCount, count]) => ({
      setCount,
      count,
      percent: Math.round((count / total) * 100),
    }));
}

/** Maximum reps in a single set across the given entries. */
export function computeBestSingleSet(
  rows: ReadonlyArray<UnifiedEntry>
): number {
  const allSets = rows.flatMap((r) => r.sets ?? []);
  if (!allSets.length) return 0;
  return Math.max(...allSets);
}

function avgOf(values: ReadonlyArray<number>): number {
  return values.length
    ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
    : 0;
}

/**
 * Breakdown for the type-pie. In overview (or the dedicated `pushup`
 * tab) with no/`pushup`-only kind filter it renders the pushup-variant
 * breakdown; every other case renders the kind-mode breakdown over the
 * given rows. Kind-mode labels are emitted as the bare key — the caller
 * maps id → localised label.
 */
export function computeTypeBreakdown(
  rows: ReadonlyArray<UnifiedEntry>,
  opts: {
    view: AnalysisView;
    kinds: ReadonlyArray<UnifiedEntryFilterKey>;
    locale: string;
  }
): TypeBreakdownDatum[] {
  const { view, kinds, locale } = opts;
  const kindSet = kinds.length > 0 ? new Set<string>(kinds) : null;
  const showPushupVariants =
    view === 'pushup' ||
    (view === 'overview' &&
      (!kindSet || (kindSet.size === 1 && kindSet.has('pushup'))));

  if (showPushupVariants) {
    const byType = new Map<string, { reps: number; allSets: number[] }>();
    for (const row of rows) {
      if (row.exerciseId !== 'pushup') continue;
      const key = canonicalizePushupType(row.variantId ?? '') || 'standard';
      const entry = byType.get(key) ?? { reps: 0, allSets: [] };
      entry.reps += row.reps;
      if (row.sets?.length) entry.allSets.push(...row.sets);
      byType.set(key, entry);
    }
    return [...byType.entries()]
      .sort((a, b) => b[1].reps - a[1].reps)
      .map(([key, { reps, allSets }]) => ({
        id: key,
        label: displayPushupType(key, locale),
        value: reps,
        avgSetSize: avgOf(allSets),
      }));
  }

  // Reps-only view: `time` and `distance-time` exercises surface with
  // `value = 0` until per-measurement charts land.
  const byKind = new Map<string, { reps: number; allSets: number[] }>();
  for (const row of rows) {
    const key = unifiedEntryFilterKey(row);
    if (kindSet && !kindSet.has(key)) continue;
    const bucket = byKind.get(key) ?? { reps: 0, allSets: [] };
    bucket.reps += row.reps;
    if (row.sets?.length) bucket.allSets.push(...row.sets);
    byKind.set(key, bucket);
  }
  return [...byKind.entries()]
    .sort((a, b) => b[1].reps - a[1].reps)
    .map(([key, { reps, allSets }]) => ({
      id: key,
      label: key,
      value: reps,
      avgSetSize: avgOf(allSets),
    }));
}
