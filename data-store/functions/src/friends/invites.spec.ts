import {
  FRIEND_INVITE_TTL_MS,
  inviteExpiryMs,
  inviteTokenRejection,
  isValidInviteToken,
} from './invites';

describe('friends/invites', () => {
  const NOW = Date.parse('2026-09-18T12:00:00.000Z');

  describe('isValidInviteToken', () => {
    it('should accept a minted token', () => {
      // given — 32 base64url characters, as randomBytes(24) produces
      const token = 'Ab3-_ZzQ19xKpLmNoPqRsTuVwXyZ0123';

      // when / then
      expect(isValidInviteToken(token)).toBe(true);
    });

    it('should refuse anything that could address a different document', () => {
      // given — the token goes straight into a document path
      // when / then
      expect(isValidInviteToken('has/slash-aaaaaaaaaaaaaaaaa')).toBe(false);
      expect(isValidInviteToken('..')).toBe(false);
      expect(isValidInviteToken('')).toBe(false);
      expect(isValidInviteToken('tooshort')).toBe(false);
      expect(isValidInviteToken('x'.repeat(129))).toBe(false);
      expect(isValidInviteToken(42)).toBe(false);
      expect(isValidInviteToken(null)).toBe(false);
      expect(isValidInviteToken(undefined)).toBe(false);
    });
  });

  describe('inviteTokenRejection', () => {
    it('should redeem a token that is still live', () => {
      // when / then
      expect(
        inviteTokenRejection({
          record: { uid: 'inviter-1', expiresAtMs: NOW + 1000 },
          nowMs: NOW,
        })
      ).toBeNull();
    });

    it('should refuse a token nobody minted', () => {
      // given — an unknown token must not be distinguishable from a
      // malformed one by anything the caller can see
      // when / then
      expect(inviteTokenRejection({ record: undefined, nowMs: NOW })).toBe(
        'invalid'
      );
      expect(
        inviteTokenRejection({
          record: { uid: '', expiresAtMs: NOW + 1000 },
          nowMs: NOW,
        })
      ).toBe('invalid');
    });

    it('should stop working on time rather than when the TTL policy gets round to it', () => {
      // given — the policy deletes lazily; a credential may not outlive
      // its expiry just because the sweeper is behind
      // when / then
      expect(
        inviteTokenRejection({
          record: { uid: 'inviter-1', expiresAtMs: NOW },
          nowMs: NOW,
        })
      ).toBe('expired');
      expect(
        inviteTokenRejection({
          record: { uid: 'inviter-1', expiresAtMs: NOW - 1 },
          nowMs: NOW,
        })
      ).toBe('expired');
    });

    it('should treat a record without a usable expiry as expired', () => {
      // given — a half-written document must fail closed
      // when / then
      expect(
        inviteTokenRejection({
          record: { uid: 'inviter-1', expiresAtMs: Number.NaN },
          nowMs: NOW,
        })
      ).toBe('expired');
    });
  });

  describe('inviteExpiryMs', () => {
    it('should put the expiry one TTL ahead', () => {
      // when / then
      expect(inviteExpiryMs(NOW)).toBe(NOW + FRIEND_INVITE_TTL_MS);
    });
  });
});
