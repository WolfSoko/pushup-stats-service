import {
  normalizeHiddenSections,
  PROFILE_SECTIONS,
  type ProfileSection,
} from './profile-sections';

/**
 * Who may see which part of a profile.
 *
 * The profile used to know two states — public or not — plus a per-section
 * opt-out. Friendships add a third audience between those two, so each
 * section carries a level instead of a boolean:
 *
 * - `'off'` — nobody but the owner.
 * - `'friends'` — confirmed friends only.
 * - `'public'` — anyone with the link.
 *
 * Legacy configs have no levels. They are read through
 * {@link sectionVisibility}, which derives the level from the old fields
 * so nothing has to be migrated: a section the user switched off stays
 * off, and everything else becomes `'public'` on a public profile or
 * `'friends'` on a private one — friendship is mutual and explicit, so a
 * confirmed friend is a audience the user agreed to.
 */

export type ProfileSectionVisibility = 'off' | 'friends' | 'public';

/** Who is asking. The owner always sees everything. */
export type ProfileViewer = 'owner' | 'friend' | 'public';

export interface ProfileVisibilityUi {
  publicProfile?: boolean;
  /** Legacy opt-out list; still honoured, never written any more. */
  profileHidden?: unknown;
  /** Per-section level, keyed by `ProfileSection`. */
  profileVisibility?: Readonly<Record<string, string>>;
}

export function isProfileSectionVisibility(
  value: unknown
): value is ProfileSectionVisibility {
  return value === 'off' || value === 'friends' || value === 'public';
}

/** The level in force for one section, legacy configs included. */
export function sectionVisibility(
  ui: ProfileVisibilityUi | undefined | null,
  section: ProfileSection
): ProfileSectionVisibility {
  const explicit = ui?.profileVisibility?.[section];
  if (isProfileSectionVisibility(explicit)) return explicit;
  if (normalizeHiddenSections(ui?.profileHidden).includes(section)) {
    return 'off';
  }
  return ui?.publicProfile === true ? 'public' : 'friends';
}

/** Every section's level, in catalog order. */
export function profileVisibilityMap(
  ui: ProfileVisibilityUi | undefined | null
): Record<ProfileSection, ProfileSectionVisibility> {
  const map = {} as Record<ProfileSection, ProfileSectionVisibility>;
  for (const section of PROFILE_SECTIONS) {
    map[section] = sectionVisibility(ui, section);
  }
  return map;
}

export function isSectionVisibleTo(
  level: ProfileSectionVisibility,
  viewer: ProfileViewer
): boolean {
  if (viewer === 'owner') return true;
  if (level === 'off') return false;
  if (level === 'public') return true;
  return viewer === 'friend';
}

/**
 * Whether the profile page exists at all for this viewer.
 *
 * A confirmed friend always gets the page — they asked, the owner agreed,
 * and the page then shows whatever their levels allow, possibly nothing
 * but the name they already know. Everyone else still needs the public
 * opt-in, exactly as before.
 */
export function canViewProfile(
  ui: ProfileVisibilityUi | undefined | null,
  viewer: ProfileViewer
): boolean {
  if (viewer === 'owner' || viewer === 'friend') return true;
  return ui?.publicProfile === true;
}

/**
 * The map to persist when the user moves one section's switch. Drops
 * unknown ids so a stale section can't linger in the config forever.
 */
export function withSectionVisibility(
  current: Readonly<Record<string, string>> | undefined,
  section: ProfileSection,
  level: ProfileSectionVisibility
): Record<ProfileSection, ProfileSectionVisibility> {
  const next = {} as Record<ProfileSection, ProfileSectionVisibility>;
  for (const known of PROFILE_SECTIONS) {
    const value = known === section ? level : current?.[known];
    if (isProfileSectionVisibility(value)) next[known] = value;
  }
  return next;
}

/**
 * The next audience in the cycle the profile page offers: widest first,
 * so the common case (show this to everyone) is one tap from the default.
 */
export function nextSectionVisibility(
  level: ProfileSectionVisibility
): ProfileSectionVisibility {
  if (level === 'public') return 'friends';
  if (level === 'friends') return 'off';
  return 'public';
}
