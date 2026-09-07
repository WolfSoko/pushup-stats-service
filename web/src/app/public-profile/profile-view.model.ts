export interface HeatmapCell {
  readonly hour: number;
  readonly intensity: number;
  readonly title: string;
}

export interface HeatmapRow {
  readonly weekday: string;
  readonly cells: ReadonlyArray<HeatmapCell>;
}

export interface ExerciseRow {
  readonly exerciseId: string;
  readonly name: string;
  readonly value: string;
  readonly percent: number;
  readonly measurement: string;
}

export interface ExerciseGroup {
  readonly measurement:
    'reps' | 'time' | 'distance' | 'weight' | 'distance-time';
  readonly rows: ReadonlyArray<ExerciseRow>;
}

/**
 * Weekday keys as the stats trigger writes them (German abbreviations,
 * baked into the stored data). The caller maps them to localised labels
 * so an English profile does not show "Mo, Di, Mi".
 */
export const HEATMAP_WEEKDAYS = [
  'Mo',
  'Di',
  'Mi',
  'Do',
  'Fr',
  'Sa',
  'So',
] as const;

/**
 * Seven weekday rows × 24 hours. Empty when nothing was ever logged —
 * a grid of blank cells says less than no section at all.
 */
export function buildHeatmapRows(
  map: Readonly<Record<string, number>>,
  labels: Readonly<Record<string, string>>
): ReadonlyArray<HeatmapRow> {
  const values = Object.values(map);
  const max = values.length > 0 ? Math.max(...values) : 0;
  if (max <= 0) return [];
  return HEATMAP_WEEKDAYS.map((day) => ({
    weekday: labels[day],
    cells: Array.from({ length: 24 }, (_, hour) => {
      const reps = map[`${day}-${String(hour).padStart(2, '0')}`] ?? 0;
      return {
        hour,
        // Floor at a faint tint so the grid still reads as a grid;
        // a pure 0 would make empty hours invisible.
        intensity: reps > 0 ? 0.2 + 0.8 * (reps / max) : 0.06,
        title: `${labels[day]} ${String(hour).padStart(2, '0')}:00`,
      };
    }),
  }));
}

/**
 * Exercises as labelled bars. The bar is relative to the biggest entry,
 * never a share of a total: the stored numbers mix reps, seconds and
 * metres, so a common denominator would be meaningless.
 */
export function buildExerciseRows<
  T extends { exerciseId: string; total: number; measurement: string },
>(
  exercises: ReadonlyArray<T>,
  name: (entry: T) => string,
  value: (entry: T) => string
): ReadonlyArray<ExerciseRow> {
  if (exercises.length === 0) return [];
  const max = Math.max(...exercises.map((e) => e.total));
  return exercises.map((entry) => ({
    exerciseId: entry.exerciseId,
    name: name(entry),
    value: value(entry),
    measurement: entry.measurement,
    percent: max > 0 ? Math.round((entry.total / max) * 100) : 0,
  }));
}

export function groupExercisesByMeasurement(
  rows: ReadonlyArray<ExerciseRow>
): ReadonlyArray<ExerciseGroup> {
  const groups = new Map<string, ExerciseRow[]>();
  for (const row of rows) {
    const group = groups.get(row.measurement) ?? [];
    groups.set(row.measurement, [...group, row]);
  }
  const order: Record<string, number> = {
    reps: 1,
    time: 2,
    distance: 3,
    'distance-time': 4,
    weight: 5,
  };
  return Array.from(groups.entries())
    .sort((a, b) => (order[a[0]] ?? 999) - (order[b[0]] ?? 999))
    .map(([measurement, measurementRows]) => ({
      measurement: measurement as ExerciseGroup['measurement'],
      rows: measurementRows,
    }));
}
