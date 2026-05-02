/**
 * User profile and display name utilities
 * Pure logic, no Firebase dependencies
 */

export interface UserProfile {
  displayName?: string;
  ui?: { hideFromLeaderboard?: boolean; publicProfile?: boolean };
  role?: string;
}

const ANONYMOUS_LABEL = 'anonym';

/**
 * Returns the anonymous user label
 */
export function toAnonymousLabel(): string {
  return ANONYMOUS_LABEL;
}

/**
 * Converts a user profile to a public display name
 * Returns anonymous label if displayName is empty/null
 * @param profile User profile object
 * @returns Public display name or 'anonym' if empty
 */
export function toPublicDisplayName(profile?: UserProfile): string {
  const name = String(profile?.displayName || '').trim();
  if (!name) return toAnonymousLabel();
  return name;
}

/**
 * Checks if a user profile is allowed to appear on the leaderboard
 * Returns true only if hideFromLeaderboard is explicitly set to false
 * (undefined/true defaults to hidden for privacy)
 * @param profile User profile object
 * @returns true if user opted in to leaderboard visibility
 */
export function isLeaderboardNameAllowed(profile?: UserProfile): boolean {
  return profile?.ui?.hideFromLeaderboard === false;
}

/**
 * Whether a leaderboard entry should carry the user's UID so the frontend
 * can link to `/u/<uid>`.
 *
 * Three independent gates:
 * 1. Leaderboard name is allowed (`hideFromLeaderboard === false`) so the
 *    displayed alias is the real name.
 * 2. Public profile is enabled (`publicProfile === true`).
 * 3. `displayName` is non-empty after trimming. Without this, a user with
 *    both opt-ins but a blank name would render as `anonym` (via
 *    `toPublicDisplayName`'s fallback) AND get a clickable `/u/<uid>` —
 *    a stable, profile-correlatable handle hiding behind an apparently
 *    anonymous alias. The third gate forecloses that leak.
 */
export function isPublicProfileLinkAllowed(profile?: UserProfile): boolean {
  if (!isLeaderboardNameAllowed(profile)) return false;
  if (profile?.ui?.publicProfile !== true) return false;
  return String(profile?.displayName || '').trim().length > 0;
}
