import { describe, expect, it } from '@jest/globals';

import {
  friendOf,
  friendshipId,
  friendshipPair,
  isIncomingRequest,
  isOutgoingRequest,
  isValidFriendUid,
  newFriendship,
} from './friendship.models';

describe('friendship.models', () => {
  describe('friendshipId', () => {
    it('should be the same id whichever side asks', () => {
      // when / then — one document per pair, never two competing ones
      expect(friendshipId('bbb', 'aaa')).toBe(friendshipId('aaa', 'bbb'));
      expect(friendshipId('aaa', 'bbb')).toBe('aaa__bbb');
    });

    it('should order the pair deterministically', () => {
      // when / then
      expect(friendshipPair('b', 'a')).toEqual(['a', 'b']);
      expect(friendshipPair('a', 'b')).toEqual(['a', 'b']);
    });
  });

  describe('friendOf', () => {
    it('should name the other participant', () => {
      // when / then
      expect(friendOf({ users: ['a', 'b'] }, 'a')).toBe('b');
      expect(friendOf({ users: ['a', 'b'] }, 'b')).toBe('a');
    });

    it('should report nothing for an outsider or a malformed pair', () => {
      // when / then
      expect(friendOf({ users: ['a', 'b'] }, 'c')).toBeNull();
      expect(friendOf({ users: ['a'] }, 'a')).toBeNull();
    });
  });

  describe('request direction', () => {
    it('should separate the side that asked from the side that answers', () => {
      // given
      const pending = newFriendship('a', 'b', '2026-09-10T10:00:00.000Z');

      // when / then
      expect(isOutgoingRequest(pending, 'a')).toBe(true);
      expect(isIncomingRequest(pending, 'b')).toBe(true);
      expect(isIncomingRequest(pending, 'a')).toBe(false);
      expect(isOutgoingRequest(pending, 'b')).toBe(false);
    });

    it('should report neither direction once the request is settled', () => {
      // given
      const accepted = {
        ...newFriendship('a', 'b', 'x'),
        status: 'accepted' as const,
      };

      // when / then
      expect(isIncomingRequest(accepted, 'b')).toBe(false);
      expect(isOutgoingRequest(accepted, 'a')).toBe(false);
    });
  });

  describe('newFriendship', () => {
    it('should start pending, with the pair sorted and the asker recorded', () => {
      // when
      const friendship = newFriendship('zeta', 'alpha', 'now');

      // then
      expect(friendship).toEqual({
        users: ['alpha', 'zeta'],
        requestedBy: 'zeta',
        status: 'pending',
        createdAt: 'now',
      });
    });
  });

  describe('isValidFriendUid', () => {
    it('should accept auth-shaped uids and refuse anything else', () => {
      // when / then
      expect(isValidFriendUid('9CrETSHzoKcPPw0ctHKM1OiyRrp2')).toBe(true);
      expect(isValidFriendUid('a-b_c')).toBe(true);
      expect(isValidFriendUid('a/b')).toBe(false);
      expect(isValidFriendUid('a.b')).toBe(false);
      expect(isValidFriendUid('')).toBe(false);
      expect(isValidFriendUid(null)).toBe(false);
    });
  });
});
