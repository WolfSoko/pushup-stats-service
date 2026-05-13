import {
  type ExerciseCategoryId,
  type ExerciseVariant,
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
 * Locale-aware display strings for exercise variants. Keyed by the
 * variant's `nameKey` (the XLIFF unit id) so the dialog can resolve a
 * label from any `ExerciseVariant` without coupling to its parent
 * exercise id.
 *
 * $localize calls must be literal at extraction time — keep these
 * spelled out one per variant. Falls back to the raw variant id when
 * a name key isn't mapped here (e.g. a future variant added to the
 * catalog before this file is updated).
 */
const VARIANT_DISPLAY_NAMES: Record<string, string> = {
  // sit-ups
  '@@exercise.variant.situps.standard': $localize`:@@exercise.variant.situps.standard:Standard`,
  '@@exercise.variant.situps.decline': $localize`:@@exercise.variant.situps.decline:Decline`,
  '@@exercise.variant.situps.weighted': $localize`:@@exercise.variant.situps.weighted:Mit Zusatzgewicht`,

  // crunches
  '@@exercise.variant.crunches.standard': $localize`:@@exercise.variant.crunches.standard:Standard`,
  '@@exercise.variant.crunches.reverse': $localize`:@@exercise.variant.crunches.reverse:Reverse Crunches`,
  '@@exercise.variant.crunches.bicycle': $localize`:@@exercise.variant.crunches.bicycle:Bicycle Crunches`,
  '@@exercise.variant.crunches.oblique': $localize`:@@exercise.variant.crunches.oblique:Schräge Crunches`,

  // leg raises
  '@@exercise.variant.legraises.lying': $localize`:@@exercise.variant.legraises.lying:Liegend`,
  '@@exercise.variant.legraises.hanging-knee': $localize`:@@exercise.variant.legraises.hanging-knee:Hängend (Knie)`,
  '@@exercise.variant.legraises.hanging-straight': $localize`:@@exercise.variant.legraises.hanging-straight:Hängend (gestreckt)`,

  // russian twist
  '@@exercise.variant.russiantwist.bodyweight': $localize`:@@exercise.variant.russiantwist.bodyweight:Eigengewicht`,
  '@@exercise.variant.russiantwist.weighted': $localize`:@@exercise.variant.russiantwist.weighted:Mit Zusatzgewicht`,

  // mountain climbers
  '@@exercise.variant.mountainclimbers.standard': $localize`:@@exercise.variant.mountainclimbers.standard:Standard`,
  '@@exercise.variant.mountainclimbers.cross-body': $localize`:@@exercise.variant.mountainclimbers.cross-body:Cross-Body`,

  // plank
  '@@exercise.variant.plank.standard': $localize`:@@exercise.variant.plank.standard:Standard`,
  '@@exercise.variant.plank.forearm': $localize`:@@exercise.variant.plank.forearm:Unterarmstütz`,
  '@@exercise.variant.plank.side': $localize`:@@exercise.variant.plank.side:Seitlich`,
  '@@exercise.variant.plank.reverse': $localize`:@@exercise.variant.plank.reverse:Umgekehrt`,

  // squats
  '@@exercise.variant.squats.bodyweight': $localize`:@@exercise.variant.squats.bodyweight:Eigengewicht`,
  '@@exercise.variant.squats.sumo': $localize`:@@exercise.variant.squats.sumo:Sumo`,
  '@@exercise.variant.squats.goblet': $localize`:@@exercise.variant.squats.goblet:Goblet`,
  '@@exercise.variant.squats.bulgarian-split': $localize`:@@exercise.variant.squats.bulgarian-split:Bulgarian Split`,
  '@@exercise.variant.squats.pistol': $localize`:@@exercise.variant.squats.pistol:Pistol`,

  // calf raises
  '@@exercise.variant.calfraises.standard': $localize`:@@exercise.variant.calfraises.standard:Standard`,
  '@@exercise.variant.calfraises.single-leg': $localize`:@@exercise.variant.calfraises.single-leg:Einbeinig`,
  '@@exercise.variant.calfraises.seated': $localize`:@@exercise.variant.calfraises.seated:Sitzend`,

  // glute bridge
  '@@exercise.variant.glutebridge.standard': $localize`:@@exercise.variant.glutebridge.standard:Standard`,
  '@@exercise.variant.glutebridge.single-leg': $localize`:@@exercise.variant.glutebridge.single-leg:Einbeinig`,
  '@@exercise.variant.glutebridge.hip-thrust': $localize`:@@exercise.variant.glutebridge.hip-thrust:Hip Thrust`,
  '@@exercise.variant.glutebridge.march': $localize`:@@exercise.variant.glutebridge.march:Marching`,

  // lunges
  '@@exercise.variant.lunges.forward': $localize`:@@exercise.variant.lunges.forward:Vorwärts`,
  '@@exercise.variant.lunges.reverse': $localize`:@@exercise.variant.lunges.reverse:Rückwärts`,
  '@@exercise.variant.lunges.walking': $localize`:@@exercise.variant.lunges.walking:Walking`,
  '@@exercise.variant.lunges.lateral': $localize`:@@exercise.variant.lunges.lateral:Seitlich`,
  '@@exercise.variant.lunges.curtsy': $localize`:@@exercise.variant.lunges.curtsy:Curtsy`,
  '@@exercise.variant.lunges.jumping': $localize`:@@exercise.variant.lunges.jumping:Jumping`,

  // pullups
  '@@exercise.variant.pullups.standard': $localize`:@@exercise.variant.pullups.standard:Standard`,
  '@@exercise.variant.pullups.chin-up': $localize`:@@exercise.variant.pullups.chin-up:Chin-up`,
  '@@exercise.variant.pullups.wide-grip': $localize`:@@exercise.variant.pullups.wide-grip:Breiter Griff`,
  '@@exercise.variant.pullups.neutral-grip': $localize`:@@exercise.variant.pullups.neutral-grip:Neutraler Griff`,
  '@@exercise.variant.pullups.negative': $localize`:@@exercise.variant.pullups.negative:Negativ`,
  '@@exercise.variant.pullups.assisted': $localize`:@@exercise.variant.pullups.assisted:Assistiert`,
  '@@exercise.variant.pullups.archer': $localize`:@@exercise.variant.pullups.archer:Archer`,

  // rows
  '@@exercise.variant.rows.inverted': $localize`:@@exercise.variant.rows.inverted:Inverted Row`,
  '@@exercise.variant.rows.australian': $localize`:@@exercise.variant.rows.australian:Australian Row`,
  '@@exercise.variant.rows.dumbbell': $localize`:@@exercise.variant.rows.dumbbell:Kurzhantel`,
  '@@exercise.variant.rows.barbell': $localize`:@@exercise.variant.rows.barbell:Langhantel`,
};

export function variantDisplayName(variant: ExerciseVariant): string {
  return VARIANT_DISPLAY_NAMES[variant.nameKey] ?? variant.id;
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
  hinge: $localize`:@@exercise.category.hinge:Hüftstreckung`,
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
