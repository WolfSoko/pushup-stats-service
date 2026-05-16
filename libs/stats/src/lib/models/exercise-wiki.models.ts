/**
 * Curated wiki catalog for non-pushup exercises in {@link EXERCISE_CATALOG}.
 *
 * Mirrors the `pushup-type.models.ts` split: structural metadata (id,
 * slug, difficulty) stays in TS; translatable copy (name, summary,
 * instructions, tips) lives in `content/wiki/exercises/<id>.<lang>.md`
 * and is rendered through the build-time generator into
 * `exercise-wiki-content.generated.ts`.
 *
 * Why a separate catalog from {@link EXERCISE_CATALOG}: the dashboard
 * catalog carries data-store concerns (measurement type, min/max,
 * variants) the wiki does not need, and the wiki adds editorial concerns
 * (URL slug, difficulty rating, presentation order) the catalog should
 * not carry. Entries here reference {@link ExerciseDefinition.id} so a
 * future stats-page deep-link (e.g. "explain this exercise") can resolve
 * both halves without a hand-maintained map.
 */

import type { ExerciseCategoryId } from './exercise.models';
import { EXERCISE_WIKI_CONTENT } from './exercise-wiki-content.generated';

export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface ExerciseWikiEntry {
  /** Matches the {@link ExerciseDefinition.id} in the main catalog. */
  id: string;
  /** Category the wiki entry is grouped under. */
  categoryId: ExerciseCategoryId;
  /**
   * Default URL slug, also used as the on-page anchor. Lowercase ASCII
   * kebab-case (no diacritics) so URL-encoded paths don't confuse
   * crawlers. Per-locale overrides can be added under `slugs` later;
   * the wiki currently ships with a single canonical slug per exercise
   * and the detail route maps every locale back through it.
   */
  slug: string;
  difficulty: ExerciseDifficulty;
  /** Material icon name for the list page. */
  icon: string;
}

/**
 * Ordered list of wiki entries. Order is editorial (groups exercises by
 * category, then beginner → advanced inside each category) and drives
 * the layout of the list page.
 */
