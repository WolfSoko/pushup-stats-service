import { describe, it, expect } from '@jest/globals';
import {
  toAnonymousLabel,
  toPublicDisplayName,
  isLeaderboardNameAllowed,
  UserProfile,
} from './logic';

describe('profile/logic', () => {
  describe('toAnonymousLabel', () => {
    it('returns anonymous label', () => {
      expect(toAnonymousLabel()).toBe('anonym');
    });
  });

  describe('toPublicDisplayName', () => {
    it('returns displayName when provided', () => {
      const profile: UserProfile = { displayName: 'Alice' };
      expect(toPublicDisplayName(profile)).toBe('Alice');
    });

    it('returns anonymous when displayName is empty string', () => {
      const profile: UserProfile = { displayName: '' };
      expect(toPublicDisplayName(profile)).toBe('anonym');
    });

    it('returns anonymous when displayName is whitespace only', () => {
      const profile: UserProfile = { displayName: '   ' };
      expect(toPublicDisplayName(profile)).toBe('anonym');
    });

    it('returns anonymous when displayName is undefined', () => {
      const profile: UserProfile = { displayName: undefined };
      expect(toPublicDisplayName(profile)).toBe('anonym');
    });

    it('returns anonymous when profile is undefined', () => {
      expect(toPublicDisplayName(undefined)).toBe('anonym');
    });

    it('returns anonymous when profile is null', () => {
      expect(toPublicDisplayName(null as unknown as UserProfile)).toBe('anonym');
    });

    it('trims whitespace from displayName', () => {
      const profile: UserProfile = { displayName: '  Bob  ' };
      expect(toPublicDisplayName(profile)).toBe('Bob');
    });

    it('preserves displayName with special characters', () => {
      const profile: UserProfile = { displayName: 'Charlie_123-Test' };
      expect(toPublicDisplayName(profile)).toBe('Charlie_123-Test');
    });
  });

  describe('isLeaderboardNameAllowed', () => {
    it('returns true when hideFromLeaderboard is explicitly false', () => {
      const profile: UserProfile = { ui: { hideFromLeaderboard: false } };
      expect(isLeaderboardNameAllowed(profile)).toBe(true);
    });

    it('returns false when hideFromLeaderboard is true', () => {
      const profile: UserProfile = { ui: { hideFromLeaderboard: true } };
      expect(isLeaderboardNameAllowed(profile)).toBe(false);
    });

    it('returns false when hideFromLeaderboard is undefined', () => {
      const profile: UserProfile = { ui: { hideFromLeaderboard: undefined } };
      expect(isLeaderboardNameAllowed(profile)).toBe(false);
    });

    it('returns false when ui is undefined', () => {
      const profile: UserProfile = { ui: undefined };
      expect(isLeaderboardNameAllowed(profile)).toBe(false);
    });

    it('returns false when profile is undefined', () => {
      expect(isLeaderboardNameAllowed(undefined)).toBe(false);
    });

    it('returns false when profile is null', () => {
      expect(isLeaderboardNameAllowed(null as unknown as UserProfile)).toBe(false);
    });

    it('defaults to hidden (privacy-first)', () => {
      // When no explicit opt-in, user is not visible on leaderboard
      const profile: UserProfile = { displayName: 'Hidden User' };
      expect(isLeaderboardNameAllowed(profile)).toBe(false);
    });
  });
});
