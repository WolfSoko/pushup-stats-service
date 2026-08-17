import {
  canonicalizePushupType,
  displayPushupType,
  type UnifiedEntry,
  type UnifiedEntryFilterKey,
  unifiedEntryFilterKey,
  unifiedEntryPrimaryValue,
} from '@pu-stats/models';
import type { AnalysisView, TypeBreakdownDatum } from './analysis.types';
import type { SegmentMeasurement } from './measurement-groups';

/**
 * Best entries and roll-ups measure volume on the entry's own
 * dimension (`unifiedEntryPrimaryValue`), not on `reps` — a plank's
 * volume is its `durationSec` and a run's is its `distanceM`. Callers
 * pass rows of a single measurement, so the resulting numbers share a
 * unit and can be formatted as one.
 */
export function computeBestSingleEntry(
  rows: ReadonlyArray<UnifiedEntry>
): { value: number; timestamp: string } | null {
  // Single-pass max keeps the first occurrence on ties, matching a
  // stable descending sort, without the copy + O(n log n).
  let best: { value: number; timestamp: string } | null = null;
  for (const row of rows) {
    const value = unifiedEntryPrimaryValue(row);
    if (!best || value > best.value) best = { value, timestamp: row.timestamp };
  }
  return best;
}

export function computeBestDay(
  rows: ReadonlyArray<UnifiedEntry>
): { date: string; total: number } | null {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const key = row.timestamp.slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + unifiedEntryPrimaryValue(row));
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
 * True when the breakdown should split pushups into their variants
 * rather than list one slice per exercise kind: the dedicated `pushup`
 * tab, or overview with no/`pushup`-only kind filter. Pushups are
 * rep-measured, so a non-reps segment never shows variants — it would
 * render an empty pie next to a populated chart.
 */
export function showsPushupVariants(
  view: AnalysisView,
  kinds: ReadonlyArray<UnifiedEntryFilterKey>,
  measurement: SegmentMeasurement = 'reps'
): boolean {
  if (measurement !== 'reps') return false;
  if (view === 'pushup') return true;
  return (
    view === 'overview' &&
    (kinds.length === 0 || (kinds.length === 1 && kinds[0] === 'pushup'))
  );
}

/**
 * Breakdown for the type-pie over rows of a single measurement. Slice
 * values carry the entry's primary volume (reps, seconds or meters),
 * so a time-measured exercise no longer surfaces as a 0 % slice.
 * Kind-mode labels are emitted as the bare key — the caller maps
 * id → localised label.
 */
export function computeTypeBreakdown(
  rows: ReadonlyArray<UnifiedEntry>,
  opts: {
    view: AnalysisView;
    kinds: ReadonlyArray<UnifiedEntryFilterKey>;
    locale: string;
    measurement?: SegmentMeasurement;
  }
): TypeBreakdownDatum[] {
  const { view, kinds, locale } = opts;
  const kindSet = kinds.length > 0 ? new Set<string>(kinds) : null;

  if (showsPushupVariants(view, kinds, opts.measurement)) {
    const byType = new Map<string, { reps: number; allSets: number[] }>();
    for (const row of rows) {
      if (row.exerciseId !== 'pushup') continue;
      const key = canonicalizePushupType(row.variantId ?? '') || 'standard';
      const entry = byType.get(key) ?? { reps: 0, allSets: [] };
      entry.reps += unifiedEntryPrimaryValue(row);
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

  const byKind = new Map<string, { reps: number; allSets: number[] }>();
  for (const row of rows) {
    const key = unifiedEntryFilterKey(row);
    if (kindSet && !kindSet.has(key)) continue;
    const bucket = byKind.get(key) ?? { reps: 0, allSets: [] };
    bucket.reps += unifiedEntryPrimaryValue(row);
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