export const EXERCISE_WIKI_CATALOG: ReadonlyArray<ExerciseWikiEntry> = [
  // core
  {
    id: 'plank.standard',
    categoryId: 'core',
    slug: 'plank',
    difficulty: 'beginner',
    icon: 'horizontal_rule',
  },
  {
    id: 'core.deadbug',
    categoryId: 'core',
    slug: 'dead-bug',
    difficulty: 'beginner',
    icon: 'self_improvement',
  },
  {
    id: 'core.hollowhold',
    categoryId: 'core',
    slug: 'hollow-hold',
    difficulty: 'intermediate',
    icon: 'horizontal_rule',
  },
  {
    id: 'abs.situps',
    categoryId: 'core',
    slug: 'sit-ups',
    difficulty: 'beginner',
    icon: 'self_improvement',
  },
  {
    id: 'abs.crunches',
    categoryId: 'core',
    slug: 'crunches',
    difficulty: 'beginner',
    icon: 'self_improvement',
  },
  {
    id: 'abs.legraises',
    categoryId: 'core',
    slug: 'leg-raises',
    difficulty: 'intermediate',
    icon: 'self_improvement',
  },
  {
    id: 'abs.russiantwist',
    categoryId: 'core',
    slug: 'russian-twist',
    difficulty: 'beginner',
    icon: 'self_improvement',
  },
  {
    id: 'abs.mountainclimbers',
    categoryId: 'core',
    slug: 'mountain-climbers',
    difficulty: 'beginner',
    icon: 'self_improvement',
  },

  // squat
  {
    id: 'legs.squats',
    categoryId: 'squat',
    slug: 'squats',
    difficulty: 'beginner',
    icon: 'airline_seat_legroom_reduced',
  },
  {
    id: 'legs.jumpsquats',
    categoryId: 'squat',
    slug: 'jump-squats',
    difficulty: 'intermediate',
    icon: 'directions_run',
  },
  {
    id: 'legs.calfraises',
    categoryId: 'squat',
    slug: 'calf-raises',
    difficulty: 'beginner',
    icon: 'directions_run',
  },
  {
    id: 'squat.wallsit',
    categoryId: 'squat',
    slug: 'wall-sit',
    difficulty: 'beginner',
    icon: 'airline_seat_legroom_reduced',
  },
  {
    id: 'squat.boxjump',
    categoryId: 'squat',
    slug: 'box-jumps',
    difficulty: 'intermediate',
    icon: 'directions_run',
  },

  // hinge
  {
    id: 'legs.glutebridge',
    categoryId: 'hinge',
    slug: 'glute-bridge',
    difficulty: 'beginner',
    icon: 'compress',
  },
  {
    id: 'hinge.singlelegRdl',
    categoryId: 'hinge',
    slug: 'single-leg-rdl',
    difficulty: 'intermediate',
    icon: 'compress',
  },
  {
    id: 'hinge.goodmorning',
    categoryId: 'hinge',
    slug: 'good-morning',
    difficulty: 'intermediate',
    icon: 'compress',
  },

  // lunge
  {
    id: 'legs.lunges',
    categoryId: 'lunge',
    slug: 'lunges',
    difficulty: 'beginner',
    icon: 'directions_walk',
  },
  {
    id: 'lunge.stepup',
    categoryId: 'lunge',
    slug: 'step-ups',
    difficulty: 'beginner',
    icon: 'stairs',
  },

  // push (non-pushup pressing)
  {
    id: 'push.benchdips',
    categoryId: 'push',
    slug: 'bench-dips',
    difficulty: 'beginner',
    icon: 'open_with',
  },
  {
    id: 'push.dips',
    categoryId: 'push',
    slug: 'dips',
    difficulty: 'intermediate',
    icon: 'open_with',
  },
  {
    id: 'push.handstandhold',
    categoryId: 'push',
    slug: 'handstand-hold',
    difficulty: 'advanced',
    icon: 'open_with',
  },

  // pull
  {
    id: 'pull.pullups',
    categoryId: 'pull',
    slug: 'pullups',
    difficulty: 'intermediate',
    icon: 'rowing',
  },
  {
    id: 'pull.rows',
    categoryId: 'pull',
    slug: 'rows',
    difficulty: 'beginner',
    icon: 'rowing',
  },
  {
    id: 'pull.deadhang',
    categoryId: 'pull',
    slug: 'dead-hang',
    difficulty: 'beginner',
    icon: 'rowing',
  },
  {
    id: 'pull.facepull',
    categoryId: 'pull',
    slug: 'face-pull',
    difficulty: 'beginner',
    icon: 'rowing',
  },

  // cardio
  {
    id: 'cardio.walking',
    categoryId: 'cardio',
    slug: 'walking',
    difficulty: 'beginner',
    icon: 'directions_walk',
  },
  {
    id: 'cardio.running',
    categoryId: 'cardio',
    slug: 'running',
    difficulty: 'beginner',
    icon: 'directions_run',
  },
  {
    id: 'cardio.cycling',
    categoryId: 'cardio',
    slug: 'cycling',
    difficulty: 'beginner',
    icon: 'directions_bike',
  },
  {
    id: 'cardio.rowing',
    categoryId: 'cardio',
    slug: 'rowing-machine',
    difficulty: 'beginner',
    icon: 'rowing',
  },
  {
    id: 'cardio.swimming',
    categoryId: 'cardio',
    slug: 'swimming',
    difficulty: 'beginner',
    icon: 'pool',
  },
  {
    id: 'cardio.jumprope',
    categoryId: 'cardio',
    slug: 'jump-rope',
    difficulty: 'beginner',
    icon: 'sports_handball',
  },
  {
    id: 'cardio.jumpingjacks',
    categoryId: 'cardio',
    slug: 'jumping-jacks',
    difficulty: 'beginner',
    icon: 'sports_handball',
  },
  {
    id: 'cardio.highknees',
    categoryId: 'cardio',
    slug: 'high-knees',
    difficulty: 'beginner',
    icon: 'directions_run',
  },
  {
    id: 'cardio.burpees',
    categoryId: 'cardio',
    slug: 'burpees',
    difficulty: 'intermediate',
    icon: 'directions_run',
  },

  // mobility
  {
    id: 'mobility.stretching',
    categoryId: 'mobility',
    slug: 'stretching',
    difficulty: 'beginner',
    icon: 'accessibility_new',
  },
  {
    id: 'mobility.dynamicwarmup',
    categoryId: 'mobility',
    slug: 'dynamic-warmup',
    difficulty: 'beginner',
    icon: 'accessibility_new',
  },
  {
    id: 'mobility.yoga',
    categoryId: 'mobility',
    slug: 'yoga',
    difficulty: 'beginner',
    icon: 'self_improvement',
  },
  {
    id: 'mobility.foamrolling',
    categoryId: 'mobility',
    slug: 'foam-rolling',
    difficulty: 'beginner',
    icon: 'accessibility_new',
  },
  {
    id: 'mobility.catcow',
    categoryId: 'mobility',
    slug: 'cat-cow',
    difficulty: 'beginner',
    icon: 'accessibility_new',
  },
  {
    id: 'mobility.hipopener',
    categoryId: 'mobility',
    slug: 'hip-opener',
    difficulty: 'beginner',
    icon: 'accessibility_new',
  },
];

const ENTRIES_BY_ID: ReadonlyMap<string, ExerciseWikiEntry> = new Map(
  EXERCISE_WIKI_CATALOG.map((e) => [e.id, e])
);

const ENTRIES_BY_SLUG: ReadonlyMap<string, ExerciseWikiEntry> = new Map(
  EXERCISE_WIKI_CATALOG.map((e) => [e.slug, e])
);

export function findExerciseWikiEntry(
  id: string | null | undefined
): ExerciseWikiEntry | null {
  if (!id) return null;
  return ENTRIES_BY_ID.get(id) ?? null;
}

export function findExerciseWikiEntryBySlug(
  slug: string | null | undefined
): ExerciseWikiEntry | null {
  if (!slug) return null;
  return ENTRIES_BY_SLUG.get(slug) ?? null;
}

export interface ExerciseWikiLocalized {
  name: string;
  summary: string;
  instructions: ReadonlyArray<string>;
  tips: ReadonlyArray<string>;
}

/**
 * Resolves the localised wiki copy for an entry. Falls back through the
 * locale's primary subtag (e.g. `fr-CH` → `fr`) → `en` → `de` so locales
 * without a translation still render meaningful copy from the canonical
 * German source. Returns `null` only if no copy exists at all (which
 * would be a build-time error caught by the generator).
 */
export function localizeExerciseWiki(
  entry: ExerciseWikiEntry,
  locale: string
): ExerciseWikiLocalized | null {
  const primary = locale.toLowerCase().split(/[-_]/)[0];
  const overrides = EXERCISE_WIKI_CONTENT[entry.id];
  if (!overrides) return null;
  const content = overrides[primary] ?? overrides['en'] ?? overrides['de'];
  if (!content) return null;
  return {
    name: content.name,
    summary: content.summary,
    instructions: content.instructions,
    tips: content.tips,
  };
}
