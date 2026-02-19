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

export function buildHeatmapCells(params: {
  entries: ReadonlyArray<{ timestamp: string; reps: number }>;
  days: ReadonlyArray<string>;
  hoursTopDown: ReadonlyArray<string>;
}): HeatmapCell[] {
  const { entries, days, hoursTopDown } = params;

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
    map.set(key, (map.get(key) ?? 0) + row.reps);
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
