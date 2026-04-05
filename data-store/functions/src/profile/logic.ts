/**
 * User profile and display name utilities
 * Pure logic, no Firebase dependencies
 */

export interface UserProfile {
  displayName?: string;
  ui?: { hideFromLeaderboard?: boolean };
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
