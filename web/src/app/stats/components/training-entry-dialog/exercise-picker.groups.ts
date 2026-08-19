import {
  EXERCISE_CATEGORIES,
  ExerciseCategoryId,
  exercisesByCategory,
  findExerciseDefinition,
} from '@pu-stats/models';
import {
  categoryDisplayName,
  exerciseDisplayName,
} from '../../i18n/exercise-display-names';
import {
  ExercisePickerGroup,
  ExercisePickerOption,
  ExerciseSuggestions,
  PUSHUP_EXERCISE_ID,
} from './training-entry-dialog.models';

/** How many distinct recently logged exercises the picker offers up front. */
export const RECENT_SUGGESTION_LIMIT = 5;

const PLANNED_GROUP_KEY = 'planned';
const RECENT_GROUP_KEY = 'recent';

/**
 * Option list for the exercise autocomplete, ordered by how likely the
 * user is to pick it right now:
 *
 *   1. what today prescribes (active plan day + daily goals),
 *   2. what they logged most recently,
 *   3. the full catalog, grouped by category.
 *
 * Suggested exercises stay listed in their category group too — the
 * category sections are the mental model for browsing, and dropping a
 * row from "Rumpf" just because it is also suggested reads as a bug.
 */
export function buildExercisePickerGroups(
  suggestions: ExerciseSuggestions = {}
): ExercisePickerGroup[] {
  const planned = knownIds(suggestions.plannedExerciseIds);
  const recent = knownIds(suggestions.recentExerciseIds)
    .filter((id) => !planned.includes(id))
    .slice(0, RECENT_SUGGESTION_LIMIT);

  const groups: ExercisePickerGroup[] = [];
  if (planned.length > 0) {
    groups.push({
      key: PLANNED_GROUP_KEY,
      label: $localize`:@@entryDialog.picker.plannedToday:Heute geplant`,
      options: planned.map(toOption),
    });
  }
  if (recent.length > 0) {
    groups.push({
      key: RECENT_GROUP_KEY,
      label: $localize`:@@entryDialog.picker.recent:Zuletzt genutzt`,
      options: recent.map(toOption),
    });
  }

  const byCategory = exercisesByCategory();
  for (const category of EXERCISE_CATEGORIES) {
    const defs = byCategory.get(category.id) ?? [];
    if (defs.length === 0) continue;
    groups.push({
      key: category.id,
      label: categoryDisplayName(category.id),
      options: defs.map((def) => toOption(def.id)),
    });
  }
  return groups;
}

/**
 * Narrow the groups to what matches the typed query. Every whitespace
 * separated token must match the exercise name or its category, so
 * "kn beu" still finds Kniebeugen and "rumpf" lists the whole category.
 * Empty groups are dropped so the panel never shows a bare header.
 */
export function filterExercisePickerGroups(
  query: string,
  groups: ReadonlyArray<ExercisePickerGroup>
): ExercisePickerGroup[] {
  const tokens = normalizeSearch(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return [...groups];
  return groups
    .map((group) => ({
      ...group,
      options: group.options.filter((option) =>
        tokens.every((token) => option.searchText.includes(token))
      ),
    }))
    .filter((group) => group.options.length > 0);
}

/**
 * Exercise the dialog opens on: today's first prescribed exercise, else
 * the most recently logged one, else pushups — the app's headline
 * workout and the safest default when nothing is known about the user.
 */
export function initialSuggestedExerciseId(
  suggestions: ExerciseSuggestions = {}
): string {
  return (
    knownIds(suggestions.plannedExerciseIds)[0] ??
    knownIds(suggestions.recentExerciseIds)[0] ??
    PUSHUP_EXERCISE_ID
  );
}

/**
 * Case- and diacritic-insensitive search key. Users type "kniebeuge" or
 * "russian twist" without umlauts far more often than not, and the
 * catalog mixes German and English names.
 */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function knownIds(ids: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  return (ids ?? []).filter((id) => {
    if (seen.has(id) || !findExerciseDefinition(id)) return false;
    seen.add(id);
    return true;
  });
}

function toOption(id: string): ExercisePickerOption {
  const label = exerciseDisplayName(id);
  const categoryId: ExerciseCategoryId =
    findExerciseDefinition(id)?.categoryId ?? 'pushup';
  const categoryLabel = categoryDisplayName(categoryId);
  return {
    id,
    label,
    categoryLabel,
    searchText: normalizeSearch(`${label} ${categoryLabel}`),
  };
}
