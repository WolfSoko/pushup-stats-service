import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { adminApp, E2E_EMAIL_DOMAIN, RUN_ID } from './backend';

/** How long an account from some earlier run may linger before it is swept. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Documents keyed by the uid itself, and the subcollections hanging off
 * them. Everything else this suite produces is found by query below.
 */
const DOCS_BY_UID = [
  'userConfigs',
  'userStats',
  'userAchievements',
  'userTrainingPlans',
  'adminUserActivity',
] as const;

/** Collections carrying a plain `userId` field. */
const COLLECTIONS_BY_USER_ID = [
  'exerciseEntries',
  'deletedExerciseEntries',
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

  for (const user of mine) {
    await deleteUserData(user.uid);
  }
  await getAuth(adminApp()).deleteUsers(mine.map((user) => user.uid));
  console.log(`[cleanup] removed ${mine.length} test account(s) from staging`);
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

async function deleteUserData(uid: string): Promise<void> {
  const db = getFirestore(adminApp());

  for (const collection of DOCS_BY_UID) {
    await db.recursiveDelete(db.doc(`${collection}/${uid}`));
  }

  for (const collection of COLLECTIONS_BY_USER_ID) {
    await deleteQuery(collection, 'userId', uid);
  }

  // A friendship belongs to both sides, so it is found through the
  // participant array rather than by id.
  const friendships = await db
    .collection('friendships')
    .where('users', 'array-contains', uid)
    .get();
  await Promise.all(friendships.docs.map((doc) => doc.ref.delete()));

  const invites = await db
    .collection('friendInvites')
    .where('uid', '==', uid)
    .get();
  await Promise.all(invites.docs.map((doc) => doc.ref.delete()));
}

async function deleteQuery(
  collection: string,
  field: string,
  value: string
): Promise<void> {
  const db = getFirestore(adminApp());
  const snapshot = await db
    .collection(collection)
    .where(field, '==', value)
    .get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
}
