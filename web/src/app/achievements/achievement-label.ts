import { TRAINING_PLANS, type AchievementDefinition } from '@pu-stats/models';
import { xpBadgeLabel } from './xp-badge-label';

/**
 * Badge labels for the owner's own collection.
 *
 * Deliberately separate from `public-profile/achievement-badge.ts`,
 * which keeps labels generic ("Trainingsplan abgeschlossen") to avoid
 * pulling the 2000-line `TRAINING_PLANS` catalog into a route anonymous
 * visitors load. This page is lazy and behind `authGuard`, and anyone
 * signed in has the catalog loaded for `/training-plans` anyway — so
 * here the plan is named. The two are expected to diverge; do not merge
 * them.
 */
export function achievementLabel(definition: AchievementDefinition): string {
  if (definition.kind === 'plan-completed') {
    const title = TRAINING_PLANS.find(
      (plan) => plan.id === definition.planId
    )?.title;
    return title
      ? $localize`:@@achievements.label.planCompletedNamed:${title}:plan: abgeschlossen`
      : $localize`:@@achievements.label.planCompleted:Trainingsplan abgeschlossen`;
  }

  if (definition.kind === 'invites') {
    const invites = definition.threshold ?? 0;
    return invites === 1
      ? $localize`:@@achievements.label.firstInvite:Ersten Freund eingeladen`
      : $localize`:@@achievements.label.invites:${invites}:invites: Freunde eingeladen`;
  }

  const xpLabel = xpBadgeLabel(definition);
  if (xpLabel) return xpLabel;

  const days = definition.threshold ?? 0;
  return days === 1
    ? $localize`:@@achievements.label.firstPlanDay:Erster Plantag`
    : $localize`:@@achievements.label.planDays:${days}:days: Plantage`;
}
