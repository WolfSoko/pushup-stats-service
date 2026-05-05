import type {
  ExerciseCategoryInfo,
  ExerciseDefinition,
} from './exercise.models';

/**
 * Curated catalog of exercise categories shown in the dashboard and
 * filter UI. Order determines top-to-bottom layout on the dashboard.
 *
 * Phase 0 lists only the categories with at least one exercise in
 * {@link EXERCISE_CATALOG} below — additional categories (plank, cardio,
 * strength, mobility) are added incrementally with their own exercises.
 */
export const EXERCISE_CATEGORIES: ReadonlyArray<ExerciseCategoryInfo> = [
  {
    id: 'pushup',
    nameKey: '@@exercise.category.pushup',
    icon: 'fitness_center',
    order: 10,
  },
  {
    id: 'abs',
    nameKey: '@@exercise.category.abs',
    icon: 'self_improvement',
    order: 20,
  },
  {
    id: 'legs',
    nameKey: '@@exercise.category.legs',
    icon: 'directions_run',
    order: 30,
  },
];

/**
 * Standard catalog of exercises available to every user. Phase 0 ships
 * with sit-ups (abs) and squats (legs). The pushup catalog stays in
 * `pushup-type.models.ts` for backwards compatibility with existing
 * Firestore docs in the `pushups` collection — see roadmap.
 *
 * Caps mirror the `exerciseEntries` Firestore rule. Any change here MUST
 * be reflected in `data-store/firestore.rules` and vice versa.
 */
export const EXERCISE_CATALOG: ReadonlyArray<ExerciseDefinition> = [
  {
    id: 'abs.situps',
    categoryId: 'abs',
    measurement: 'reps',
    min: 1,
    max: 500,
    unit: 'reps',
    nameKey: '@@exercise.abs.situps.name',
    icon: 'self_improvement',
  },
  {
    id: 'legs.squats',
    categoryId: 'legs',
    measurement: 'reps',
    min: 1,
    max: 500,
    unit: 'reps',
    nameKey: '@@exercise.legs.squats.name',
    icon: 'directions_run',
  },
];

const CATALOG_BY_ID: ReadonlyMap<string, ExerciseDefinition> = new Map(
  EXERCISE_CATALOG.map((d) => [d.id, d])
);

const CATEGORIES_BY_ID: ReadonlyMap<string, ExerciseCategoryInfo> = new Map(
  EXERCISE_CATEGORIES.map((c) => [c.id, c])
);

export function findExerciseDefinition(
  id: string | null | undefined
): ExerciseDefinition | null {
  if (!id) return null;
  return CATALOG_BY_ID.get(id) ?? null;
}

export function findExerciseCategory(
  id: string | null | undefined
): ExerciseCategoryInfo | null {
  if (!id) return null;
  return CATEGORIES_BY_ID.get(id) ?? null;
}

/**
 * Catalog exercises grouped by category, in catalog declaration order
 * within each group. Useful for category-pickers and dashboard sections.
 */
export function exercisesByCategory(): ReadonlyMap<
  ExerciseCategoryInfo['id'],
  ReadonlyArray<ExerciseDefinition>
> {
  const map = new Map<
    ExerciseCategoryInfo['id'],
    ExerciseDefinition[]
  >();
  for (const cat of EXERCISE_CATEGORIES) {
    map.set(cat.id, []);
  }
  for (const def of EXERCISE_CATALOG) {
    const bucket = map.get(def.categoryId);
    if (bucket) bucket.push(def);
  }
  return map;
}
