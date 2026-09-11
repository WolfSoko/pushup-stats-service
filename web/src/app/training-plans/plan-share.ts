import { buildPlanShareUrl } from '../core/profile-share-url';
import type { SharePayload } from '../core/share.service';

export interface SharePlanInput {
  title: string;
  /** Day the user stands on, `null` before the first day is known. */
  dayIndex: number | null;
  totalDays: number;
  percent: number;
  slug: string;
  localeId: string;
  paused: boolean;
}

/**
 * The share-sheet payload for "this is the plan I'm running".
 *
 * Shares the plan's own public page rather than the profile: the reader's
 * next step is starting the same plan, and that page is where they do it.
 * Progress goes in the text, because the plan page cannot know whose
 * progress it is.
 */
export function buildSharePlanPayload(input: SharePlanInput): SharePayload {
  const { title, dayIndex, totalDays, percent, slug, localeId, paused } = input;
  const url = buildPlanShareUrl(slug, localeId);
  const day = dayIndex ?? 0;
  const done = Math.round(percent);

  let text: string;
  if (day < 1 || totalDays < 1) {
    text = $localize`:@@trainingPlans.share.plain:Ich trainiere mit dem Plan „${title}:title:“ 💪 Mach mit:`;
  } else if (paused) {
    text = $localize`:@@trainingPlans.share.paused:Mein Plan „${title}:title:“ wartet bei Tag ${day}:day: von ${totalDays}:total: auf mich – ich steige wieder ein 💪`;
  } else {
    text = $localize`:@@trainingPlans.share.day:Tag ${day}:day: von ${totalDays}:total: im Plan „${title}:title:“ 💪 ${done}:percent: % geschafft.`;
  }

  return {
    title: $localize`:@@trainingPlans.share.title:Pushup Tracker Trainingsplan`,
    text,
    url,
  };
}
