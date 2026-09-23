import { describe, expect, it } from '@jest/globals';

import { FakeFirestore } from './fake-firestore.testing';
import {
  AUTH_LOOKUP_CHUNK,
  type AuthLookup,
  collectDataOwnerUids,
  findOrphanUids,
} from './orphans';

function authWith(existing: readonly string[]): AuthLookup & {
  calls: number[];
} {
  const calls: number[] = [];
  return {
    calls,
    getUsers: async (identifiers) => {
      calls.push(identifiers.length);
      return {
        notFound: identifiers.filter(({ uid }) => !existing.includes(uid)),
      };
    },
  };
}

describe('collectDataOwnerUids', () => {
  it('should find owners in uid-keyed docs, subcollection-only parents and owned documents', async () => {
    // given data spread over the places a uid can hide
    const fake = new FakeFirestore()
      .seed('userConfigs/config-owner', {})
      .seed('pushSubscriptions/push-owner/subs/s-1', {})
      .seed('notifications/inbox-owner/inbox/n-1', {})
      .seed('exerciseEntries/e-1', { userId: 'entry-owner' })
      .seed('exerciseEntries/e-2', { userId: null })
      .seed('workouts/w-1', { ownerId: 'workout-owner' })
      .seed('friendships/a__b', { users: ['friend-a', 'friend-b'] });

    // when
    const uids = await collectDataOwnerUids(fake.asFirestore());

    // then
    expect(uids).toEqual([
      'config-owner',
      'entry-owner',
      'friend-a',
      'friend-b',
      'inbox-owner',
      'push-owner',
      'workout-owner',
    ]);
  });
});

describe('findOrphanUids', () => {
  it('should report only uids without an auth account', async () => {
    // given
    const auth = authWith(['alive']);

    // when
    const orphans = await findOrphanUids(auth, ['alive', 'gone'], new Set());

    // then
    expect(orphans).toEqual(['gone']);
  });

  it('should never report a kept uid', async () => {
    // given the demo user, whose data has no auth account behind it
    const auth = authWith([]);

    // when
    const orphans = await findOrphanUids(
      auth,
      ['demo', 'gone'],
      new Set(['demo'])
    );

    // then
    expect(orphans).toEqual(['gone']);
  });

  it('should look up at most the auth API limit per call', async () => {
    // given more candidates than one lookup accepts
    const candidates = Array.from(
      { length: AUTH_LOOKUP_CHUNK + 1 },
      (_, i) => `uid-${i}`
    );
    const auth = authWith(candidates);

    // when
    await findOrphanUids(auth, candidates, new Set());

    // then
    expect(auth.calls).toEqual([AUTH_LOOKUP_CHUNK, 1]);
  });
});
