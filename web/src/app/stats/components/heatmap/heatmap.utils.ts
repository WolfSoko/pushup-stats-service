import { HeatmapCell } from './heatmap.component';

export const defaultHeatmapDays = [
  'Mo',
  'Di',
  'Mi',
  'Do',
  'Fr',
  'Sa',
  'So',
] as const;
export type HeatmapDay = (typeof defaultHeatmapDays)[number];

export function hourTopDownLabels(): string[] {
  // top -> bottom: 23, 22, ... 00
  return Array.from({ length: 24 }, (_, i) => String(23 - i).padStart(2, '0'));
}

export const defaultHeatmapHoursTopDown = hourTopDownLabels();

function weekdayLabel(date: Date): HeatmapDay {
  // getDay(): 0=Sun, 1=Mon... -> convert to 0=Mon, 6=Sun
  const dayIndex = (date.getDay() + 6) % 7;
  return defaultHeatmapDays[dayIndex];
}

/**
 * Measurement bucket the heatmap consumes. Mirrors {@link MeasurementType}
 * with two additions:
 *   - `'mixed'`     — used by the overview / category-overlap views where
 *                     summing different units is meaningless; the heatmap
 *                     then counts entries per cell instead.
 *   - `null` / `undefined` — same fallback (entry count).
 */
export type HeatmapMeasurement =
  | 'reps'
  | 'time'
  | 'distance'
  | 'distance-time'
  | 'weight'
  | 'mixed';

/**
 * Aggregation mode:
 *   - `'primary'`   — sum each entry's primary value
 *                     (reps for reps/weight, durationSec for time,
 *                     distanceM for distance/distance-time, entry count
 *                     for mixed).
 *   - `'breakdown'` — count of the per-entry breakdown (sets for
 *                     reps/weight, intervals for time/distance).
 *                     Not meaningful for `'mixed'`.
 */
export type HeatmapMode = 'primary' | 'breakdown';

export interface HeatmapValueEntry {
  timestamp: string;
  reps?: number;
  durationSec?: number;
  distanceM?: number;
  sets?: number[];
  intervals?: number[];
}

export function entryHeatmapValue(
  entry: HeatmapValueEntry,
  measurement: HeatmapMeasurement | null | undefined,
  mode: HeatmapMode
): number {
  const m = measurement ?? 'mixed';
  if (mode === 'breakdown') {
    // `mixed` has no meaningful breakdown — toggle is hidden in the UI
    // but be defensive: fall back to entry-count.
    if (m === 'mixed') return 1;
    if (m === 'reps' || m === 'weight') return entry.sets?.length ?? 0;
    return entry.intervals?.length ?? 0;
  }
  switch (m) {
    case 'reps':
    case 'weight':
      return entry.reps ?? 0;
    case 'time':
      return entry.durationSec ?? 0;
    case 'distance':
    case 'distance-time':
      return entry.distanceM ?? 0;
    case 'mixed':
      return 1;
  }
}

export function buildHeatmapCells(params: {
  entries: ReadonlyArray<HeatmapValueEntry>;
  days: ReadonlyArray<string>;
  hoursTopDown: ReadonlyArray<string>;
  measurement?: HeatmapMeasurement | null;
  mode?: HeatmapMode;
}): HeatmapCell[] {
  const {
    entries,
    days,
    hoursTopDown,
    measurement = 'reps',
    mode = 'primary',
  } = params;

  const base: HeatmapCell[] = [];
  for (const day of days) {
    for (const hour of hoursTopDown) {
      base.push({ x: day, y: hour, v: 0 });
    }
  }

  const map = new Map<string, number>();
  for (const row of entries) {
    const date = new Date(row.timestamp);
    const dayLabel = weekdayLabel(date);
    const hourLabel = String(date.getHours()).padStart(2, '0');
    const key = `${dayLabel}-${hourLabel}`;
    const value = entryHeatmapValue(row, measurement, mode);
    map.set(key, (map.get(key) ?? 0) + value);
  }

  return base.map((p) => ({
    x: p.x,
    y: p.y,
    v: map.get(`${p.x}-${p.y}`) ?? 0,
  }));
}

export function heatmapCellColor(params: {
  value: number;
  max: number;
}): string {
  const { value } = params;
  const max = Math.max(1, params.max);

  // zero cells should still be visible against the dark card background
  if (value <= 0) return 'rgba(255,255,255,0.04)';

  // perceptual boost for small values
  const ratio = Math.max(0, Math.min(1, value / max));
  const t = Math.pow(ratio, 0.6);
  const alpha = 0.2 + t * 0.8;
  return `rgba(69, 137, 255, ${alpha})`;
}

/**
 * Cell-label formatter — what the datalabel plugin prints on the cell.
 * Kept short so it fits inside the cell at every zoom level:
 *
 *   - reps/weight: plain integer (e.g. `45`)
 *   - time: `m:ss` for sub-hour, `h:mm` for >= 1 h (drops seconds so
 *           the label stays inside the cell)
 *   - distance: `750 m` or `1.5 km` (one decimal for km)
 *   - breakdown / mixed: plain integer
 */
export function formatHeatmapCellLabel(params: {
  value: number;
  measurement: HeatmapMeasurement | null | undefined;
  mode: HeatmapMode;
}): string {
  const { value, measurement, mode } = params;
  if (value <= 0) return '';
  const m = measurement ?? 'mixed';
  if (mode === 'breakdown' || m === 'mixed' || m === 'reps' || m === 'weight') {
    return String(Math.round(value));
  }
  if (m === 'time') return formatDurationCompact(value);
  // distance / distance-time
  return formatDistanceCompact(value);
}

/**
 * Tooltip label — longer than the cell label; includes the unit so the
 * user knows what they're looking at.
 */
export function formatHeatmapTooltipValue(params: {
  value: number;
  measurement: HeatmapMeasurement | null | undefined;
  mode: HeatmapMode;
}): string {
  const { value, measurement, mode } = params;
  const m = measurement ?? 'mixed';
  if (mode === 'breakdown') {
    return String(Math.round(value));
  }
  switch (m) {
    case 'time':
      return formatDurationLong(value);
    case 'distance':
    case 'distance-time':
      return formatDistanceLong(value);
    case 'reps':
    case 'weight':
    case 'mixed':
      return String(Math.round(value));
  }
}

function formatDurationCompact(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}h`;
}

function formatDurationLong(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')} min`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')} h`;
}

function formatDistanceCompact(meters: number): string {
  const v = Math.max(0, meters);
  if (v < 1000) return `${Math.round(v)} m`;
  return `${(v / 1000).toFixed(1)} km`;
}

function formatDistanceLong(meters: number): string {
  const v = Math.max(0, meters);
  if (v < 1000) return `${Math.round(v)} m`;
  return `${(v / 1000).toFixed(2)} km`;
}
