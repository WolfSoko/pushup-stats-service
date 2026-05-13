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
  // core (legacy `abs.*` ids kept for data stability)
  'abs.situps': $localize`:@@exercise.abs.situps.name:Sit-ups`,
  'abs.crunches': $localize`:@@exercise.abs.crunches.name:Crunches`,
  'abs.legraises': $localize`:@@exercise.abs.legraises.name:Beinheben`,
  'abs.russiantwist': $localize`:@@exercise.abs.russiantwist.name:Russian Twist`,
  'abs.mountainclimbers': $localize`:@@exercise.abs.mountainclimbers.name:Mountain Climbers`,
  'core.deadbug': $localize`:@@exercise.core.deadbug.name:Dead Bug`,
  'core.hollowhold': $localize`:@@exercise.core.hollowhold.name:Hollow Hold`,
  'plank.standard': $localize`:@@exercise.plank.standard.name:Plank`,

  // squat / hinge / lunge (legacy `legs.*` ids kept for data stability)
  'legs.squats': $localize`:@@exercise.legs.squats.name:Kniebeugen`,
  'legs.jumpsquats': $localize`:@@exercise.legs.jumpsquats.name:Jump Squats`,
  'legs.calfraises': $localize`:@@exercise.legs.calfraises.name:Wadenheben`,
  'squat.wallsit': $localize`:@@exercise.squat.wallsit.name:Wandsitz`,
  'squat.boxjump': $localize`:@@exercise.squat.boxjump.name:Box Jumps`,
  'legs.glutebridge': $localize`:@@exercise.legs.glutebridge.name:Hüftheben`,
  'hinge.singlelegRdl': $localize`:@@exercise.hinge.singlelegRdl.name:Einbeiniges Kreuzheben`,
  'hinge.goodmorning': $localize`:@@exercise.hinge.goodmorning.name:Good Morning`,
  'legs.lunges': $localize`:@@exercise.legs.lunges.name:Ausfallschritte`,
  'lunge.stepup': $localize`:@@exercise.lunge.stepup.name:Step-ups`,

  // pull
  'pull.pullups': $localize`:@@exercise.pull.pullups.name:Klimmzüge`,
  'pull.rows': $localize`:@@exercise.pull.rows.name:Ruderzug`,
  'pull.deadhang': $localize`:@@exercise.pull.deadhang.name:Dead Hang`,
  'pull.facepull': $localize`:@@exercise.pull.facepull.name:Face Pull`,

  // carry
  'carry.farmer': $localize`:@@exercise.carry.farmer.name:Farmer's Walk`,
  'carry.suitcase': $localize`:@@exercise.carry.suitcase.name:Suitcase Carry`,
  'carry.overhead': $localize`:@@exercise.carry.overhead.name:Overhead Carry`,

  // cardio
  'cardio.running': $localize`:@@exercise.cardio.running.name:Laufen`,
  'cardio.walking': $localize`:@@exercise.cardio.walking.name:Gehen`,
  'cardio.cycling': $localize`:@@exercise.cardio.cycling.name:Radfahren`,
  'cardio.rowing': $localize`:@@exercise.cardio.rowing.name:Rudern`,
  'cardio.swimming': $localize`:@@exercise.cardio.swimming.name:Schwimmen`,
  'cardio.jumprope': $localize`:@@exercise.cardio.jumprope.name:Seilspringen`,
  'cardio.burpees': $localize`:@@exercise.cardio.burpees.name:Burpees`,
  'cardio.jumpingjacks': $localize`:@@exercise.cardio.jumpingjacks.name:Hampelmänner`,
  'cardio.highknees': $localize`:@@exercise.cardio.highknees.name:High Knees`,

  // mobility
  'mobility.stretching': $localize`:@@exercise.mobility.stretching.name:Dehnen`,
  'mobility.yoga': $localize`:@@exercise.mobility.yoga.name:Yoga`,
  'mobility.foamrolling': $localize`:@@exercise.mobility.foamrolling.name:Faszienrolle`,
  'mobility.dynamicwarmup': $localize`:@@exercise.mobility.dynamicwarmup.name:Dynamisches Aufwärmen`,
  'mobility.catcow': $localize`:@@exercise.mobility.catcow.name:Katze-Kuh`,
  'mobility.hipopener': $localize`:@@exercise.mobility.hipopener.name:Hüftöffner`,

  // strength
  'strength.benchpress': $localize`:@@exercise.strength.benchpress.name:Bankdrücken`,
  'strength.overheadpress': $localize`:@@exercise.strength.overheadpress.name:Schulterdrücken`,
  'strength.deadlift': $localize`:@@exercise.strength.deadlift.name:Kreuzheben`,
  'strength.barbellsquat': $localize`:@@exercise.strength.barbellsquat.name:Langhantel-Kniebeuge`,
  'strength.barbellrow': $localize`:@@exercise.strength.barbellrow.name:Langhantelrudern`,
  'strength.kettlebellswing': $localize`:@@exercise.strength.kettlebellswing.name:Kettlebell Swing`,
};

