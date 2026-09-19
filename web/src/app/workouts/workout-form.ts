import {
  EXERCISE_CATEGORIES,
  type ExerciseDefinition,
  exercisesByCategory,
  findExerciseDefinition,
  type TrainingPlanExercise,
  type Workout,
  type WorkoutInput,
} from '@pu-stats/models';

import {
  categoryDisplayName,
  exerciseDisplayName,
  variantDisplayName,
} from '../stats/i18n/exercise-display-names';

/**
 * The editor's form state and its translation to and from a workout.
 * Kept free of Angular so the parsing rules — above all how a typed set
 * list becomes numbers — are testable on their own.
 */

/** One exercise row as the user edits it. */
export interface WorkoutFormLine {
  readonly exerciseId: string;
  /** Empty string ⇒ no variant. */
  readonly variantId: string;
  readonly target: number;
  /** Typed as the user left it, e.g. `10, 10, 10`; empty ⇒ no sets. */
  readonly sets: string;
}

export interface WorkoutFormState {
  readonly title: string;
  readonly description: string;
  readonly lines: ReadonlyArray<WorkoutFormLine>;
  readonly onProfile: boolean;
}

export const DEFAULT_LINE_EXERCISE = 'pushup';

export function emptyLine(exerciseId = DEFAULT_LINE_EXERCISE): WorkoutFormLine {
  const def = findExerciseDefinition(exerciseId);
  return {
    exerciseId,
    variantId: '',
    target: def?.measurement === 'time' ? 30 : 10,
    sets: '',
  };
}

export function emptyForm(): WorkoutFormState {
  return { title: '', description: '', lines: [emptyLine()], onProfile: false };
}

export function formFromWorkout(workout: Workout): WorkoutFormState {
  return {
    title: workout.title,
    description: workout.description,
    onProfile: workout.onProfile,
    lines: workout.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      variantId: e.variantId ?? '',
      target: e.target,
      sets: e.sets ? e.sets.join(', ') : '',
    })),
  };
}

/**
 * `10, 10, 10` → `[10, 10, 10]`. Any separator that is not a digit
 * works, so `10/10/10` and `10 10 10` parse too. Returns `null` for an
 * empty string (no breakdown) and `[]`-with-garbage as the model would
 * see it, so the model's own check (`sets` must sum to the target) is
 * the one that refuses it.
 */
export function parseSets(text: string): number[] | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  return trimmed
    .split(/[^\d]+/)
    .filter((part) => part !== '')
    .map((part) => Number(part));
}

/** The set list as text, so a rewritten line reads back the same. */
export function formatSets(sets: ReadonlyArray<number> | undefined): string {
  return sets ? sets.join(', ') : '';
}

export function lineToExercise(line: WorkoutFormLine): TrainingPlanExercise {
  const sets = parseSets(line.sets);
  return {
    exerciseId: line.exerciseId,
    target: line.target,
    ...(line.variantId ? { variantId: line.variantId } : {}),
    ...(sets ? { sets } : {}),
  };
}

export function formToInput(form: WorkoutFormState): WorkoutInput {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    exercises: form.lines.map(lineToExercise),
    onProfile: form.onProfile,
  };
}

/**
 * The sum of a typed set list, or `null` when it does not parse. The
 * editor fills the target from it so `10, 10, 10` and `30` never
 * disagree.
 */
export function setsTotal(text: string): number | null {
  const sets = parseSets(text);
  if (!sets || sets.length === 0) return null;
  if (!sets.every((s) => Number.isInteger(s) && s > 0)) return null;
  return sets.reduce((sum, s) => sum + s, 0);
}

export interface ExerciseOption {
  readonly id: string;
  readonly label: string;
}

export interface ExerciseOptionGroup {
  readonly label: string;
  readonly options: ReadonlyArray<ExerciseOption>;
}

/** Every exercise a workout may name, grouped by category for the select. */
export function workoutExerciseGroups(): ExerciseOptionGroup[] {
  const byCategory = exercisesByCategory();
  const groups: ExerciseOptionGroup[] = [];
  for (const category of EXERCISE_CATEGORIES) {
    const defs = (byCategory.get(category.id) ?? []).filter(
      (def) => def.measurement !== 'weight'
    );
    if (defs.length === 0) continue;
    groups.push({
      label: categoryDisplayName(category.id),
      options: defs.map((def) => ({
        id: def.id,
        label: exerciseDisplayName(def.id),
      })),
    });
  }
  return groups;
}

/** Variant choices for one exercise; empty when it has none to pick from. */
export function variantOptions(exerciseId: string): ExerciseOption[] {
  const def = findExerciseDefinition(exerciseId);
  return (def?.variants ?? []).map((v) => ({
    id: v.id,
    label: variantDisplayName(v),
  }));
}

/** Unit label for the target field: `Wdh.`, `Sek.` or `m`. */
export function targetUnitLabel(exerciseId: string): string {
  const def: ExerciseDefinition | null = findExerciseDefinition(exerciseId);
  switch (def?.measurement) {
    case 'time':
      return $localize`:@@workouts.editor.unit.seconds:Sek.`;
    case 'distance':
    case 'distance-time':
      return $localize`:@@workouts.editor.unit.meters:m`;
    default:
      return $localize`:@@workouts.editor.unit.reps:Wdh.`;
  }
}
