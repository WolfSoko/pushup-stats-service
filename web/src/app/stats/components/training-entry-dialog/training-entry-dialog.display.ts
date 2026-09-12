import {
  COMPANION_BOUNDS,
  ExerciseDefinition,
  formatExerciseValue,
} from '@pu-stats/models';

export function formattedExerciseMax(
  def: ExerciseDefinition | null,
  repsMax: number
): string {
  if (!def) return String(repsMax);
  return formatExerciseValue(def.max, def.unit);
}

export function formattedDurationMax(): string {
  return formatExerciseValue(COMPANION_BOUNDS.durationSec.max, 's');
}
