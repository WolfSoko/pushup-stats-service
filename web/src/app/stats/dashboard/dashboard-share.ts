import { buildProfileShareUrl } from '../../core/profile-share-url';

export interface ShareDayInput {
  total: number;
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
 */
export function buildShareDayPayload(input: ShareDayInput): SharePayload {
  const { total, streak, uid, publicProfile, localeId } = input;
  const profileUrl =
    publicProfile && uid ? buildProfileShareUrl(uid, localeId) : '';

  let text: string;
  if (profileUrl) {
    text =
      streak > 1
        ? $localize`:@@dashboard.share.text.profile.streak:Heute schon ${total}:total: Liegestütze geschafft – Streak: ${streak}:streak: Tage 🔥 Schau dir mein Profil an:`
        : $localize`:@@dashboard.share.text.profile.simple:Heute schon ${total}:total: Liegestütze geschafft! 💪 Schau dir mein Profil an:`;
  } else {
    text =
      streak > 1
        ? $localize`:@@dashboard.share.text.streak:Heute schon ${total}:total: Liegestütze geschafft – Streak: ${streak}:streak: Tage 🔥 Tracke deine Stats kostenlos:`
        : $localize`:@@dashboard.share.text.simple:Heute schon ${total}:total: Liegestütze geschafft! 💪 Tracke deine Stats kostenlos:`;
  }

  return {
    title: $localize`:@@dashboard.share.title:Pushup Tracker`,
    text,
    url: profileUrl || 'https://pushup-stats.com',
  };
}
