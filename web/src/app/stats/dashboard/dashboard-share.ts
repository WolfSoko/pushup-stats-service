import { buildProfileShareUrl } from '../../core/profile-share-url';

export interface ShareDayInput {
  /** What was logged today, already formatted (see `formatDaySummary`). */
  summary: string;
  streak: number;
  /** Current user id, or empty when signed out. */
  uid: string;
  /** Whether the user opted into a public profile (richer OG card). */
  publicProfile: boolean;
  localeId: string;
}

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

/**
 * Builds the share-sheet payload for "share today's progress". When the
 * user opted into a public profile we share their profile URL (dynamic
 * OG card with per-user stats) instead of the generic homepage, and the
 * copy nudges the reader to view the profile.
 *
 * The text leads with the day's actual exercises rather than a push-up
 * count — see `dashboard-share-summary.ts`.
 */
export function buildShareDayPayload(input: ShareDayInput): SharePayload {
  const { summary, streak, uid, publicProfile, localeId } = input;
  const profileUrl =
    publicProfile && uid ? buildProfileShareUrl(uid, localeId) : '';

  let text: string;
  if (profileUrl) {
    text =
      streak > 1
        ? $localize`:@@dashboard.share.day.profile.streak:Heute: ${summary}:summary: 💪 Streak: ${streak}:streak: Tage 🔥 Schau dir mein Profil an:`
        : $localize`:@@dashboard.share.day.profile.simple:Heute: ${summary}:summary: 💪 Schau dir mein Profil an:`;
  } else {
    text =
      streak > 1
        ? $localize`:@@dashboard.share.day.streak:Heute: ${summary}:summary: 💪 Streak: ${streak}:streak: Tage 🔥 Tracke deine Stats kostenlos:`
        : $localize`:@@dashboard.share.day.simple:Heute: ${summary}:summary: 💪 Tracke deine Stats kostenlos:`;
  }

  return {
    title: $localize`:@@dashboard.share.title:Pushup Tracker`,
    text,
    url: profileUrl || 'https://pushup-stats.com',
  };
}
