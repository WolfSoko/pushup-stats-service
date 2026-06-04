import type {
  ExerciseCategoryInfo,
  ExerciseDefinition,
} from './exercise.models';
import { PUSHUP_REPS_MAX, PUSHUP_REPS_MIN } from './pushup.models';

/**
 * Curated catalog of exercise categories shown in the dashboard and
 * filter UI. Order determines top-to-bottom layout on the dashboard
 * (lower = higher up).
 *
 * Categories follow the movement-pattern taxonomy documented on
 * {@link import('./exercise.models').ExerciseCategoryId}.
 *
 * Existing user entries reference exercises by id, not by category, so
 * recategorizing an exercise (e.g. moving `legs.squats` into the
 * `squat` category) is a UI-only change — no Firestore migration is
 * needed. Legacy entries in the `pushups` collection map to the
 * `pushup` category via
 * {@link import('./unified-entry.models').unifiedEntryCategoryId}, so
 * Liegestütze keep their dedicated bucket separate from the generic
 * `push` movement-pattern category.
 */
export const EXERCISE_CATEGORIES: ReadonlyArray<ExerciseCategoryInfo> = [
  {
    id: 'pushup',
    nameKey: '@@exercise.category.pushup',
    icon: 'fitness_center',
    order: 5,
  },
  {
    id: 'push',
    nameKey: '@@exercise.category.push',
    icon: 'open_with',
    order: 10,
  },
  {
    id: 'pull',
    nameKey: '@@exercise.category.pull',
    icon: 'rowing',
    order: 20,
  },
  {
    id: 'squat',
    nameKey: '@@exercise.category.squat',
    icon: 'airline_seat_legroom_reduced',
    order: 30,
  },
  {
    id: 'hinge',
    nameKey: '@@exercise.category.hinge',
    icon: 'compress',
    order: 40,
  },
  {
    id: 'lunge',
    nameKey: '@@exercise.category.lunge',
    icon: 'directions_walk',
    order: 50,
  },
  {
    id: 'core',
    nameKey: '@@exercise.category.core',
    icon: 'self_improvement',
    order: 70,
  },
  {
    id: 'cardio',
    nameKey: '@@exercise.category.cardio',
    icon: 'directions_run',
    order: 80,
  },
  {
    id: 'mobility',
    nameKey: '@@exercise.category.mobility',
    icon: 'accessibility_new',
    order: 90,
  },
  // `carry` (distance) and `strength` (weight) are declared in
  // ExerciseCategoryId for forward compatibility but stay out of the
  // picker until the training-entry dialog grows weight + distance-only
  // form fields and the Firestore rule learns the matching companion
  // bounds. Today the dialog falls back to a reps payload for any
  // measurement it doesn't recognise — surfacing those exercises now
  // would put users in front of a save-error path.
];

/**
 * Standard catalog of exercises available to every user.
 *
 * Exercise IDs are stable — they're stored on every `ExerciseEntry`
 * Firestore doc. Renaming an id requires a data migration. Recategorizing
 * (changing `categoryId` only) does not.
 *
 * Pushup variants stay on `PushupRecord` in the legacy `pushups`
 * collection — see `pushup-type.models.ts` and the Phase 7 migration
 * note in `plans/multi-exercise-roadmap.md`.
 *
 * Caps mirror the `exerciseEntries` Firestore rule. Any change here MUST
 * be reflected in `data-store/firestore.rules` and vice versa.
 */

/**
 * Pushups (`id: 'pushup'`) are a first-class catalog exercise: post Phase-7
 * cutover they live in `exerciseEntries` with `exerciseId:'pushup'` and
 * aggregate into `perExercise/pushup` like any other exercise. Exported as a
 * named const (legacy callers reference it directly) and listed in
 * {@link EXERCISE_CATALOG} below so the dashboard, goal picker,
 * leaderboard rebuild, `firestore.rules` allowlist codegen, display-name
 * registry, and camera auto-count all pick it up automatically.
 */
