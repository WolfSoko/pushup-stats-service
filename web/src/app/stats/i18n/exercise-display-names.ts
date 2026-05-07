/**
 * Locale-aware display strings for the standard exercise catalog.
 * `$localize` calls live in this module so the angular build extractor
 * picks them up; consumers (stats table, history page filter) call
 * {@link exerciseDisplayName} to avoid duplicating the lookup table.
 */
const EXERCISE_DISPLAY_NAMES: Record<string, string> = {
  'abs.situps': $localize`:@@exercise.abs.situps.name:Sit-ups`,
  'legs.squats': $localize`:@@exercise.legs.squats.name:Kniebeugen`,
  'plank.standard': $localize`:@@exercise.plank.standard.name:Plank`,
  'cardio.running': $localize`:@@exercise.cardio.running.name:Laufen`,
};

export function exerciseDisplayName(id: string): string {
  return EXERCISE_DISPLAY_NAMES[id] ?? id;
}
