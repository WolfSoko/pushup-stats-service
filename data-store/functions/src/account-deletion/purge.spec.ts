import { describe, expect, it, jest } from '@jest/globals';

import { FakeFirestore } from './fake-firestore.testing';
import { PURGE_PAGE_SIZE, purgeUserData, type PhotoBucket } from './purge';
import { DELETED_ACCOUNTS_COLLECTION } from './tombstone';

const GONE = 'gone-uid';
const FRIEND = 'friend-uid';
const NOW_MS = Date.parse('2026-09-23T10:00:00Z');

function photoBucket(): PhotoBucket & { prefixes: string[] } {
  const prefixes: string[] = [];
  return {
    prefixes,
    deleteFiles: async ({ prefix }) => {
      prefixes.push(prefix);
    },
  };
}

/** One document in every place the deleted user leaves a trace, plus the friend's own data. */
function seededWorld(): FakeFirestore {
  return new FakeFirestore()
    .seed(`userConfigs/${GONE}`, { userId: GONE, displayName: 'Gone' })
    .seed(`userConfigs/${FRIEND}`, { userId: FRIEND, displayName: 'Friend' })
    .seed(`userStats/${GONE}`, { total: 10 })
    .seed(`userStats/${GONE}/perExercise/pushup`, { total: 10 })
    .seed(`userStats/${FRIEND}/perExercise/pushup`, { total: 5 })
    .seed(`userTrainingPlans/${GONE}`, { userId: GONE })
    .seed(`userTrainingPlans/${GONE}/history/plan-a`, { day: 3 })
    .seed(`userAchievements/${GONE}`, { earned: [] })
    .seed(`motivationQuotes/${GONE}__de`, { quotes: [] })
    .seed(`motivationQuotes/${GONE}__en`, { quotes: [] })
    .seed(`motivationQuotes/${FRIEND}__de`, { quotes: [] })
    .seed(`reminderDispatchState/${GONE}`, { lastSentAt: 'x' })
    .seed(`cheerPings/${GONE}`, { from: FRIEND })
    .seed(`pushSubscriptions/${GONE}/subs/sub-1`, { endpoint: 'https://push' })
    .seed(`notifications/${GONE}/inbox/n-1`, { type: 'cheer' })
    .seed(`adminUserActivity/${GONE}`, { entryCount: 2 })
    .seed('exerciseEntries/e-1', { userId: GONE, reps: 10 })
    .seed('exerciseEntries/e-2', { userId: GONE, reps: 12 })
    .seed('exerciseEntries/e-friend', { userId: FRIEND, reps: 5 })
    .seed('deletedExerciseEntries/e-0', { userId: GONE })
    .seed('workouts/w-1', { ownerId: GONE, title: 'Mine' })
    .seed('workouts/w-friend', { ownerId: FRIEND, title: 'Theirs' })
    .seed('workoutReminders/w-1', { ownerId: GONE, workoutId: 'w-1' })
    .seed('workoutReminders/w-friend', {
      ownerId: FRIEND,
      workoutId: 'w-friend',
    })
    .seed(`friendships/${FRIEND}__${GONE}`, { users: [FRIEND, GONE] })
    .seed('friendInvites/token-1', { uid: GONE })
    .seed(`cheers/${GONE}__${FRIEND}__2026-09-01`, { from: GONE, to: FRIEND })
    .seed(`cheers/${FRIEND}__${GONE}__2026-09-02`, { from: FRIEND, to: GONE })
    .seed('challenges/solo', { participants: [GONE], invited: [FRIEND] })
    .seed('challenges/shared', { participants: [FRIEND, GONE], invited: [] })
    .seed('challenges/invited', { participants: [FRIEND], invited: [GONE] })
    .seed('feedback/f-1', {
      userId: GONE,
      email: 'a@b.c',
      name: 'Gone Person',
      text: 'Nice',
    })
    .seed('autoCountFeedback/a-1', { userId: GONE, counted: 9, actual: 10 });
}

