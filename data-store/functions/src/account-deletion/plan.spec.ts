import { describe, expect, it } from '@jest/globals';

import {
  challengeWithoutUser,
  UID_KEYED_COLLECTIONS,
  uidOfPrefixedId,
} from './plan';

describe('challengeWithoutUser', () => {
  it('should leave a challenge alone the user has nothing to do with', () => {
    // given / when
    const removal = challengeWithoutUser(
      { participants: ['a', 'b'], invited: ['c'] },
      'x'
    );

    // then
    expect(removal).toEqual({ kind: 'none' });
  });

  it('should delete a challenge only the user was part of', () => {
    // given / when
    const removal = challengeWithoutUser(
      { participants: ['x'], invited: ['a'] },
      'x'
    );

    // then
    expect(removal).toEqual({ kind: 'delete' });
  });

  it('should drop the user from participants and invitees', () => {
    // given / when
    const removal = challengeWithoutUser(
      { participants: ['a', 'x'], invited: ['x', 'b'] },
      'x'
    );

    // then
    expect(removal).toEqual({
      kind: 'update',
      participants: ['a'],
      invited: ['b'],
    });
  });

  it('should treat a document without an invited list as no invitees', () => {
    // given a challenge written before invitations existed
    // when
    const removal = challengeWithoutUser({ participants: ['a', 'x'] }, 'x');

    // then
    expect(removal).toEqual({
      kind: 'update',
      participants: ['a'],
      invited: [],
    });
  });
});

describe('UID_KEYED_COLLECTIONS', () => {
  it('should delete the trigger-written aggregates last', () => {
    // given the purge order
    // when the last three collections are read
    const last = UID_KEYED_COLLECTIONS.slice(-3);

    // then they are the ones the entry triggers write
    expect(last).toEqual(['userStats', 'userXp', 'adminUserActivity']);
  });
});

describe('uidOfPrefixedId', () => {
  it('should read the uid from a `{uid}__{suffix}` document id', () => {
    // given / when / then
    expect(uidOfPrefixedId('abc123__de')).toBe('abc123');
  });
});
