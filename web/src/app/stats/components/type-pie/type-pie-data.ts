import type { PieArcSegment, PieDatum, PieSegment } from './type-pie.models';

export const TOP_N = 5;

export const PIE_PALETTE = [
  '#1976d2', // blue
  '#9c27b0', // purple
  '#2e7d32', // green
  '#ef6c00', // orange
  '#d32f2f', // red
  '#00838f', // teal
  '#5d4037', // brown
  '#455a64', // blue grey
];

export function pieTotal(data: readonly PieDatum[]): number {
  return data.reduce((sum, x) => sum + (x.value || 0), 0);
}

export function buildAllSegments(
  data: readonly PieDatum[],
  palette: readonly string[] = PIE_PALETTE
): PieSegment[] {
  const total = pieTotal(data);
  if (!total) return [];

  const rows = [...data]
    .filter((x) => (x.value || 0) > 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  return rows.map((row, idx) => ({
    id: row.id ?? row.label,
    label: row.label,
    value: row.value || 0,
    percent: Math.round(((row.value || 0) / total) * 100),
    color: palette[idx % palette.length],
    avgSetSize: row.avgSetSize ?? 0,
  }));
}

export function topNIds(
  segments: readonly PieSegment[],
  n = TOP_N
): ReadonlySet<string> {
  return new Set(segments.slice(0, n).map((s) => s.id));
}

export function setsEqual(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>
): boolean {
  if (a.size !== b.size) return false;
  for (const id of b) {
    if (!a.has(id)) return false;
  }
  return true;
}

export function selectedTotal(
  segments: readonly PieSegment[],
  selected: ReadonlySet<string>
): number {
  return segments
    .filter((s) => selected.has(s.id))
    .reduce((sum, s) => sum + s.value, 0);
}

/**
 * Maps selected segments to SVG donut arcs. `offset` starts at 25 so the
 * first arc begins at the top of the rotated circle; `dasharray` encodes
 * the arc/gap as percentages of the 100-unit circumference.
 */
export function buildArcSegments(
  segments: readonly PieSegment[],
  selected: ReadonlySet<string>
): PieArcSegment[] {
  const total = selectedTotal(segments, selected);
  if (!total) return [];

  let acc = 0;
  return segments
    .filter((s) => selected.has(s.id))
    .map((seg) => {
      const dash = (seg.value / total) * 100;
      const result: PieArcSegment = {
        ...seg,
        percent: Math.round((seg.value / total) * 100),
        dasharray: `${dash} ${100 - dash}`,
        offset: 25 - acc,
      };
      acc += dash;
      return result;
    });
}

export function percentOfSelected(
  segments: readonly PieSegment[],
  selected: ReadonlySet<string>,
  id: string
): number | null {
  if (!selected.has(id)) return null;
  const total = selectedTotal(segments, selected);
  if (total <= 0) return null;
  const seg = segments.find((s) => s.id === id);
  if (!seg) return null;
  return Math.round((seg.value / total) * 100);
}
