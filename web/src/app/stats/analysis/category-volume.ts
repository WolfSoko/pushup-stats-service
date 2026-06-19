import {
  EXERCISE_CATEGORIES,
  type ExerciseCategoryId,
  type ExerciseDefinition,
  type UnifiedEntry,
  unifiedEntryCategoryId,
} from '@pu-stats/models';
import { categoryDisplayName } from '../i18n/exercise-display-names';
import type { CategoryComparison, CategorySummary } from './analysis.types';
import { computeCategoryVolume } from './category-facets';
import { computeCurrentStreak } from './trend-math';

/**
 * Per-category roll-up for the overview tab, ordered by the catalog's
 * `order`. Categories with no rows in the range are omitted, so every
 * entry represents a present, non-empty group.
 */
export function buildCategorySummaries(
  rows: ReadonlyArray<UnifiedEntry>,
  resolver: (id: string) => ExerciseDefinition | null,
  todayKey: string
): CategorySummary[] {
  const byCategory = new Map<ExerciseCategoryId, UnifiedEntry[]>();
  for (const row of rows) {
    const cat = unifiedEntryCategoryId(row, resolver);
    if (!cat) continue;
    const bucket = byCategory.get(cat);
    if (bucket) bucket.push(row);
    else byCategory.set(cat, [row]);
  }
  const result: CategorySummary[] = [];
  for (const meta of EXERCISE_CATEGORIES) {
    const catRows = byCategory.get(meta.id);
    if (!catRows || !catRows.length) continue;
    result.push({
      categoryId: meta.id,
      nameKey: meta.nameKey,
      icon: meta.icon,
      order: meta.order,
      entries: catRows.length,
      currentStreak: computeCurrentStreak(catRows),
      volume: computeCategoryVolume(catRows, todayKey),
    });
  }
  return result.sort((a, b) => a.order - b.order);
}

/**
 * Overview comparison series. The chart compares categories by training
 * count — a measurement-agnostic axis — so summed-volume metrics are
 * intentionally omitted: reps, seconds and meters can no longer share a
 * bar.
 */
export function buildCategoryComparison(
  summaries: ReadonlyArray<CategorySummary>
): CategoryComparison {
  return {
    labels: summaries.map((s) => categoryDisplayName(s.categoryId)),
    entries: summaries.map((s) => s.entries),
  };
}