export const PUSHUP_DEFINITION: ExerciseDefinition = {
  id: 'pushup',
  categoryId: 'pushup',
  autoCountProfileId: 'pushup',
  measurement: 'reps',
  min: PUSHUP_REPS_MIN,
  max: PUSHUP_REPS_MAX,
  unit: 'reps',
  nameKey: '@@exercise.category.pushup',
  icon: 'fitness_center',
};

export const EXERCISE_CATALOG: ReadonlyArray<ExerciseDefinition> = [
  PUSHUP_DEFINITION,
  {
    // Legacy id `abs.situps` predates the movement-pattern restructure.
    // Kept as-is so existing Firestore docs continue to resolve; only
    // the `categoryId` moves them from `abs` → `core`.
    id: 'abs.situps',
    categoryId: 'core',
    autoCountProfileId: 'situp',
    measurement: 'reps',
    min: 1,
    max: 500,
    unit: 'reps',
    nameKey: '@@exercise.abs.situps.name',
    icon: 'self_improvement',
    variants: [
      {
        id: 'standard',
        nameKey: '@@exercise.variant.situps.standard',
        difficulty: 'beginner',
      },
      {
        id: 'decline',
        nameKey: '@@exercise.variant.situps.decline',
        difficulty: 'intermediate',
      },
      {
        id: 'weighted',
        nameKey: '@@exercise.variant.situps.weighted',
        difficulty: 'advanced',
      },
    ],
  },
  {
    id: 'abs.crunches',
    categoryId: 'core',
    measurement: 'reps',
    min: 1,
    max: 500,
    unit: 'reps',
    nameKey: '@@exercise.abs.crunches.name',
    icon: 'self_improvement',
    variants: [
      {
        id: 'standard',
        nameKey: '@@exercise.variant.crunches.standard',
        difficulty: 'beginner',
      },
      {
        id: 'reverse',
        nameKey: '@@exercise.variant.crunches.reverse',
        difficulty: 'beginner',
      },
      {
        id: 'bicycle',
        nameKey: '@@exercise.variant.crunches.bicycle',
        difficulty: 'intermediate',
      },
      {
        id: 'oblique',
        nameKey: '@@exercise.variant.crunches.oblique',
        difficulty: 'intermediate',
      },
    ],
  },
  {
    id: 'abs.legraises',
    categoryId: 'core',
    measurement: 'reps',
    min: 1,
    max: 500,
    unit: 'reps',
    nameKey: '@@exercise.abs.legraises.name',
    icon: 'self_improvement',
    variants: [
      {
        id: 'lying',
        nameKey: '@@exercise.variant.legraises.lying',
        difficulty: 'beginner',
      },
      {
        id: 'hanging-knee',
        nameKey: '@@exercise.variant.legraises.hanging-knee',
        difficulty: 'intermediate',
      },
      {
        id: 'hanging-straight',
        nameKey: '@@exercise.variant.legraises.hanging-straight',
        difficulty: 'advanced',
      },
    ],
  },
  {
    id: 'abs.russiantwist',
    categoryId: 'core',
    measurement: 'reps',
    min: 1,
    max: 500,
    unit: 'reps',
    nameKey: '@@exercise.abs.russiantwist.name',
    icon: 'self_improvement',
    variants: [
      {
        id: 'bodyweight',
        nameKey: '@@exercise.variant.russiantwist.bodyweight',
        difficulty: 'beginner',
      },
      {
        id: 'weighted',
        nameKey: '@@exercise.variant.russiantwist.weighted',
        difficulty: 'intermediate',
      },
    ],
  },
  {
    id: 'abs.mountainclimbers',
    categoryId: 'core',
    measurement: 'reps',
    min: 1,
    max: 500,
    unit: 'reps',
    nameKey: '@@exercise.abs.mountainclimbers.name',
    icon: 'self_improvement',
    variants: [
      {
        id: 'standard',
        nameKey: '@@exercise.variant.mountainclimbers.standard',
        difficulty: 'beginner',
      },
      {
        id: 'cross-body',
        nameKey: '@@exercise.variant.mountainclimbers.cross-body',
        difficulty: 'intermediate',
      },
    ],
  },
  {
    id: 'core.deadbug',
    categoryId: 'core',
    measurement: 'reps',
    min: 1,
    max: 200,
    unit: 'reps',
    nameKey: '@@exercise.core.deadbug.name',
    icon: 'self_improvement',
  },
  {
    id: 'core.hollowhold',
    categoryId: 'core',
    holdTimerProfileId: 'hollowhold',
    measurement: 'time',
    min: 1,
    max: 1200,
    unit: 's',
    nameKey: '@@exercise.core.hollowhold.name',
    icon: 'horizontal_rule',
  },
  {
    // Legacy id `plank.standard` migrated into the `core` category as
    // an isometric hold. The four plank variants live here so users see
    // them under "Plank" inside the core picker.
    id: 'plank.standard',
    categoryId: 'core',
    holdTimerProfileId: 'plank',
    measurement: 'time',
    min: 1,
    max: 7200,
    unit: 's',
    nameKey: '@@exercise.plank.standard.name',
    icon: 'horizontal_rule',
    variants: [
      {
        id: 'standard',
        nameKey: '@@exercise.variant.plank.standard',
        difficulty: 'beginner',
      },
      {
        id: 'forearm',
        nameKey: '@@exercise.variant.plank.forearm',
        difficulty: 'beginner',
      },
      {
        id: 'side',
        nameKey: '@@exercise.variant.plank.side',
        difficulty: 'intermediate',
      },
      {
        id: 'reverse',
        nameKey: '@@exercise.variant.plank.reverse',
        difficulty: 'intermediate',
      },
    ],
  },

  {
    id: 'legs.squats',
    categoryId: 'squat',
    autoCountProfileId: 'squat',
    measurement: 'reps',
    min: 1,
    max: 500,
    unit: 'reps',
    nameKey: '@@exercise.legs.squats.name',
    icon: 'directions_run',
    variants: [
      {
        id: 'bodyweight',
        nameKey: '@@exercise.variant.squats.bodyweight',
        difficulty: 'beginner',
      },
      {
        id: 'sumo',
        nameKey: '@@exercise.variant.squats.sumo',
        difficulty: 'beginner',
      },
      {
        id: 'goblet',
        nameKey: '@@exercise.variant.squats.goblet',
        difficulty: 'intermediate',
      },
      {
        id: 'bulgarian-split',
        nameKey: '@@exercise.variant.squats.bulgarian-split',
        difficulty: 'intermediate',
      },
      {
        id: 'pistol',
        nameKey: '@@exercise.variant.squats.pistol',
        difficulty: 'advanced',
      },
    ],
  },
  {
    id: 'legs.jumpsquats',
    categoryId: 'squat',
    measurement: 'reps',
    min: 1,
    max: 500,
    unit: 'reps',
    nameKey: '@@exercise.legs.jumpsquats.name',
    icon: 'directions_run',
  },
  {
    id: 'legs.calfraises',
    categoryId: 'squat',
    measurement: 'reps',
    min: 1,
    max: 500,
    unit: 'reps',
    nameKey: '@@exercise.legs.calfraises.name',
    icon: 'directions_run',
    variants: [
      {
        id: 'standard',
        nameKey: '@@exercise.variant.calfraises.standard',
        difficulty: 'beginner',
      },
      {
        id: 'single-leg',
        nameKey: '@@exercise.variant.calfraises.single-leg',
        difficulty: 'intermediate',
      },
      {
        id: 'seated',
        nameKey: '@@exercise.variant.calfraises.seated',
        difficulty: 'beginner',
      },
    ],
  },
  {
    id: 'squat.wallsit',
    categoryId: 'squat',
    measurement: 'time',
    min: 1,
    max: 1200,
    unit: 's',
    nameKey: '@@exercise.squat.wallsit.name',
    icon: 'airline_seat_legroom_reduced',
  },
  {
    id: 'squat.boxjump',
    categoryId: 'squat',
    measurement: 'reps',
    min: 1,
    max: 300,
    unit: 'reps',
    nameKey: '@@exercise.squat.boxjump.name',
    icon: 'directions_run',
  },

  {
    id: 'legs.glutebridge',
    categoryId: 'hinge',
    measurement: 'reps',
    min: 1,
    max: 500,
    unit: 'reps',
    nameKey: '@@exercise.legs.glutebridge.name',
    icon: 'compress',
    variants: [
      {
        id: 'standard',
        nameKey: '@@exercise.variant.glutebridge.standard',
        difficulty: 'beginner',
      },
      {
        id: 'single-leg',
        nameKey: '@@exercise.variant.glutebridge.single-leg',
        difficulty: 'intermediate',
      },
      {
        id: 'hip-thrust',
        nameKey: '@@exercise.variant.glutebridge.hip-thrust',
        difficulty: 'intermediate',
      },
      {
        id: 'march',
        nameKey: '@@exercise.variant.glutebridge.march',
        difficulty: 'beginner',
      },
    ],
  },
  {
    id: 'hinge.singlelegRdl',
    categoryId: 'hinge',
    measurement: 'reps',
    min: 1,
    max: 200,
    unit: 'reps',
    nameKey: '@@exercise.hinge.singlelegRdl.name',
    icon: 'compress',
  },
  {
    id: 'hinge.goodmorning',
    categoryId: 'hinge',
    measurement: 'reps',
    min: 1,
    max: 200,
    unit: 'reps',
    nameKey: '@@exercise.hinge.goodmorning.name',
    icon: 'compress',
  },

  {
    id: 'legs.lunges',
    categoryId: 'lunge',
    measurement: 'reps',
    min: 1,
    max: 500,
    unit: 'reps',
    nameKey: '@@exercise.legs.lunges.name',
    icon: 'directions_walk',
    variants: [
      {
        id: 'forward',
        nameKey: '@@exercise.variant.lunges.forward',
        difficulty: 'beginner',
      },
      {
        id: 'reverse',
        nameKey: '@@exercise.variant.lunges.reverse',
        difficulty: 'beginner',
      },
      {
        id: 'walking',
        nameKey: '@@exercise.variant.lunges.walking',
        difficulty: 'intermediate',
      },
      {
        id: 'lateral',
        nameKey: '@@exercise.variant.lunges.lateral',
        difficulty: 'intermediate',
      },
      {
        id: 'curtsy',
        nameKey: '@@exercise.variant.lunges.curtsy',
        difficulty: 'intermediate',
      },
      {
        id: 'jumping',
        nameKey: '@@exercise.variant.lunges.jumping',
        difficulty: 'advanced',
      },
    ],
  },
  {
    id: 'lunge.stepup',
    categoryId: 'lunge',
    measurement: 'reps',
    min: 1,
    max: 300,
    unit: 'reps',
    nameKey: '@@exercise.lunge.stepup.name',
    icon: 'stairs',
  },

  {
    id: 'push.dips',
    categoryId: 'push',
    measurement: 'reps',
    min: 1,
    max: 200,
    unit: 'reps',
    nameKey: '@@exercise.push.dips.name',
    icon: 'open_with',
    variants: [
      {
        id: 'parallel',
        nameKey: '@@exercise.variant.dips.parallel',
        difficulty: 'intermediate',
      },
      {
        id: 'straight-bar',
        nameKey: '@@exercise.variant.dips.straight-bar',
        difficulty: 'intermediate',
      },
      {
        id: 'ring',
        nameKey: '@@exercise.variant.dips.ring',
        difficulty: 'advanced',
      },
    ],
  },
  {
    id: 'push.benchdips',
    categoryId: 'push',
    measurement: 'reps',
    min: 1,
    max: 300,
    unit: 'reps',
    nameKey: '@@exercise.push.benchdips.name',
    icon: 'open_with',
  },
  {
    id: 'push.handstandhold',
    categoryId: 'push',
    measurement: 'time',
    min: 1,
    max: 600,
    unit: 's',
    nameKey: '@@exercise.push.handstandhold.name',
    icon: 'open_with',
  },

  {
    id: 'pull.pullups',
    categoryId: 'pull',
    autoCountProfileId: 'pullup',
    measurement: 'reps',
    min: 1,
    max: 200,
    unit: 'reps',
    nameKey: '@@exercise.pull.pullups.name',
    icon: 'rowing',
    variants: [
      {
        id: 'standard',
        nameKey: '@@exercise.variant.pullups.standard',
        difficulty: 'intermediate',
      },
      {
        id: 'chin-up',
        nameKey: '@@exercise.variant.pullups.chin-up',
        difficulty: 'intermediate',
      },
      {
        id: 'wide-grip',
        nameKey: '@@exercise.variant.pullups.wide-grip',
        difficulty: 'advanced',
      },
      {
        id: 'neutral-grip',
        nameKey: '@@exercise.variant.pullups.neutral-grip',
        difficulty: 'intermediate',
      },
      {
        id: 'negative',
        nameKey: '@@exercise.variant.pullups.negative',
        difficulty: 'beginner',
      },
      {
        id: 'assisted',
        nameKey: '@@exercise.variant.pullups.assisted',
        difficulty: 'beginner',
      },
      {
        id: 'archer',
        nameKey: '@@exercise.variant.pullups.archer',
        difficulty: 'advanced',
      },
    ],
  },
  {
    id: 'pull.rows',
    categoryId: 'pull',
    measurement: 'reps',
    min: 1,
    max: 300,
    unit: 'reps',
    nameKey: '@@exercise.pull.rows.name',
    icon: 'rowing',
    variants: [
      {
        id: 'inverted',
        nameKey: '@@exercise.variant.rows.inverted',
        difficulty: 'beginner',
      },
      {
        id: 'australian',
        nameKey: '@@exercise.variant.rows.australian',
        difficulty: 'beginner',
      },
      {
        id: 'dumbbell',
        nameKey: '@@exercise.variant.rows.dumbbell',
        difficulty: 'intermediate',
      },
      {
        id: 'barbell',
        nameKey: '@@exercise.variant.rows.barbell',
        difficulty: 'intermediate',
      },
    ],
  },
  {
    id: 'pull.deadhang',
    categoryId: 'pull',
    measurement: 'time',
    min: 1,
    max: 600,
    unit: 's',
    nameKey: '@@exercise.pull.deadhang.name',
    icon: 'rowing',
  },
  {
    id: 'pull.facepull',
    categoryId: 'pull',
    measurement: 'reps',
    min: 1,
    max: 300,
    unit: 'reps',
    nameKey: '@@exercise.pull.facepull.name',
    icon: 'rowing',
  },

  // Carry exercises are `distance`-measured and need a distance-only
  // form path the training dialog doesn't yet implement (today it only
  // renders `time` and `distance-time` form rows). They ship in a
  // follow-up PR alongside the dialog work + a Firestore rule branch
  // that bounds `distanceM` for the carry-specific ids.

  {
    id: 'cardio.running',
    categoryId: 'cardio',
    measurement: 'distance-time',
    min: 100,
    max: 50_000,
    unit: 'm',
    nameKey: '@@exercise.cardio.running.name',
    icon: 'directions_run',
  },
  {
    id: 'cardio.walking',
    categoryId: 'cardio',
    measurement: 'distance-time',
    min: 100,
    max: 50_000,
    unit: 'm',
    nameKey: '@@exercise.cardio.walking.name',
    icon: 'directions_walk',
  },
  {
    id: 'cardio.cycling',
    categoryId: 'cardio',
    measurement: 'distance-time',
    min: 100,
    max: 300_000,
    unit: 'm',
    nameKey: '@@exercise.cardio.cycling.name',
    icon: 'directions_bike',
  },
  {
    id: 'cardio.rowing',
    categoryId: 'cardio',
    measurement: 'distance-time',
    min: 100,
    max: 50_000,
    unit: 'm',
    nameKey: '@@exercise.cardio.rowing.name',
    icon: 'rowing',
  },
  {
    id: 'cardio.swimming',
    categoryId: 'cardio',
    measurement: 'distance-time',
    min: 25,
    max: 25_000,
    unit: 'm',
    nameKey: '@@exercise.cardio.swimming.name',
    icon: 'pool',
  },
  {
    id: 'cardio.jumprope',
    categoryId: 'cardio',
    measurement: 'reps',
    min: 1,
    max: 10_000,
    unit: 'reps',
    nameKey: '@@exercise.cardio.jumprope.name',
    icon: 'sports_handball',
  },
  {
    id: 'cardio.burpees',
    categoryId: 'cardio',
    measurement: 'reps',
    min: 1,
    max: 500,
    unit: 'reps',
    nameKey: '@@exercise.cardio.burpees.name',
    icon: 'directions_run',
  },
  {
    id: 'cardio.jumpingjacks',
    categoryId: 'cardio',
    measurement: 'reps',
    min: 1,
    max: 1000,
    unit: 'reps',
    nameKey: '@@exercise.cardio.jumpingjacks.name',
    icon: 'sports_handball',
  },
  {
    id: 'cardio.highknees',
    categoryId: 'cardio',
    measurement: 'time',
    min: 1,
    max: 3600,
    unit: 's',
    nameKey: '@@exercise.cardio.highknees.name',
    icon: 'directions_run',
  },

  {
    id: 'mobility.stretching',
    categoryId: 'mobility',
    measurement: 'time',
    min: 1,
    max: 7200,
    unit: 's',
    nameKey: '@@exercise.mobility.stretching.name',
    icon: 'accessibility_new',
  },
  {
    id: 'mobility.yoga',
    categoryId: 'mobility',
    measurement: 'time',
    min: 1,
    max: 7200,
    unit: 's',
    nameKey: '@@exercise.mobility.yoga.name',
    icon: 'self_improvement',
  },
  {
    id: 'mobility.foamrolling',
    categoryId: 'mobility',
    measurement: 'time',
    min: 1,
    max: 3600,
    unit: 's',
    nameKey: '@@exercise.mobility.foamrolling.name',
    icon: 'accessibility_new',
  },
  {
    id: 'mobility.dynamicwarmup',
    categoryId: 'mobility',
    measurement: 'time',
    min: 1,
    max: 3600,
    unit: 's',
    nameKey: '@@exercise.mobility.dynamicwarmup.name',
    icon: 'accessibility_new',
  },
  {
    id: 'mobility.catcow',
    categoryId: 'mobility',
    measurement: 'reps',
    min: 1,
    max: 200,
    unit: 'reps',
    nameKey: '@@exercise.mobility.catcow.name',
    icon: 'accessibility_new',
  },
  {
    id: 'mobility.hipopener',
    categoryId: 'mobility',
    measurement: 'time',
    min: 1,
    max: 1800,
    unit: 's',
    nameKey: '@@exercise.mobility.hipopener.name',
    icon: 'accessibility_new',
  },

  // Strength exercises are `weight`-measured and require a `weightKg`
  // companion input the training dialog doesn't yet render. They ship
  // in a follow-up PR alongside the weighted-set form, the `weightKg`
  // companion in `exerciseEntries` Firestore rule, and the
  // per-exercise stats trigger work to surface PRs in load × reps.
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
 *
 * The catalog is a module-level constant so the result is identical on
 * every call — cache it once instead of re-allocating in every signal
 * recomputation (the dashboard sections call this from inside a
 * `computed`).
 */
let cachedByCategory: ReadonlyMap<
  ExerciseCategoryInfo['id'],
  ReadonlyArray<ExerciseDefinition>
> | null = null;

export function exercisesByCategory(): ReadonlyMap<
  ExerciseCategoryInfo['id'],
  ReadonlyArray<ExerciseDefinition>
> {
  if (cachedByCategory) return cachedByCategory;
  const map = new Map<ExerciseCategoryInfo['id'], ExerciseDefinition[]>();
  for (const cat of EXERCISE_CATEGORIES) {
    map.set(cat.id, []);
  }
  for (const def of EXERCISE_CATALOG) {
    const bucket = map.get(def.categoryId);
    if (bucket) bucket.push(def);
  }
  cachedByCategory = map;
  return cachedByCategory;
}
