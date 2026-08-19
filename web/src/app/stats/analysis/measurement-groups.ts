import {
  type ExerciseDefinition,
  findExerciseDefinition,
  type MeasurementType,
  type UnifiedEntry,
  unifiedEntryMeasurement,
} from '@pu-stats/models';

/**
 * Measurement a single chart/KPI block renders. `'mixed'` is the
 * trailing bucket for rows whose `exerciseId` neither the catalog nor
 * the user's custom definitions resolve — they keep a block of their
 * own instead of dragging seconds into the reps numbers.
 */
export type SegmentMeasurement = MeasurementType | 'mixed';

/**
 * Stable block order: reps → weight → time → distance → distance-time,
 * unresolvable rows last. Mirrors `computeCategoryVolume`'s facet order
 * so a category's overview card and its detail tab list their
 * dimensions the same way.
 */
export const SEGMENT_ORDER: ReadonlyArray<SegmentMeasurement> = [
  'reps',
  'weight',
  'time',
  'distance',
  'distance-time',
  'mixed',
];

export function groupRowsByMeasurement(
  rows: ReadonlyArray<UnifiedEntry>,
  resolveDefinition: (
    id: string
  ) => ExerciseDefinition | null = findExerciseDefinition
): Map<SegmentMeasurement, UnifiedEntry[]> {
  const byMeasurement = new Map<SegmentMeasurement, UnifiedEntry[]>();
  for (const row of rows) {
    const measurement =
      unifiedEntryMeasurement(row, resolveDefinition) ?? 'mixed';
    const group = byMeasurement.get(measurement);
    if (group) group.push(row);
    else byMeasurement.set(measurement, [row]);
  }
  return byMeasurement;
}
