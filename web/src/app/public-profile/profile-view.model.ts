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
  T extends { exerciseId: string; total: number },
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
    percent: max > 0 ? Math.round((entry.total / max) * 100) : 0,
  }));
}
