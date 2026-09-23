import {
  EXERCISE_WIKI_CATALOG,
  type ExerciseWikiEntry,
  localizeExerciseWiki,
  localizePushupType,
  localizePushupTypeSlug,
  PUSHUP_TYPES,
} from '@pu-stats/models';

import {
  matchesTokens,
  normalizeSearch,
  searchTokens,
} from '../core/search-text';
import { isWorkoutExercise } from '../workouts/workout-form';

/**
 * View model and search for the exercise wiki list. Pure, so the page
 * component only binds: the localized catalog is built once per locale,
 * and a query narrows it without touching the DOM structure (every
 * section keeps its anchor id, just fewer of them render).
 */

export interface WikiExerciseItem {
  readonly id: string;
  readonly slug: string;
  readonly difficulty: ExerciseWikiEntry['difficulty'];
  readonly name: string;
  readonly summary: string;
  readonly instructions: ReadonlyArray<string>;
  readonly tips: ReadonlyArray<string>;
  /** Whether a custom session may name this exercise ("Als Session anlegen"). */
  readonly workoutReady: boolean;
  readonly searchText: string;
}

export interface WikiCategoryGroup {
  readonly id: ExerciseWikiEntry['categoryId'];
  readonly label: string;
  readonly entries: ReadonlyArray<WikiExerciseItem>;
}

/** A pushup type matching the query — they live in their own wiki. */
export interface PushupTypeHit {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export type CategoryLabels = Partial<
  Record<ExerciseWikiEntry['categoryId'], string>
>;

/** Every wiki entry localized and grouped by category, in catalog order. */
export function buildWikiCategories(
  locale: string,
  labels: CategoryLabels
): WikiCategoryGroup[] {
  const grouped = new Map<
    ExerciseWikiEntry['categoryId'],
    WikiExerciseItem[]
  >();
  for (const entry of EXERCISE_WIKI_CATALOG) {
    const localized = localizeExerciseWiki(entry, locale);
    if (!localized) continue;
    const label = labels[entry.categoryId] ?? entry.categoryId;
    const bucket = grouped.get(entry.categoryId) ?? [];
    bucket.push({
      id: entry.id,
      slug: entry.slug,
      difficulty: entry.difficulty,
      name: localized.name,
      summary: localized.summary,
      instructions: localized.instructions,
      tips: localized.tips,
      workoutReady: isWorkoutExercise(entry.id),
      searchText: normalizeSearch(
        `${localized.name} ${label} ${localized.summary} ${entry.slug}`
      ),
    });
    grouped.set(entry.categoryId, bucket);
  }
  return [...grouped].map(([id, entries]) => ({
    id,
    label: labels[id] ?? id,
    entries,
  }));
}

/**
 * Narrow the groups to entries matching every query token — by name,
 * category or summary, so "rücken" finds the back exercises as well as
 * the ones whose name says it. Empty groups drop out.
 */
export function filterWikiCategories(
  query: string,
  groups: ReadonlyArray<WikiCategoryGroup>
): WikiCategoryGroup[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [...groups];
  return groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) =>
        matchesTokens(tokens, entry.searchText)
      ),
    }))
    .filter((group) => group.entries.length > 0);
}

/** Pushup types matching a non-blank query; none for a blank one. */
export function pushupTypeHits(query: string, locale: string): PushupTypeHit[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];
  return PUSHUP_TYPES.flatMap((type) => {
    const localized = localizePushupType(type, locale);
    const text = normalizeSearch(`${localized.name} ${localized.summary}`);
    if (!matchesTokens(tokens, text)) return [];
    return [
      {
        id: type.id,
        name: localized.name,
        slug: localizePushupTypeSlug(type, locale),
      },
    ];
  });
}

/** Whether the query is about pushups as such, e.g. "liegest" or "push". */
export function matchesPushupHub(query: string, hubText: string): boolean {
  return matchesTokens(searchTokens(query), normalizeSearch(hubText));
}
