import { describe, expect, it } from '@jest/globals';
import { REFERRAL_CLAIM_WINDOW_MS } from '@pu-stats/models';

import { claimPlan, claimRejection } from './logic';

const NOW = Date.parse('2026-09-10T12:00:00.000Z');

function inputs(overrides: Partial<Parameters<typeof claimRejection>[0]> = {}) {
  return {
    referrerUid: 'inviter-1',
    uid: 'newcomer-1',
    existing: undefined,
    accountCreatedAtMs: NOW - 60_000,
    nowMs: NOW,
    ...overrides,
  };
}

describe('referral/logic', () => {
  describe('claimRejection', () => {
    it('should let a fresh account claim the link that brought it in', () => {
      // when / then
      expect(claimRejection(inputs())).toBeNull();
    });

    it('should refuse a malformed referrer id before any lookup', () => {
      // when / then
      expect(claimRejection(inputs({ referrerUid: '' }))).toBe('invalid');
      expect(claimRejection(inputs({ referrerUid: 'a/b' }))).toBe('invalid');
      expect(claimRejection(inputs({ referrerUid: 42 }))).toBe('invalid');
      expect(claimRejection(inputs({ referrerUid: undefined }))).toBe(
        'invalid'
      );
    });

    it('should refuse inviting yourself', () => {
      // when / then
      expect(claimRejection(inputs({ referrerUid: 'newcomer-1' }))).toBe(
        'self'
      );
    });

    it('should refuse a second attribution for the same account', () => {
      // given
      const existing = { referredBy: 'someone-else' };

      // when / then
      expect(claimRejection(inputs({ existing }))).toBe('already-claimed');
    });

    it('should still allow a claim for an account that only has a count', () => {
      // given — this user invited others but was never invited themselves
      const existing = { invitedCount: 4 };

      // when / then
      expect(claimRejection(inputs({ existing }))).toBeNull();
    });

    it('should refuse a claim long after signup', () => {
      // given
      const old = NOW - REFERRAL_CLAIM_WINDOW_MS - 1;

      // when / then
      expect(claimRejection(inputs({ accountCreatedAtMs: old }))).toBe(
        'too-late'
      );
    });

    it('should allow the claim when the signup date is unknown', () => {
      // given — Auth metadata missing; refusing would punish the user for it
      // when / then
      expect(claimRejection(inputs({ accountCreatedAtMs: null }))).toBeNull();
    });
  });

  describe('claimPlan', () => {
    it('should attribute the invited account and count the inviter up', () => {
      // when
      const plan = claimPlan({
        referrerUid: 'inviter-1',
        inviterReferral: { invitedCount: 2 },
        inviterEarned: [{ id: 'invites-1', awardedAt: 'x' }],
        nowIso: '2026-09-10T12:00:00.000Z',
      });

      // then
      expect(plan.invitedPatch).toEqual({
        referredBy: 'inviter-1',
        referredAt: '2026-09-10T12:00:00.000Z',
      });
      expect(plan.inviterCount).toBe(3);
      expect(plan.newBadges).toEqual(['invites-3']);
    });

    it('should earn the first badge on the first invite', () => {
      // when
      const plan = claimPlan({
        referrerUid: 'inviter-1',
        inviterReferral: undefined,
        inviterEarned: [],
        nowIso: 'now',
      });

      // then
      expect(plan.inviterCount).toBe(1);
      expect(plan.newBadges).toEqual(['invites-1']);
    });

    it('should not re-award a badge the inviter already holds', () => {
      // when
      const plan = claimPlan({
        referrerUid: 'inviter-1',
        inviterReferral: { invitedCount: 1 },
        inviterEarned: [{ id: 'invites-1', awardedAt: 'x' }],
        nowIso: 'now',
      });

      // then
      expect(plan.inviterCount).toBe(2);
      expect(plan.newBadges).toEqual([]);
    });

    it('should ignore a nonsense stored count rather than trust it', () => {
      // given a hand-edited or legacy value
      const plan = claimPlan({
        referrerUid: 'inviter-1',
        inviterReferral: { invitedCount: Number.NaN },
        inviterEarned: [],
        nowIso: 'now',
      });

      // then
      expect(plan.inviterCount).toBe(1);
    });
  });
});
