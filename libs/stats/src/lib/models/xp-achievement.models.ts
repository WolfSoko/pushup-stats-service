import type {
  AchievementDefinition,
  AchievementId,
} from './achievement.models';
import { findExerciseDefinition } from './exercise.catalog';
import { levelForXp } from './xp.models';

/**
 * Level badges: sparse on purpose, like the plan-day milestones — one
 * per stretch of the level curve that takes noticeably longer than the
 * one before.
 */
export const LEVEL_MILESTONES: ReadonlyArray<number> = [
  5, 10, 20, 30, 50, 75, 100,
];

export function levelAchievementId(level: number): AchievementId {
  return `level-${level}`;
}

function levelIcon(level: number): string {
  if (level >= 50) return 'diamond';
  if (level >= 20) return 'local_fire_department';
  return 'bolt';
}

export const LEVEL_ACHIEVEMENTS: ReadonlyArray<AchievementDefinition> =
  LEVEL_MILESTONES.map((threshold) => ({
    id: levelAchievementId(threshold),
    kind: 'level' as const,
    icon: levelIcon(threshold),
    threshold,
  }));

/** Distinct exercise categories a user has earned XP in. */
export const VARIETY_MILESTONES: ReadonlyArray<number> = [3, 5, 8];

export function varietyAchievementId(categories: number): AchievementId {
  return `variety-${categories}`;
}

export const VARIETY_ACHIEVEMENTS: ReadonlyArray<AchievementDefinition> =
  VARIETY_MILESTONES.map((threshold) => ({
    id: varietyAchievementId(threshold),
    kind: 'variety' as const,
    icon: threshold >= 8 ? 'hub' : 'category',
    threshold,
  }));

export function xpCategoryCount(
  byExercise: Readonly<Record<string, number>>
): number {
  const categories = new Set<string>();
  for (const [exerciseId, xp] of Object.entries(byExercise)) {
    if (!(xp > 0)) continue;
    const definition = findExerciseDefinition(exerciseId);
    if (definition) categories.add(definition.categoryId);
  }
  return categories.size;
}

/**
 * Level and variety badges a user's XP state entitles them to. Like
 * `deriveAchievements` this is the entitlement, not a delta — the caller
 * only ever adds, so losing XP through a deleted entry never takes a
 * badge away.
 */
export function deriveXpAchievements(input: {
  readonly total: number;
  readonly byExercise: Readonly<Record<string, number>>;
}): ReadonlyArray<AchievementId> {
  const level = levelForXp(input.total);
  const categories = xpCategoryCount(input.byExercise);
  return [
    ...LEVEL_MILESTONES.filter((m) => level >= m).map(levelAchievementId),
    ...VARIETY_MILESTONES.filter((m) => categories >= m).map(
      varietyAchievementId
    ),
  ];
}
