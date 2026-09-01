import { TRAINING_PLAN_CONTENT } from './training-plan-content.generated';

/**
 * Resolves the long-form editorial HTML for a training plan detail page.
 * Falls back `en` → `de` (mirroring `localizeExerciseWiki`) so partially
 * translated plans still render meaningful copy. Returns `null` when a
 * plan ships no markdown yet — the detail page then omits the section.
 */
export function localizeTrainingPlanContent(
  slug: string,
  locale: string
): string | null {
  const primary = locale.toLowerCase().split(/[-_]/)[0];
  const perLocale = TRAINING_PLAN_CONTENT[slug];
  if (!perLocale) return null;
  return perLocale[primary] ?? perLocale['en'] ?? perLocale['de'] ?? null;
}
