import { describe, expect, it } from '@jest/globals';

import {
  deriveInviteAchievements,
  findAchievementDefinition,
  inviteAchievementId,
} from './achievement.models';
import {
  invitedCount,
  isValidReferrerId,
  REFERRAL_CLAIM_WINDOW_MS,
  referralRejection,
} from './referral.models';

const NOW = Date.parse('2026-09-10T12:00:00.000Z');

describe('referral.models', () => {
  describe('isValidReferrerId', () => {
    it('should accept a plausible auth uid', () => {
      // when / then
      expect(isValidReferrerId('9CrETSHzoKcPPw0ctHKM1OiyRrp2')).toBe(true);
    });

    it('should reject anything that never identified a user', () => {
      // when / then — a slash would address a different document path
      expect(isValidReferrerId('')).toBe(false);
      expect(isValidReferrerId('users/abc')).toBe(false);
      expect(isValidReferrerId(' abc')).toBe(false);
      expect(isValidReferrerId('a'.repeat(129))).toBe(false);
      expect(isValidReferrerId(null)).toBe(false);
      expect(isValidReferrerId(7)).toBe(false);
    });
  });

  describe('referralRejection', () => {
    it('should allow a fresh, foreign, unclaimed invitation', () => {
      // when / then
      expect(
        referralRejection({
          referrerUid: 'inviter',
          uid: 'newcomer',
          existing: undefined,
          accountCreatedAtMs: NOW,
          nowMs: NOW,
        })
      ).toBeNull();
    });

    it('should name the reason it refuses', () => {
      // given
      const base = {
        uid: 'newcomer',
        existing: undefined,
        accountCreatedAtMs: NOW,
        nowMs: NOW,
      };

      // when / then
      expect(referralRejection({ ...base, referrerUid: 'newcomer' })).toBe(
        'self'
      );
      expect(referralRejection({ ...base, referrerUid: '' })).toBe('invalid');
      expect(
        referralRejection({
          ...base,
          referrerUid: 'inviter',
          existing: { referredBy: 'other' },
        })
      ).toBe('already-claimed');
      expect(
        referralRejection({
          ...base,
          referrerUid: 'inviter',
          accountCreatedAtMs: NOW - REFERRAL_CLAIM_WINDOW_MS - 1,
        })
      ).toBe('too-late');
    });
  });

  describe('invitedCount', () => {
    it('should read the stored count and default to none', () => {
      // when / then
      expect(invitedCount({ invitedCount: 3 })).toBe(3);
      expect(invitedCount({})).toBe(0);
      expect(invitedCount(undefined)).toBe(0);
      expect(invitedCount(null)).toBe(0);
      expect(invitedCount({ invitedCount: -2 })).toBe(0);
      expect(invitedCount({ invitedCount: 2.7 })).toBe(2);
    });
  });

  describe('invite achievements', () => {
    it('should unlock the milestones the count has passed', () => {
      // when / then
      expect(deriveInviteAchievements(0)).toEqual([]);
      expect(deriveInviteAchievements(1)).toEqual(['invites-1']);
      expect(deriveInviteAchievements(4)).toEqual(['invites-1', 'invites-3']);
      expect(deriveInviteAchievements(10)).toEqual([
        'invites-1',
        'invites-3',
        'invites-10',
      ]);
    });

    it('should resolve an invite badge id back to its definition', () => {
      // when
      const definition = findAchievementDefinition(inviteAchievementId(3));

      // then
      expect(definition).toMatchObject({ kind: 'invites', threshold: 3 });
    });

    it('should still resolve plan badges and refuse unknown ids', () => {
      // when / then
      expect(findAchievementDefinition('plan-days-10')).toMatchObject({
        kind: 'plan-days',
      });
      expect(findAchievementDefinition('invites-7')).toBeNull();
      expect(findAchievementDefinition('nonsense')).toBeNull();
    });
  });
});
