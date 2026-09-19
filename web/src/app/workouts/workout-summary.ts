import {
  findExerciseDefinition,
  formatExerciseValue,
  type TrainingPlanExercise,
} from '@pu-stats/models';

import {
  exerciseDisplayName,
  variantDisplayName,
} from '../stats/i18n/exercise-display-names';

/**
 * One exercise line as the list and the profile show it:
 * `3×10 Liegestütze`, `0:50 Plank`, `500 m Laufen`. The name carries the
 * variant when one is prescribed, the amount is in the exercise's unit.
 */
export function workoutExerciseLine(exercise: TrainingPlanExercise): string {
  const def = findExerciseDefinition(exercise.exerciseId);
  const unit = def?.unit ?? 'reps';
  const variant = def?.variants?.find((v) => v.id === exercise.variantId);
  const base = exerciseDisplayName(exercise.exerciseId);
  const name = variant ? `${base} · ${variantDisplayName(variant)}` : base;
  const sets = exercise.sets;
  if (sets && sets.length > 1 && sets.every((s) => s === sets[0])) {
    return `${sets.length}×${formatExerciseValue(sets[0], unit)} ${name}`;
  }
  if (sets && sets.length > 1) {
    return `${sets.map((s) => formatExerciseValue(s, unit)).join('/')} ${name}`;
  }
  return `${formatExerciseValue(exercise.target, unit)} ${name}`;
}

/** Every line of a workout joined for a card subtitle. */
export function workoutSummary(
  exercises: ReadonlyArray<TrainingPlanExercise>
): string {
  return exercises.map(workoutExerciseLine).join(' · ');
}
