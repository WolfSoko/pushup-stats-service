import { findAchievementDefinition } from '@pu-stats/models';

export interface AchievementBadge {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
}

/**
 * Resolves a stored achievement id into something renderable.
 *
 * Labels stay generic — "Trainingsplan abgeschlossen" rather than the
 * plan's name — on purpose: naming the plan would mean importing
 * `TRAINING_PLANS` (2000+ lines, every day of every plan) into the
 * public profile route, which anonymous visitors load. The badge is
 * recognisable without it.
 *
 * Unknown ids yield `null` so a badge earned under an older catalog is
 * skipped instead of breaking the page.
 */
export function resolveAchievementBadge(id: string): AchievementBadge | null {
  const definition = findAchievementDefinition(id);
  if (!definition) return null;

  if (definition.kind === 'plan-completed') {
    return {
      id,
      icon: definition.icon,
      label: $localize`:@@publicProfile.badge.planCompleted:Trainingsplan abgeschlossen`,
    };
  }

  const days = definition.threshold ?? 0;
  const label =
    days === 1
      ? $localize`:@@publicProfile.badge.firstPlanDay:Erster Plantag`
      : $localize`:@@publicProfile.badge.planDays:${days}:days: Plantage`;
  return { id, icon: definition.icon, label };
}

export function resolveAchievementBadges(
  ids: ReadonlyArray<string>
): ReadonlyArray<AchievementBadge> {
  return ids
    .map(resolveAchievementBadge)
    .filter((badge): badge is AchievementBadge => badge !== null);
}
