import type { PublicProfileExercise } from '@pu-stats/models';

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
 * `distance-time` folds into `distance`: both store metres and render
 * through the same km/m formatting, so their bars are comparable.
 */
export type ExerciseGroupKind = 'reps' | 'time' | 'distance' | 'weight';

export interface ExerciseGroup {
  readonly kind: ExerciseGroupKind;
  readonly label: string;
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

const GROUP_KIND: Readonly<
  Record<PublicProfileExercise['measurement'], ExerciseGroupKind>
> = {
  reps: 'reps',
  time: 'time',
  distance: 'distance',
  'distance-time': 'distance',
  weight: 'weight',
};

const GROUP_ORDER: ReadonlyArray<ExerciseGroupKind> = [
  'reps',
  'time',
  'distance',
  'weight',
];

/**
 * Exercises as labelled bars, split by what they measure.
 *
 * A bar is relative to the biggest entry *of its own group*, never a
 * share of a total and never relative to the whole profile: the stored
 * numbers mix reps, seconds and metres, so a shared denominator would
 * squash every plank next to a five-digit rep count.
 */
export function buildExerciseGroups<
  T extends {
    exerciseId: string;
    total: number;
    measurement: PublicProfileExercise['measurement'];
  },
>(
  exercises: ReadonlyArray<T>,
  name: (entry: T) => string,
  value: (entry: T) => string,
  label: (kind: ExerciseGroupKind) => string
): ReadonlyArray<ExerciseGroup> {
  const byKind = new Map<ExerciseGroupKind, T[]>();
  for (const entry of exercises) {
    const kind = GROUP_KIND[entry.measurement];
    byKind.set(kind, [...(byKind.get(kind) ?? []), entry]);
  }
  return [...byKind.entries()]
    .sort(([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))
    .map(([kind, entries]) => {
      const max = Math.max(...entries.map((e) => e.total));
      return {
        kind,
        label: label(kind),
        rows: entries.map((entry) => ({
          exerciseId: entry.exerciseId,
          name: name(entry),
          value: value(entry),
          percent: max > 0 ? Math.round((entry.total / max) * 100) : 0,
        })),
      };
    });
}

export interface RecentRow {
  /** Stable key: two entries can share a second but not an exercise. */
  readonly key: string;
  readonly name: string;
  readonly value: string;
  readonly timestamp: string;
}

/**
 * The "what did they just train" tiles. Formatting is handed in so this
 * stays free of `$localize` and the locale — the page owns both.
 */
export function buildRecentRows(
  entries: ReadonlyArray<{
    exerciseId: string;
    value: number;
    measurement: string;
    timestamp: string;
  }>,
  name: (exerciseId: string) => string,
  value: (entry: { value: number; measurement: string }) => string
): ReadonlyArray<RecentRow> {
  return entries.map((entry, index) => ({
    key: `${entry.timestamp}-${entry.exerciseId}-${index}`,
    name: name(entry.exerciseId),
    value: value(entry),
    timestamp: entry.timestamp,
  }));
}
