import { computed, signal, type Signal } from '@angular/core';
import {
  isSectionVisibleTo,
  nextSectionVisibility,
  withSectionVisibility,
  type ProfileSection,
  type ProfileSectionVisibility,
  type ProfileViewer,
  type PublicProfile,
} from '@pu-stats/models';

import { PROFILE_LABELS } from './profile-labels';

/**
 * Whose eyes the owner is looking through.
 *
 * The page used to know two faces: the owner's control panel, and "what a
 * visitor gets". Friendships put a third audience between those, and an
 * element set to `'friends'` was the one thing the owner could not check
 * without asking an actual friend — so the preview is a mode, not a
 * boolean.
 */
export type ProfilePreviewMode = ProfileViewer;

export interface PreviewOption {
  readonly mode: ProfilePreviewMode;
  readonly label: string;
  readonly icon: string;
  readonly disabled: boolean;
}

/**
 * Who sees which part of the profile, and as whom the page renders.
 *
 * Pulled out of the page component: the switches, their audience levels
 * and the preview are one concern with enough rules to test on their own,
 * and the component is left with loading, photo and sharing.
 */
export class ProfileAudienceView {
  constructor(
    private readonly profile: Signal<PublicProfile | null>,
    private readonly persist: (
      levels: Record<ProfileSection, ProfileSectionVisibility>
    ) => Promise<void>
  ) {}

  private readonly labels = PROFILE_LABELS;

  /**
   * Local mirror of the per-section levels so a switch moves immediately
   * instead of waiting for the round trip through Firestore and back.
   * Seeded from the server, and the server stays the authority.
   */
  private readonly override = signal<Partial<
    Record<ProfileSection, ProfileSectionVisibility>
  > | null>(null);

  readonly isOwner = computed(() => this.profile()?.viewerIsOwner === true);

  readonly levels = computed<
    Partial<Record<ProfileSection, ProfileSectionVisibility>>
  >(() => this.override() ?? this.profile()?.visibility ?? {});

  /** What the owner picked; see {@link mode} for what is in force. */
  readonly previewMode = signal<ProfilePreviewMode>('owner');

  /**
   * A friend can always reach the page — they asked, the owner agreed — so
   * that preview needs no opt-in. A visitor view only exists once the
   * profile is public; offering it earlier would promise a page no visitor
   * can reach.
   */
  readonly canPreviewAsVisitor = computed(
    () => this.isOwner() && this.profile()?.isPrivate === false
  );

  /** The audience actually rendered. Falls back when the opt-in is gone. */
  readonly mode = computed<ProfilePreviewMode>(() => {
    const mode = this.previewMode();
    if (mode === 'public' && !this.canPreviewAsVisitor()) return 'owner';
    return mode;
  });

  /**
   * The switches are only offered while the owner is *not* previewing — a
   * control panel on top of "this is what others see" would make the
   * preview a lie.
   */
  readonly showControls = computed(
    () => this.isOwner() && this.mode() === 'owner'
  );

  readonly previewOptions = computed<ReadonlyArray<PreviewOption>>(() => [
    {
      mode: 'owner',
      label: this.labels.previewOwner,
      icon: 'tune',
      disabled: false,
    },
    {
      mode: 'friend',
      label: this.labels.previewFriend,
      icon: 'group',
      disabled: false,
    },
    {
      mode: 'public',
      label: this.labels.previewPublic,
      icon: 'public',
      disabled: !this.canPreviewAsVisitor(),
    },
  ]);

  /** Says out loud whose view is on screen; empty while editing. */
  readonly previewNote = computed(() => {
    const mode = this.mode();
    if (mode === 'friend') return this.labels.previewNoteFriend;
    return mode === 'public' ? this.labels.previewNotePublic : '';
  });

  /** Who may see this section. Defaults to friends-only, as the model does. */
  levelOf(section: ProfileSection): ProfileSectionVisibility {
    return this.levels()[section] ?? 'friends';
  }

  /** Published to somebody — the cue for dimming an element that is not. */
  isVisible(section: ProfileSection): boolean {
    return this.levelOf(section) !== 'off';
  }

  /**
   * What actually renders.
   *
   * While the switches are on screen every element stays put, even an
   * empty or hidden one — a switch you cannot see is a switch you cannot
   * turn back on. In a preview it is the rule for that audience. For
   * anyone else the server already removed what they may not see, so
   * having something to say is the whole test.
   */
  renders(section: ProfileSection, hasContent: boolean): boolean {
    if (this.showControls()) return true;
    if (!hasContent) return false;
    if (!this.isOwner()) return true;
    return isSectionVisibleTo(this.levelOf(section), this.mode());
  }

  icon(section: ProfileSection): string {
    const level = this.levelOf(section);
    if (level === 'public') return 'public';
    return level === 'friends' ? 'group' : 'visibility_off';
  }

  label(section: ProfileSection): string {
    const level = this.levelOf(section);
    if (level === 'public') return this.labels.visibilityPublic;
    return level === 'friends'
      ? this.labels.visibilityFriends
      : this.labels.visibilityOff;
  }

  nextLabel(section: ProfileSection): string {
    const next = nextSectionVisibility(this.levelOf(section));
    if (next === 'public') return this.labels.visibilityNextPublic;
    return next === 'friends'
      ? this.labels.visibilityNextFriends
      : this.labels.visibilityNextOff;
  }

  /**
   * One tap moves a section to the next audience: public → friends → off →
   * public. A cycle rather than three controls keeps the switch where it
   * is — inline next to the value it governs — and the tooltip names both
   * the current state and what the next tap does.
   */
  async cycle(section: ProfileSection): Promise<void> {
    const next = nextSectionVisibility(this.levelOf(section));
    const levels = withSectionVisibility(this.levels(), section, next);
    this.override.set(levels);
    await this.persist(levels);
  }

  /** The server is the authority again after a reload. */
  clearOverride(): void {
    this.override.set(null);
  }
}
