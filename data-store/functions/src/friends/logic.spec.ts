import { describe, expect, it } from '@jest/globals';
import { MAX_FRIENDS } from '@pu-stats/models';

import {
  acceptedFriendUids,
  friendLists,
  requestRejection,
  respondRejection,
  type FriendshipDoc,
} from './logic';

function doc(overrides: Partial<FriendshipDoc> = {}): FriendshipDoc {
  return {
    id: 'a__b',
    users: ['a', 'b'],
    requestedBy: 'a',
    status: 'pending',
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('friends/logic', () => {
  describe('requestRejection', () => {
    it('should allow a first request to a stranger', () => {
      // when / then
      expect(
        requestRejection({
          requester: 'a',
          target: 'b',
          existing: undefined,
          requesterFriendCount: 0,
        })
      ).toBeNull();
    });

    it('should refuse a malformed target or yourself', () => {
      // given
      const base = {
        requester: 'a',
        existing: undefined,
        requesterFriendCount: 0,
      };

      // when / then
      expect(requestRejection({ ...base, target: 'a' })).toBe('self');
      expect(requestRejection({ ...base, target: 'a/b' })).toBe('invalid');
      expect(requestRejection({ ...base, target: '' })).toBe('invalid');
      expect(requestRejection({ ...base, target: 99 })).toBe('invalid');
    });

    it('should refuse asking twice, and asking someone who already asked', () => {
      // given
      const base = { requester: 'a', target: 'b', requesterFriendCount: 0 };

      // when / then
      expect(requestRejection({ ...base, existing: doc() })).toBe('pending');
      expect(
        requestRejection({ ...base, existing: doc({ requestedBy: 'b' }) })
      ).toBe('pending');
    });

    it('should refuse when the two are already friends', () => {
      // when / then
      expect(
        requestRejection({
          requester: 'a',
          target: 'b',
          existing: doc({ status: 'accepted' }),
          requesterFriendCount: 1,
        })
      ).toBe('exists');
    });

    it('should not let a declined request be re-sent', () => {
      // given — "no" has to mean no, or it is a nag button
      const existing = doc({ status: 'declined', requestedBy: 'a' });

      // when / then
      expect(
        requestRejection({
          requester: 'a',
          target: 'b',
          existing,
          requesterFriendCount: 0,
        })
      ).toBe('declined');
    });

    it('should let the person who declined ask on their own initiative', () => {
      // given — b declined a's request; b may still change their mind
      const existing = doc({ status: 'declined', requestedBy: 'a' });

      // when / then
      expect(
        requestRejection({
          requester: 'b',
          target: 'a',
          existing,
          requesterFriendCount: 0,
        })
      ).toBeNull();
    });

    it('should stop at the friend cap', () => {
      // when / then
      expect(
        requestRejection({
          requester: 'a',
          target: 'b',
          existing: undefined,
          requesterFriendCount: MAX_FRIENDS,
        })
      ).toBe('limit');
    });
  });

  describe('friendLists', () => {
    it('should split the records into friends and the two request directions', () => {
      // given
      const docs = [
        doc({
          id: 'a__c',
          users: ['a', 'c'],
          status: 'accepted',
          respondedAt: '2026-09-02T10:00:00.000Z',
        }),
        doc({ id: 'a__d', users: ['a', 'd'], requestedBy: 'd' }),
        doc({ id: 'a__e', users: ['a', 'e'], requestedBy: 'a' }),
      ];

      // when
      const lists = friendLists(docs, 'a');

      // then
      expect(lists.friends.map((f) => f.uid)).toEqual(['c']);
      expect(lists.incoming.map((f) => f.uid)).toEqual(['d']);
      expect(lists.outgoing.map((f) => f.uid)).toEqual(['e']);
    });

    it('should never surface a declined record', () => {
      // given
      const docs = [doc({ status: 'declined', requestedBy: 'b' })];

      // when
      const lists = friendLists(docs, 'a');

      // then — a list of people who said no is not a feature
      expect(lists).toEqual({ friends: [], incoming: [], outgoing: [] });
    });

    it('should put the newest first', () => {
      // given
      const docs = [
        doc({
          id: 'a__c',
          users: ['a', 'c'],
          requestedBy: 'c',
          createdAt: '2026-09-01T00:00:00.000Z',
        }),
        doc({
          id: 'a__d',
          users: ['a', 'd'],
          requestedBy: 'd',
          createdAt: '2026-09-05T00:00:00.000Z',
        }),
      ];

      // when
      const lists = friendLists(docs, 'a');

      // then
      expect(lists.incoming.map((f) => f.uid)).toEqual(['d', 'c']);
    });

    it('should ignore a record the user is not part of', () => {
      // given a hand-written or mis-queried document
      const docs = [doc({ users: ['x', 'y'] })];

      // when / then
      expect(friendLists(docs, 'a').incoming).toEqual([]);
    });
  });

  describe('acceptedFriendUids', () => {
    it('should list only confirmed friends', () => {
      // given
      const docs = [
        doc({ id: 'a__c', users: ['a', 'c'], status: 'accepted' }),
        doc({ id: 'a__d', users: ['a', 'd'] }),
      ];

      // when / then
      expect(acceptedFriendUids(docs, 'a')).toEqual(['c']);
    });
  });

  describe('respondRejection', () => {
    it('should let the invited side answer an open request', () => {
      // when / then
      expect(respondRejection(doc(), 'b')).toBeNull();
    });

    it('should refuse answering your own request', () => {
      // when / then
      expect(respondRejection(doc(), 'a')).toBe('not-yours');
    });

    it('should refuse a stranger and a missing record', () => {
      // when / then
      expect(respondRejection(doc(), 'x')).toBe('not-yours');
      expect(respondRejection(undefined, 'b')).toBe('not-found');
    });

    it('should refuse answering twice', () => {
      // when / then — ending a friendship is removeFriend, not a late decline
      expect(respondRejection(doc({ status: 'accepted' }), 'b')).toBe(
        'settled'
      );
      expect(respondRejection(doc({ status: 'declined' }), 'b')).toBe(
        'settled'
      );
    });
  });
});