export function exerciseDisplayName(id: string): string {
  return EXERCISE_DISPLAY_NAMES[id] ?? id;
}

/**
 * Resolves the filter-key shape used by the analysis page (`'pushup'`
 * for the collapsed legacy-pushup bucket, exerciseId for everything
 * else) to a localised label. Shared between the page filter chips and
 * the type-pie legend so both stay in sync without duplicating the
 * `$localize` calls.
 *
 * The legacy filter-key string remains `'pushup'` (it identifies the
 * legacy Firestore collection); only the *display* shifts to the new
 * movement-pattern label "Drücken / Push" via the shared category
 * translation unit.
 *
 * For ids that miss the catalog (user-defined custom exercises or
 * legacy ids whose Firestore entries still exist) the raw `value`
 * is returned, so each one stays individually distinguishable in
 * filter chips and the type-pie legend.
 */
export function kindDisplayName(value: UnifiedEntryFilterKey): string {
  if (value === 'pushup') {
    return $localize`:@@exercise.category.push:Drücken`;
  }
  const def = findExerciseDefinition(value);
  if (def) return exerciseDisplayName(def.id);
  // Catalog-miss path: user-defined exercises (custom UUIDs) and
  // legacy ids without a catalog entry both land here. Returning the
  // bare id keeps each one distinguishable in the filter chips and
  // type-pie legend until custom-exercise definitions are threaded
  // through the analysis page.
  return value;
}

/**
 * Locale-aware display strings for exercise categories. Shared between
 * the analysis overview cards and the comparison chart so the store
 * can emit translated labels instead of raw XLIFF ids — Chart.js has
 * no runtime hook for `$localize`, and emitting the id would render
 * the legend like a developer string in production builds.
 */
const CATEGORY_DISPLAY_NAMES: Record<ExerciseCategoryId, string> = {
  push: $localize`:@@exercise.category.push:Drücken`,
  pull: $localize`:@@exercise.category.pull:Ziehen`,
  squat: $localize`:@@exercise.category.squat:Kniebeuge`,
  hinge: $localize`:@@exercise.category.hinge:Hüftbeuge`,
  lunge: $localize`:@@exercise.category.lunge:Ausfallschritt`,
  carry: $localize`:@@exercise.category.carry:Tragen`,
  core: $localize`:@@exercise.category.core:Rumpf`,
  cardio: $localize`:@@exercise.category.cardio:Ausdauer`,
  mobility: $localize`:@@exercise.category.mobility:Mobilität`,
  strength: $localize`:@@exercise.category.strength:Krafttraining`,
};

export function categoryDisplayName(id: ExerciseCategoryId): string {
  return CATEGORY_DISPLAY_NAMES[id] ?? id;
}
