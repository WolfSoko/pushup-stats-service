import {
  type MeasurementType,
  type UnifiedEntry,
  unifiedEntryMeasurement,
} from '@pu-stats/models';
import type { CategorySingleFacet, CategoryVolume } from './analysis.types';

/**
 * `1 km` reads better on the y-axis than `1000`. Distance bars are
 * scaled at the source so every downstream consumer (chart bar,
 * stacked-bar layer, tooltip) sees the same display value. Time stays
 * in seconds and reps stay in reps — the legend communicates the unit.
 */
export function measurementScale(
  measurement: MeasurementType | 'mixed' | null
): number {
  return measurement === 'distance' || measurement === 'distance-time'
    ? 1 / 1000
    : 1;
}

function durationOf(entry: UnifiedEntry): number {
  return entry.kind === 'exercise' ? (entry.durationSec ?? 0) : 0;
}

function distanceOf(entry: UnifiedEntry): number {
  return entry.kind === 'exercise' ? (entry.distanceM ?? 0) : 0;
}

function pickBestDay(byDay: Map<string, number>): [string, number] | null {
  let best: [string, number] | null = null;
  for (const e of byDay.entries()) {
    if (!best || e[1] > best[1]) best = e;
  }
  return best;
}

/**
 * Folds rows that share a single measurement into the matching
 * {@link CategorySingleFacet}. Pushup entries and `'weight'`-measurement
 * exercises route through the reps facet — both expose their volume on
 * `entry.reps`. Best-day always picks the day with the largest primary
 * volume in the facet's dimension; the `distance-time` comparator uses
 * distance because that's what users rank a "best run" by.
 */
export function buildFacet(
  measurement: MeasurementType,
  rows: ReadonlyArray<UnifiedEntry>,
  todayKey: string
): CategorySingleFacet {
  switch (measurement) {
    case 'time': {
      const totalSec = rows.reduce((s, r) => s + durationOf(r), 0);
      const todaySec = rows.reduce(
        (s, r) =>
          r.timestamp.slice(0, 10) === todayKey ? s + durationOf(r) : s,
        0
      );
      const byDay = new Map<string, number>();
      for (const r of rows) {
        const k = r.timestamp.slice(0, 10);
        byDay.set(k, (byDay.get(k) ?? 0) + durationOf(r));
      }
      const bestPair = pickBestDay(byDay);
      return {
        kind: 'time',
        totalSec,
        todaySec,
        bestDay: bestPair ? { date: bestPair[0], totalSec: bestPair[1] } : null,
      };
    }
    case 'distance': {
      const totalM = rows.reduce((s, r) => s + distanceOf(r), 0);
      const todayM = rows.reduce(
        (s, r) =>
          r.timestamp.slice(0, 10) === todayKey ? s + distanceOf(r) : s,
        0
      );
      const byDay = new Map<string, number>();
      for (const r of rows) {
        const k = r.timestamp.slice(0, 10);
        byDay.set(k, (byDay.get(k) ?? 0) + distanceOf(r));
      }
      const bestPair = pickBestDay(byDay);
      return {
        kind: 'distance',
        totalM,
        todayM,
        bestDay: bestPair ? { date: bestPair[0], totalM: bestPair[1] } : null,
      };
    }
    case 'distance-time': {
      const totalM = rows.reduce((s, r) => s + distanceOf(r), 0);
      const totalSec = rows.reduce((s, r) => s + durationOf(r), 0);
      const todayM = rows.reduce(
        (s, r) =>
          r.timestamp.slice(0, 10) === todayKey ? s + distanceOf(r) : s,
        0
      );
      const todaySec = rows.reduce(
        (s, r) =>
          r.timestamp.slice(0, 10) === todayKey ? s + durationOf(r) : s,
        0
      );
      const byDay = new Map<string, { m: number; sec: number }>();
      for (const r of rows) {
        const k = r.timestamp.slice(0, 10);
        const cur = byDay.get(k) ?? { m: 0, sec: 0 };
        cur.m += distanceOf(r);
        cur.sec += durationOf(r);
        byDay.set(k, cur);
      }
      let bestEntry: [string, { m: number; sec: number }] | null = null;
      for (const e of byDay.entries()) {
        if (!bestEntry || e[1].m > bestEntry[1].m) bestEntry = e;
      }
      return {
        kind: 'distance-time',
        totalM,
        totalSec,
        todayM,
        todaySec,
        bestDay: bestEntry
          ? {
              date: bestEntry[0],
              totalM: bestEntry[1].m,
              totalSec: bestEntry[1].sec,
            }
          : null,
      };
    }
    case 'reps':
    case 'weight':
    default: {
      const totalReps = rows.reduce((s, r) => s + r.reps, 0);
      const totalSets = rows.reduce((s, r) => s + (r.sets?.length ?? 0), 0);
      const todayReps = rows.reduce(
        (s, r) => (r.timestamp.slice(0, 10) === todayKey ? s + r.reps : s),
        0
      );
      const byDay = new Map<string, number>();
      for (const r of rows) {
        const k = r.timestamp.slice(0, 10);
        byDay.set(k, (byDay.get(k) ?? 0) + r.reps);
      }
      const bestPair = pickBestDay(byDay);
      return {
        kind: 'reps',
        totalReps,
        totalSets,
        todayReps,
        bestDay: bestPair ? { date: bestPair[0], total: bestPair[1] } : null,
      };
    }
  }
}

