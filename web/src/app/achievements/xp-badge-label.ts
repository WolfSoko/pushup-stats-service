import type { AchievementDefinition } from '@pu-stats/models';

/**
 * Labels of the XP badges (level, variety). Kept apart from
 * `achievementLabel` so the public profile can share them without
 * importing `TRAINING_PLANS`, which that label module needs for plan
 * names.
 */
export function xpBadgeLabel(definition: AchievementDefinition): string | null {
  if (definition.kind === 'level') {
    const level = definition.threshold ?? 0;
    return $localize`:@@achievements.label.level:Level ${level}:level: erreicht`;
  }
  if (definition.kind === 'variety') {
    const categories = definition.threshold ?? 0;
    return $localize`:@@achievements.label.variety:Vielseitig: ${categories}:categories: Kategorien`;
  }
  return null;
}