describe('purgeUserData', () => {
  it('should leave no document that belongs to the deleted user', async () => {
    // given a user with data in every collection
    const fake = seededWorld();

    // when their data is purged
    await purgeUserData(
      { db: fake.asFirestore(), photoBucket: photoBucket(), nowMs: NOW_MS },
      GONE
    );

    // then only the friend's data, the kept challenges, the anonymized
    // reports and the tombstone remain
    expect(fake.paths()).toEqual([
      'autoCountFeedback/a-1',
      'challenges/invited',
      'challenges/shared',
      `${DELETED_ACCOUNTS_COLLECTION}/${GONE}`,
      'exerciseEntries/e-friend',
      'feedback/f-1',
      `motivationQuotes/${FRIEND}__de`,
      `userConfigs/${FRIEND}`,
      `userStats/${FRIEND}/perExercise/pushup`,
      'workoutReminders/w-friend',
      'workouts/w-friend',
    ]);
  });

  it('should remove the user from shared challenges and keep them for the others', async () => {
    // given challenges the user took part in or was invited to
    const fake = seededWorld();

    // when their data is purged
    const result = await purgeUserData(
      { db: fake.asFirestore(), photoBucket: photoBucket(), nowMs: NOW_MS },
      GONE
    );

    // then the others keep competing without them
    expect(fake.docs.get('challenges/shared')).toEqual({
      participants: [FRIEND],
      invited: [],
    });
    expect(fake.docs.get('challenges/invited')).toEqual({
      participants: [FRIEND],
      invited: [],
    });
    expect(result.updatedChallenges).toBe(3);
  });

  it('should keep sent reports but strip what ties them to the person', async () => {
    // given feedback and an auto-count report sent by the user
    const fake = seededWorld();

    // when their data is purged
    const result = await purgeUserData(
      { db: fake.asFirestore(), photoBucket: photoBucket(), nowMs: NOW_MS },
      GONE
    );

    // then the text stays, the identity goes
    expect(fake.docs.get('feedback/f-1')).toEqual({
      userId: null,
      email: null,
      name: null,
      text: 'Nice',
    });
    expect(fake.docs.get('autoCountFeedback/a-1')).toEqual({
      userId: null,
      counted: 9,
      actual: 10,
    });
    expect(result.anonymizedDocs).toBe(2);
  });

  it('should delete the profile photo folder of the user only', async () => {
    // given a photo bucket
    const bucket = photoBucket();

    // when the user's data is purged
    await purgeUserData(
      { db: seededWorld().asFirestore(), photoBucket: bucket, nowMs: NOW_MS },
      GONE
    );

    // then exactly their folder is removed
    expect(bucket.prefixes).toEqual([`profile-photos/${GONE}/`]);
  });

  it('should write the tombstone before deleting the first entry', async () => {
    // given a fake whose entry deletions record whether the tombstone exists
    const fake = seededWorld();
    const tombstoneSeenAtFirstDelete: boolean[] = [];
    const batch = fake.batch.bind(fake);
    jest.spyOn(fake, 'batch').mockImplementation(() => {
      tombstoneSeenAtFirstDelete.push(
        fake.docs.has(`${DELETED_ACCOUNTS_COLLECTION}/${GONE}`)
      );
      return batch();
    });

    // when the user's data is purged
    await purgeUserData(
      { db: fake.asFirestore(), photoBucket: photoBucket(), nowMs: NOW_MS },
      GONE
    );

    // then the triggers of every deletion could already see the tombstone
    expect(tombstoneSeenAtFirstDelete[0]).toBe(true);
  });

  it('should page through a history larger than one batch', async () => {
    // given more entries than fit in one commit
    const fake = new FakeFirestore();
    const count = PURGE_PAGE_SIZE * 2 + 3;
    for (let i = 0; i < count; i++) {
      fake.seed(`exerciseEntries/e-${String(i).padStart(4, '0')}`, {
        userId: GONE,
      });
    }

    // when the user's data is purged
    const result = await purgeUserData(
      { db: fake.asFirestore(), photoBucket: photoBucket(), nowMs: NOW_MS },
      GONE
    );

    // then every entry is gone
    expect(result.deletedDocs).toBe(count);
    expect(fake.paths()).toEqual([`${DELETED_ACCOUNTS_COLLECTION}/${GONE}`]);
  });

  it('should be a no-op the second time', async () => {
    // given a purge that already ran
    const fake = seededWorld();
    const deps = {
      db: fake.asFirestore(),
      photoBucket: photoBucket(),
      nowMs: NOW_MS,
    };
    await purgeUserData(deps, GONE);
    const afterFirstRun = fake.paths();

    // when it runs again (a retried trigger)
    const result = await purgeUserData(deps, GONE);

    // then nothing else changes
    expect(fake.paths()).toEqual(afterFirstRun);
    expect(result).toEqual({
      deletedDocs: 0,
      anonymizedDocs: 0,
      updatedChallenges: 0,
    });
  });

  it('should refuse an empty uid', async () => {
    // given / when / then
    await expect(
      purgeUserData(
        {
          db: new FakeFirestore().asFirestore(),
          photoBucket: photoBucket(),
          nowMs: NOW_MS,
        },
        ''
      )
    ).rejects.toThrow('uid is required');
  });
});
