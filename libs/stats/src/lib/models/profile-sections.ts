/**
 * Elements a user can switch off on their public profile.
 *
 * Shared between the Cloud Function that builds the projection and the
 * profile page that renders the switches: the server has to *omit* a
 * hidden element, not merely hide it in the template, or the value would
 * still sit in the network response for anyone to read. Two separate
 * lists would drift the moment an element is added.
 */
export const PROFILE_SECTIONS = [
  'total',
  'streak',
  'days',
  'entries',
  'week',
  'month',
  'bestSet',
  'bestDay',
  'achievements',
  'exercises',
  'heatmap',
  'recent',
  'plan',
] as const;

export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export function isProfileSection(value: unknown): value is ProfileSection {
  return (
    typeof value === 'string' &&
    (PROFILE_SECTIONS as readonly string[]).includes(value)
  );
}

/**
 * Reads the persisted opt-out list. Anything unrecognised is dropped
 * rather than carried along: a stale id from a removed element would
 * otherwise linger in the config forever, and a malformed one must never
 * turn into a section name by accident.
 */
export function normalizeHiddenSections(value: unknown): ProfileSection[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<ProfileSection>();
  for (const entry of value) {
    if (isProfileSection(entry)) seen.add(entry);
  }
  return PROFILE_SECTIONS.filter((section) => seen.has(section));
}

export function isSectionVisible(
  hidden: readonly ProfileSection[],
  section: ProfileSection
): boolean {
  return !hidden.includes(section);
}
