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
  return $localize`:@@analysis.kindUnknown:Andere Übung`;
}

/**
 * Locale-aware display strings for exercise categories. Shared between
 * the analysis overview cards and the comparison chart so the store
 * can emit translated labels instead of raw XLIFF ids — Chart.js has
 * no runtime hook for `$localize`, and emitting the id would render
 * the legend like a developer string in production builds.
 *
 * The German source strings mirror the catalogue entries in the
 * training-entry dialog; XLIFF ids stay identical so the existing
 * translations apply unchanged.
 */
const CATEGORY_DISPLAY_NAMES: Record<ExerciseCategoryId, string> = {
  pushup: $localize`:@@exercise.category.pushup:Liegestütze`,
  abs: $localize`:@@exercise.category.abs:Bauch`,
  legs: $localize`:@@exercise.category.legs:Beine`,
  plank: $localize`:@@exercise.category.plank:Plank`,
  cardio: $localize`:@@exercise.category.cardio:Ausdauer`,
  strength: $localize`:@@exercise.category.strength:Kraft`,
  mobility: $localize`:@@exercise.category.mobility:Mobility`,
};

export function categoryDisplayName(id: ExerciseCategoryId): string {
  return CATEGORY_DISPLAY_NAMES[id] ?? id;
}
