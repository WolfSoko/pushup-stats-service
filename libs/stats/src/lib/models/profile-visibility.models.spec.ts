import { describe, expect, it } from '@jest/globals';

import {
  canViewProfile,
  isSectionVisibleTo,
  profileVisibilityMap,
  sectionVisibility,
  withSectionVisibility,
} from './profile-visibility.models';

describe('profile-visibility.models', () => {
  describe('sectionVisibility', () => {
    it('should use the explicit level when the user set one', () => {
      // given
      const ui = { profileVisibility: { total: 'friends' } };

      // when / then
      expect(sectionVisibility(ui, 'total')).toBe('friends');
    });

    it('should keep a legacy opt-out switched off', () => {
      // given a config written before levels existed
      const ui = { publicProfile: true, profileHidden: ['heatmap'] };

      // when / then
      expect(sectionVisibility(ui, 'heatmap')).toBe('off');
      expect(sectionVisibility(ui, 'total')).toBe('public');
    });

    it('should default a private legacy profile to friends-only', () => {
      // given — nothing was public before, and friendship is mutual and
      // explicit, so a confirmed friend is an audience the user agreed to
      const ui = { publicProfile: false };

      // when / then
      expect(sectionVisibility(ui, 'total')).toBe('friends');
    });

    it('should ignore a nonsense stored level', () => {
      // given
      const ui = { publicProfile: true, profileVisibility: { total: 'yes' } };

      // when / then
      expect(sectionVisibility(ui, 'total')).toBe('public');
    });

    it('should treat a missing config as a private profile', () => {
      // when / then
      expect(sectionVisibility(undefined, 'total')).toBe('friends');
      expect(sectionVisibility(null, 'streak')).toBe('friends');
    });
  });

  describe('isSectionVisibleTo', () => {
    it('should show the owner everything', () => {
      // when / then
      expect(isSectionVisibleTo('off', 'owner')).toBe(true);
    });

    it('should give a friend the friends and public levels', () => {
      // when / then
      expect(isSectionVisibleTo('friends', 'friend')).toBe(true);
      expect(isSectionVisibleTo('public', 'friend')).toBe(true);
      expect(isSectionVisibleTo('off', 'friend')).toBe(false);
    });

    it('should give the public only the public level', () => {
      // when / then
      expect(isSectionVisibleTo('public', 'public')).toBe(true);
      expect(isSectionVisibleTo('friends', 'public')).toBe(false);
      expect(isSectionVisibleTo('off', 'public')).toBe(false);
    });
  });

  describe('canViewProfile', () => {
    it('should let the owner and a confirmed friend open the page', () => {
      // given a profile that was never made public
      const ui = { publicProfile: false };

      // when / then
      expect(canViewProfile(ui, 'owner')).toBe(true);
      expect(canViewProfile(ui, 'friend')).toBe(true);
      expect(canViewProfile(ui, 'public')).toBe(false);
    });

    it('should keep a public profile public', () => {
      // when / then
      expect(canViewProfile({ publicProfile: true }, 'public')).toBe(true);
    });
  });

  describe('withSectionVisibility', () => {
    it('should set one section and keep the others', () => {
      // given
      const current = { total: 'public', streak: 'off' };

      // when
      const next = withSectionVisibility(current, 'total', 'friends');

      // then
      expect(next.total).toBe('friends');
      expect(next.streak).toBe('off');
    });

    it('should drop ids the catalog no longer knows', () => {
      // given a level left behind by a removed section
      const current = { total: 'public', retired: 'public' };

      // when
      const next = withSectionVisibility(current, 'streak', 'off');

      // then
      expect(Object.keys(next).sort()).toEqual(['streak', 'total']);
    });
  });

  describe('profileVisibilityMap', () => {
    it('should give every section a level', () => {
      // when
      const map = profileVisibilityMap({ publicProfile: true });

      // then
      expect(Object.values(map).every((level) => level === 'public')).toBe(
        true
      );
      expect(Object.keys(map).length).toBeGreaterThan(5);
    });
  });
});
