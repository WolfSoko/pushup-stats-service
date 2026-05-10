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