/**
 * Maps a measurement type to the facet kind {@link buildFacet} emits
 * for it. `weight` shares the reps-shaped facet (both expose volume on
 * `entry.reps`), so the catalog's reserved `weight` measurement must
 * not produce a second `kind: 'reps'` facet alongside a real reps
 * bucket — that would push two entries with identical `facet.kind` into
 * the card's `@for … track facet.kind` loop and trigger Angular NG0955.
 */
export function facetKindFor(
  measurement: MeasurementType
): CategorySingleFacet['kind'] {
  switch (measurement) {
    case 'time':
      return 'time';
    case 'distance':
      return 'distance';
    case 'distance-time':
      return 'distance-time';
    case 'reps':
    case 'weight':
    default:
      return 'reps';
  }
}

/**
 * Resolves a category's rows into a single measurement facet or a mixed
 * bucket. Bucketing is keyed by *facet kind* rather than the raw
 * {@link MeasurementType}: `reps` and `weight` collapse into one `'reps'`
 * bucket so a category mixing custom weight entries with bodyweight reps
 * doesn't emit two `kind: 'reps'` facets (which would collide under
 * `@for … track facet.kind`). Unknown exerciseIds fold into the reps
 * facet so they still surface a number.
 */
export function computeCategoryVolume(
  rows: ReadonlyArray<UnifiedEntry>,
  todayKey: string
): CategoryVolume {
  const byKind = new Map<
    CategorySingleFacet['kind'],
    { measurement: MeasurementType; rows: UnifiedEntry[] }
  >();
  for (const row of rows) {
    const measurement = unifiedEntryMeasurement(row) ?? 'reps';
    const kind = facetKindFor(measurement);
    const bucket = byKind.get(kind);
    if (bucket) bucket.rows.push(row);
    else byKind.set(kind, { measurement, rows: [row] });
  }
  if (byKind.size === 1) {
    const [{ measurement, rows: group }] = [...byKind.values()];
    return buildFacet(measurement, group, todayKey);
  }
  // Stable facet order: reps → time → distance → distance-time.
  // Matches the dominant-to-rare frequency in the catalog so the
  // primary-movement facet leads the card.
  const order: ReadonlyArray<CategorySingleFacet['kind']> = [
    'reps',
    'time',
    'distance',
    'distance-time',
  ];
  const facets: CategorySingleFacet[] = [];
  for (const kind of order) {
    const bucket = byKind.get(kind);
    if (!bucket?.rows.length) continue;
    facets.push(buildFacet(bucket.measurement, bucket.rows, todayKey));
  }
  return { kind: 'mixed', facets };
}
