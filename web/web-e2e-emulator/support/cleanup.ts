import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { adminApp, E2E_EMAIL_DOMAIN, RUN_ID } from './backend';

/** How long an account from some earlier run may linger before it is swept. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** `deleteUsers` takes at most this many uids per call. */
const DELETE_USERS_BATCH = 1000;

/** How long the entry triggers get to run before the derived docs go. */
const TRIGGER_SETTLE_MS = 5_000;

/** How often the derived docs are re-swept before giving up on them. */
const SETTLE_ROUNDS = 4;

/**
 * Collections whose documents make a Cloud Function write somewhere
 * else. They go first, so the writes those triggers cause land on
 * documents that are still there to be deleted afterwards.
 */
const TRIGGER_SOURCES = [
  { collection: 'exerciseEntries', by: 'query' },
  { collection: 'userTrainingPlans', by: 'uid' },
] as const;

/**
 * Written by the entry and plan triggers, never by the browser. They
 * are deleted repeatedly until a round finds nothing left, because a
 * trigger that is still in flight puts them back.
 */
const DERIVED = [
  { collection: 'deletedExerciseEntries', by: 'query' },
  { collection: 'userStats', by: 'uid' },
  { collection: 'adminUserActivity', by: 'uid' },
  { collection: 'userAchievements', by: 'uid' },
] as const;

/** Plain state, deleted last — nothing writes these on a delete. */
const OWN_STATE = [
  { collection: 'userConfigs', by: 'uid' },
  { collection: 'friendInvites', by: 'query', field: 'uid' },
] as const;

/**
 * Removes everything this run created on a real Firebase project.
 *
 * Against the emulators this is pointless — the whole instance is thrown
 * away with the run — but staging is a real, shared project: without
 * this, every run would leave accounts, entries and friendships behind,
 * and the leaderboard and public profiles there would slowly fill with
 * test users.
 *
 * Accounts are matched on the run id stamped into their address, so two
 * pull requests running the suite at the same time cannot delete each
 * other's data mid-test. Anything older than a day is swept too, which
 * is what recovers the residue of a run that crashed before teardown.
 */
export async function cleanupStagingData(): Promise<void> {
  const accounts = await e2eAccounts();
  const staleBefore = Date.now() - STALE_AFTER_MS;
  const mine = accounts.filter(
    (user) =>
      user.email?.includes(`-${RUN_ID}-`) ||
      Date.parse(user.metadata.creationTime) < staleBefore
  );
  if (mine.length === 0) return;

  const uids = mine.map((user) => user.uid);
  for (const uid of uids) {
    await deleteTriggerSources(uid);
  }
  await sweepDerived(uids);
  for (const uid of uids) {
    await deleteOwnState(uid);
  }
  await deleteAccounts(uids);
  console.log(`[cleanup] removed ${uids.length} test account(s) from staging`);
}

/** Every Auth account on the synthetic address domain this suite uses. */
async function e2eAccounts(): Promise<UserRecord[]> {
  const auth = getAuth(adminApp());
  const found: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    found.push(
      ...page.users.filter((user) =>
        user.email?.endsWith(`@${E2E_EMAIL_DOMAIN}`)
      )
    );
    pageToken = page.pageToken;
  } while (pageToken);
  return found;
}

/**
 * Deletes the documents whose removal fans out into triggers:
 * `archiveDeletedExerciseEntry`, `updateExerciseStatsOnEntryWrite`,
 * `updateAdminUserActivityOnEntryWrite`,
 * `refreshExerciseLeaderboardsOnEntryWrite` and
 * `awardAchievementsOnPlanWrite`. Dropping the entries also takes the
 * user off the leaderboards, which are shared documents this suite must
 * not delete.
 */
async function deleteTriggerSources(uid: string): Promise<void> {
  const db = getFirestore(adminApp());
  await deleteGroup(uid, TRIGGER_SOURCES);

  // A friendship belongs to both sides, so it is found through the
  // participant array rather than by id.
  const friendships = await db
    .collection('friendships')
    .where('users', 'array-contains', uid)
    .get();
  await Promise.all(friendships.docs.map((doc) => doc.ref.delete()));
}

/**
 * Deletes what the triggers wrote, waits, and looks again — a trigger
 * fired by the deletions above may still be running and would otherwise
 * recreate the document a moment after it was removed, leaving an
 * orphan nothing ever cleans up.
 */
async function sweepDerived(uids: readonly string[]): Promise<void> {
  for (let round = 0; round < SETTLE_ROUNDS; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, TRIGGER_SETTLE_MS));
    let deleted = 0;
    for (const uid of uids) {
      deleted += await deleteGroup(uid, DERIVED);
    }
    if (deleted === 0) return;
  }
}

async function deleteOwnState(uid: string): Promise<void> {
  await deleteGroup(uid, OWN_STATE);
}

/** Auth caps a single `deleteUsers` call at 1000 uids. */
async function deleteAccounts(uids: readonly string[]): Promise<void> {
  const auth = getAuth(adminApp());
  for (let start = 0; start < uids.length; start += DELETE_USERS_BATCH) {
    await auth.deleteUsers(uids.slice(start, start + DELETE_USERS_BATCH));
  }
}

interface Group {
  readonly collection: string;
  readonly by: 'uid' | 'query';
  readonly field?: string;
}

/** Deletes one user's documents in `groups`, returning how many went. */
async function deleteGroup(
  uid: string,
  groups: readonly Group[]
): Promise<number> {
  const db = getFirestore(adminApp());
  let deleted = 0;
  for (const group of groups) {
    if (group.by === 'uid') {
      const ref = db.doc(`${group.collection}/${uid}`);
      const exists = (await ref.get()).exists;
      await db.recursiveDelete(ref);
      if (exists) deleted += 1;
      continue;
    }
    const snapshot = await db
      .collection(group.collection)
      .where(group.field ?? 'userId', '==', uid)
      .get();
    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
    deleted += snapshot.size;
  }
  return deleted;
}
