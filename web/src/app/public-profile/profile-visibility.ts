import {
  normalizeHiddenSections,
  PROFILE_SECTIONS,
  type ProfileSection,
} from '@pu-stats/models';

export interface SectionControl {
  readonly id: ProfileSection;
  readonly label: string;
}

/**
 * Adds or removes one element from the opt-out list.
 *
 * Always returns a normalised list so the value written to the config has
 * the same shape and order as the one read back — otherwise the very next
 * comparison reports a change that never happened.
 */
export function withSectionVisible(
  hidden: ReadonlyArray<ProfileSection>,
  section: ProfileSection,
  visible: boolean
): ProfileSection[] {
  const next = new Set(hidden);
  if (visible) next.delete(section);
  else next.add(section);
  return normalizeHiddenSections([...next]);
}

/**
 * What a visitor would see. Used for the owner's preview, which must
 * apply exactly the rule the server applies — a preview that guessed
 * differently would be worse than none.
 */
export function visibleSections(
  hidden: ReadonlyArray<ProfileSection>
): ProfileSection[] {
  return PROFILE_SECTIONS.filter((section) => !hidden.includes(section));
}
