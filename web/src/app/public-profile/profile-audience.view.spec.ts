import { signal } from '@angular/core';
import type {
  ProfileSection,
  ProfileSectionVisibility,
  PublicProfile,
} from '@pu-stats/models';

import { ProfileAudienceView } from './profile-audience.view';

const sample: PublicProfile = {
  uid: 'abcdef1234567890',
  displayName: 'Wolfi',
  total: 5000,
  totalEntries: 200,
  totalDays: 90,
  currentStreak: 14,
  bestSingleEntry: 50,
  bestDayTotal: 250,
  achievements: [],
  photoURL: null,
  memberSince: null,
  weeklyReps: 0,
  monthlyReps: 0,
  heatmap: {},
  exercises: [],
  isPrivate: false,
  viewerIsOwner: false,
  hidden: [],
  visibility: {},
  viewerIsFriend: false,
  updatedAt: '2026-04-29T08:30:00.000Z',
};

describe('ProfileAudienceView', () => {
  function setup(over: Partial<PublicProfile> = {}) {
    const profile = signal<PublicProfile | null>({ ...sample, ...over });
    const saved: Array<Record<string, string>> = [];
    const view = new ProfileAudienceView(profile, async (levels) => {
      saved.push({ ...levels });
    });
    return { view, profile, saved };
  }

  function owner(
    visibility: Partial<Record<ProfileSection, ProfileSectionVisibility>> = {},
    over: Partial<PublicProfile> = {}
  ) {
    return setup({ viewerIsOwner: true, visibility, ...over });
  }

  describe('Choosing an audience to preview', () => {
    it('should offer the friends view even while the profile is private', async () => {
      // given — a friend reaches the page through the friendship, not
      // through the public opt-in
      const { view } = owner({}, { isPrivate: true });

      // then
      const friend = view
        .previewOptions()
        .find((option) => option.mode === 'friend');
      expect(friend?.disabled).toBe(false);
    });

    it('should lock the visitor view while the profile is private', async () => {
      // given — there is no visitor view to show yet
      const { view } = owner({}, { isPrivate: true });

      // then
      const visitor = view
        .previewOptions()
        .find((option) => option.mode === 'public');
      expect(visitor?.disabled).toBe(true);
    });

    it('should unlock the visitor view once the profile is public', async () => {
      // given
      const { view } = owner({}, { isPrivate: false });

      // then
      expect(view.canPreviewAsVisitor()).toBe(true);
    });

    it('should fall back to editing when the visitor view is taken away', async () => {
      // given the owner is previewing as a visitor
      const { view, profile } = owner({}, { isPrivate: false });
      view.previewMode.set('public');

      // when the profile goes private again
      profile.set({ ...sample, viewerIsOwner: true, isPrivate: true });

      // then — previewing a page nobody can reach would be a lie
      expect(view.mode()).toBe('owner');
      expect(view.showControls()).toBe(true);
    });

    it('should hide the switches while previewing', async () => {
      // given
      const { view } = owner();

      // when
      view.previewMode.set('friend');

      // then — a control panel on top of "this is what friends see" would
      // make the preview a lie
      expect(view.showControls()).toBe(false);
    });

    it('should say whose view is on screen', async () => {
      // given
      const { view } = owner();

      // when
      view.previewMode.set('friend');

      // then
      expect(view.previewNote()).toContain('Freunde');

      // when
      view.previewMode.set('public');

      // then
      expect(view.previewNote()).not.toContain('Freunde');
    });

    it('should say nothing extra while editing', async () => {
      // given
      const { view } = owner();

      // then
      expect(view.previewNote()).toBe('');
    });
  });

  describe('What renders in each audience', () => {
    it('should keep every element on screen while editing', async () => {
      // given — a switch you cannot see is a switch you cannot turn on
      const { view } = owner({ streak: 'off' });

      // then
      expect(view.renders('streak', false)).toBe(true);
    });

    it('should show a friends-only element in the friends view', async () => {
      // given
      const { view } = owner({ streak: 'friends' });

      // when
      view.previewMode.set('friend');

      // then
      expect(view.renders('streak', true)).toBe(true);
    });

    it('should drop a friends-only element from the visitor view', async () => {
      // given — this is the difference the two previews exist to show
      const { view } = owner({ streak: 'friends' });

      // when
      view.previewMode.set('public');

      // then
      expect(view.renders('streak', true)).toBe(false);
    });

    it('should keep a public element in both previews', async () => {
      // given
      const { view } = owner({ streak: 'public' });

      // when
      view.previewMode.set('friend');

      // then
      expect(view.renders('streak', true)).toBe(true);

      // when
      view.previewMode.set('public');

      // then
      expect(view.renders('streak', true)).toBe(true);
    });

    it('should drop a switched-off element from every preview', async () => {
      // given
      const { view } = owner({ streak: 'off' });

      // then
      for (const mode of ['friend', 'public'] as const) {
        view.previewMode.set(mode);
        expect(view.renders('streak', true)).toBe(false);
      }
    });

    it('should drop an empty element from a preview', async () => {
      // given — an element with nothing to say is not shown to anybody
      const { view } = owner({ streak: 'public' });

      // when
      view.previewMode.set('public');

      // then
      expect(view.renders('streak', false)).toBe(false);
    });

    it('should leave the filtering to the server for everyone else', async () => {
      // given a visitor: the projection they received never contained the
      // values they may not see, and it carries no levels to filter by
      const { view } = setup();

      // then
      expect(view.renders('streak', true)).toBe(true);
      expect(view.renders('streak', false)).toBe(false);
    });
  });

  describe('Moving one element to the next audience', () => {
    it('should persist the narrowed level', async () => {
      // given
      const { view, saved } = owner({ streak: 'public' });

      // when
      await view.cycle('streak');

      // then
      expect(saved.at(-1)?.['streak']).toBe('friends');
    });

    it('should move the switch before the round trip finishes', async () => {
      // given
      const { view } = owner({ streak: 'public' });

      // when
      const pending = view.cycle('streak');

      // then
      expect(view.levelOf('streak')).toBe('friends');
      await pending;
    });

    it('should hand the server back the authority after a reload', async () => {
      // given a local mirror from a switch that was tapped
      const { view } = owner({ streak: 'public' });
      await view.cycle('streak');

      // when
      view.clearOverride();

      // then
      expect(view.levelOf('streak')).toBe('public');
    });
  });
});
