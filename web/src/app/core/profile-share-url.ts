import { REFERRAL_PARAM } from '@pu-stats/models';

import { SUPPORTED_LOCALES } from '../../server-locale-redirect';

/**
 * Builds the canonical public-profile share URL for the current locale.
 *
 * Centralised so the public-profile page (`shareProfile()`) and the Settings
 * page (`profileUrl` computed) produce the same shape — including the
 * locale prefix the SSR redirect would otherwise have to inject. Without
 * the prefix, a recipient pasting the link into a tool that strips 30x
 * hops would land on the static `Cannot GET /u/<uid>` instead of the
 * Angular bundle for their locale.
 */
const SHARE_URL_BASE = 'https://pushup-stats.com';

/**
 * The locale prefix a shared link should carry. Every locale the i18n
 * build emits has its own subPath; sending an Italian user's followers to
 * `/de/` handed them a page in a language nobody asked for.
 */
function shareLocalePrefix(localeId: string | null | undefined): string {
  const code = (localeId ?? '').toLowerCase().split('-')[0];
  return SUPPORTED_LOCALES.find((locale) => locale === code) ?? 'de';
}

export function buildProfileShareUrl(
  uid: string | null | undefined,
  localeId: string | null | undefined
): string {
  if (!uid) return '';
  return `${SHARE_URL_BASE}/${shareLocalePrefix(localeId)}/u/${encodeURIComponent(uid)}`;
}

/**
 * The public page of a training plan, locale-prefixed like the profile
 * link above and for the same reason.
 */
export function buildPlanShareUrl(
  slug: string | null | undefined,
  localeId: string | null | undefined
): string {
  if (!slug) return SHARE_URL_BASE;
  const lang = shareLocalePrefix(localeId);
  return `${SHARE_URL_BASE}/${lang}/training-plans/${encodeURIComponent(slug)}`;
}

/**
 * The link a user hands to a friend. Carries `?ref=<uid>` so the signup it
 * produces can be attributed back (see `referral.models.ts`).
 *
 * Points at the user's public profile when they have one — a page with
 * their own numbers and an OG card converts better than the homepage —
 * and falls back to the landing page otherwise.
 */
export function buildInviteUrl(
  uid: string | null | undefined,
  localeId: string | null | undefined,
  publicProfile: boolean
): string {
  if (!uid) return SHARE_URL_BASE;
  const ref = `${REFERRAL_PARAM}=${encodeURIComponent(uid)}`;
  if (publicProfile) return `${buildProfileShareUrl(uid, localeId)}?${ref}`;
  return `${SHARE_URL_BASE}/${shareLocalePrefix(localeId)}?${ref}`;
}
