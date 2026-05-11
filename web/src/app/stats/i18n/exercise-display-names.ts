import {
  type ExerciseCategoryId,
  findExerciseDefinition,
  type UnifiedEntryFilterKey,
} from '@pu-stats/models';

/**
 * Locale-aware display strings for the standard exercise catalog.
 * `$localize` calls live in this module so the angular build extractor
 * picks them up; consumers (stats table, history page filter) call
 * {@link exerciseDisplayName} to avoid duplicating the lookup table.
 */
const EXERCISE_DISPLAY_NAMES: Record<string, string> = {
  'abs.situps': $localize`:@@exercise.abs.situps.name:Sit-ups`,
  'abs.crunches': $localize`:@@exercise.abs.crunches.name:Crunches`,
  'abs.legraises': $localize`:@@exercise.abs.legraises.name:Beinheben`,
  'abs.russiantwist': $localize`:@@exercise.abs.russiantwist.name:Russian Twist`,
  'abs.mountainclimbers': $localize`:@@exercise.abs.mountainclimbers.name:Mountain Climbers`,
  'legs.squats': $localize`:@@exercise.legs.squats.name:Kniebeugen`,
  'legs.lunges': $localize`:@@exercise.legs.lunges.name:Ausfallschritte`,
  'legs.glutebridge': $localize`:@@exercise.legs.glutebridge.name:Hüftheben`,
  'legs.calfraises': $localize`:@@exercise.legs.calfraises.name:Wadenheben`,
  'legs.jumpsquats': $localize`:@@exercise.legs.jumpsquats.name:Jump Squats`,
  'plank.standard': $localize`:@@exercise.plank.standard.name:Plank`,
  'cardio.running': $localize`:@@exercise.cardio.running.name:Laufen`,
};

export function exerciseDisplayName(id: string): string {
  return EXERCISE_DISPLAY_NAMES[id] ?? id;
}

/**
 * Resolves the filter-key shape used by the analysis page (`'pushup'`
 * for the collapsed pushup bucket, exerciseId for everything else)
 * to a localised label. Shared between the page filter chips and the
 * type-pie legend so both stay in sync without duplicating the
 * `$localize` calls.
 *
 * Falls back to a generic "Andere Übung" label for legacy ids that
 * no longer have a catalog entry (e.g. an exercise removed from the
 * catalog whose Firestore entries still exist).
 */
export function kindDisplayName(value: UnifiedEntryFilterKey): string {
  if (value === 'pushup') {
    return $localize`:@@exercise.category.pushup:Liegestütze`;
  }
  const def = findExerciseDefinition(value);
  if (def) return exerciseDisplayName(def.id);
  // Catalog-miss path: user-defined exercises (custom UUIDs) and
  // legacy ids without a catalog entry both land here. Returning the
  // bare id keeps each one distinguishable in the filter chips and
  // type-pie legend until custom-exercise definitions are threaded
  // through the analysis page — collapsing every miss into a single
  // "Andere Übung" label made multi-custom-exercise users unable to
  // tell their own filters apart.
  return value;
}

/**
 * Locale-aware display strings for exercise categories. Shared between
 * the analysis overview cards and the comparison chart so the store
 * can emit translated labels instead of raw XLIFF ids — Chart.js has
 * no runtime hook for `$localize`, and emitting the id would render
 * the legend like a developer string in production builds.
 *
 * Only entries with a corresponding XLIFF unit and at least one
 * catalog exercise are mapped here. `strength` and `mobility` exist in
 * the `ExerciseCategoryId` union but are absent from
 * `EXERCISE_CATEGORIES`, so adding $localize calls for them would
 * fail the locale-baked production build with "No translation found"
 * — they get a per-id fallback through {@link categoryDisplayName}
 * until they ship with their own exercises and translations.
 */
const CATEGORY_DISPLAY_NAMES: Partial<Record<ExerciseCategoryId, string>> = {
  pushup: $localize`:@@exercise.category.pushup:Liegestütze`,
  abs: $localize`:@@exercise.category.abs:Bauch`,
  legs: $localize`:@@exercise.category.legs:Beine`,
  plank: $localize`:@@exercise.category.plank:Plank`,
  cardio: $localize`:@@exercise.category.cardio:Ausdauer`,
};

export function categoryDisplayName(id: ExerciseCategoryId): string {
  return CATEGORY_DISPLAY_NAMES[id] ?? id;
}
