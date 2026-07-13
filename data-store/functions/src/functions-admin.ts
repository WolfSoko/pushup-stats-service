import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import {
  validateAdminAccess,
  validateLeaderboardExclusionPayload,
  validateSetMigrationStatusPayload,
} from './admin';
import { aggregateEntryActivity } from './admin/user-entry-activity';
import { db, DEMO_USER_ID } from './firebase-app';
import { deleteAllPushSubscriptions } from './functions-push';

export function assertAdmin(request: {
  auth?: { uid: string; token: Record<string, unknown> };
}) {
  const error = validateAdminAccess(request.auth);
  if (error) throw new HttpsError(error.code, error.message);
}

// Hard-delete a user's exercise history. Post-cutover writes land in
// `exerciseEntries`, but the pushup unification migration deliberately
// left the legacy `pushups` source intact — so a full erasure must purge
// both collections, otherwise pre-cutover rows outlive the deleted uid.
// Pages through the results (`limit` + re-query) so a user with a huge
// history never materialises more than one batch of docs at a time.
async function deleteUserExerciseData(uid: string): Promise<void> {
  const BATCH_SIZE = 500;
  for (const collection of ['exerciseEntries', 'pushups']) {
    for (;;) {
      const snap = await db
        .collection(collection)
        .where('userId', '==', uid)
        .limit(BATCH_SIZE)
        .get();
      if (snap.empty) break;
      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      if (snap.size < BATCH_SIZE) break;
    }
  }
}

export const adminListUsers = onCall(
  { region: 'europe-west3', timeoutSeconds: 120 },
  async (request) => {
    assertAdmin(request);

    const authUsers: admin.auth.UserRecord[] = [];
    let pageToken: string | undefined;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      authUsers.push(...result.users);
      pageToken = result.pageToken;
    } while (pageToken);

    const uids = authUsers.map((u) => u.uid);
    const configMap = new Map<string, Record<string, unknown>>();
    for (let i = 0; i < uids.length; i += 10) {
      const batch = uids.slice(i, i + 10);
      const snaps = await db
        .collection('userConfigs')
        .where(admin.firestore.FieldPath.documentId(), 'in', batch)
        .get();
      for (const snap of snaps.docs) {
        configMap.set(snap.id, snap.data());
      }
    }

    const entrySnap = await db
      .collection('exerciseEntries')
      .select('userId', 'timestamp')
      .get();
    const activity = aggregateEntryActivity(
      entrySnap.docs.map((doc) => doc.data())
    );

    return authUsers.map((user) => {
      const config = configMap.get(user.uid) || {};
      const userActivity = activity.get(user.uid);
      return {
        uid: user.uid,
        displayName:
          (config as Record<string, unknown>).displayName ||
          user.displayName ||
          null,
        email: (config as Record<string, unknown>).email || user.email || null,
        anonymous: user.providerData.length === 0,
        entryCount: userActivity?.count ?? 0,
        lastEntry: userActivity?.lastTimestamp ?? null,
        createdAt: user.metadata.creationTime || null,
        role: user.customClaims?.admin === true ? 'admin' : null,
      };
    });
  }
);

export const adminDeleteUser = onCall(
  { region: 'europe-west3', timeoutSeconds: 120 },
  async (request) => {
    assertAdmin(request);

    const uid = String(request.data?.uid || '').trim();
    const anonymize = Boolean(request.data?.anonymize ?? true);

    if (!uid) throw new HttpsError('invalid-argument', 'uid erforderlich.');
    if (uid === DEMO_USER_ID) {
      throw new HttpsError(
        'failed-precondition',
        'Demo-Benutzer kann nicht gelöscht werden.'
      );
    }

    await admin.auth().deleteUser(uid);

    if (anonymize) {
      await db
        .collection('userConfigs')
        .doc(uid)
        .set(
          {
            displayName: 'Gelöschter Benutzer',
            email: null,
            ui: { hideFromLeaderboard: true },
          },
          { merge: true }
        );
    } else {
      await db.collection('userConfigs').doc(uid).delete();
      await deleteUserExerciseData(uid);
    }

    await deleteAllPushSubscriptions(uid);

    logger.info('adminDeleteUser', { uid, anonymize, by: request.auth?.uid });
    return { ok: true };
  }
);

// Admin shadow-ban for the public leaderboard. Sets the top-level
// `leaderboardExcluded` flag on the user's `userConfigs` doc; the
// leaderboard rebuild filters them out at the next run. Reversible —
// passing `excluded: false` removes the ban without touching opt-in
// toggles or pushup history. Clients are blocked from writing this
// field at the Firestore-rule layer.
export const adminSetLeaderboardExclusion = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    assertAdmin(request);

    const result = validateLeaderboardExclusionPayload(request.data);
    if (!result.valid) {
      throw new HttpsError('invalid-argument', result.error);
    }
    const { uid, excluded } = result;

    if (uid === DEMO_USER_ID) {
      throw new HttpsError(
        'failed-precondition',
        'Demo-Benutzer kann nicht gesperrt werden.'
      );
    }

    await db
      .collection('userConfigs')
      .doc(uid)
      .set({ leaderboardExcluded: excluded }, { merge: true });

    logger.info('adminSetLeaderboardExclusion', {
      uid,
      excluded,
      by: request.auth?.uid,
    });
    return { ok: true, uid, excluded };
  }
);

export const adminBulkDeleteInactiveAnonymous = onCall(
  { region: 'europe-west3', timeoutSeconds: 300 },
  async (request) => {
    assertAdmin(request);

    const inactiveDays = Number(request.data?.inactiveDays ?? 20);
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const anonymousUsers: string[] = [];
    let pageToken: string | undefined;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      for (const user of result.users) {
        if (user.providerData.length === 0 && user.uid !== DEMO_USER_ID) {
          anonymousUsers.push(user.uid);
        }
      }
      pageToken = result.pageToken;
    } while (pageToken);

    const anonymousUserSet = new Set(anonymousUsers);
    let activity = aggregateEntryActivity([]);
    if (anonymousUsers.length > 0) {
      const entrySnap = await db
        .collection('exerciseEntries')
        .select('userId', 'timestamp')
        .get();
      // ISO timestamps sort lexicographically, so the raw `lastTimestamp`
      // compares correctly against the date-only `cutoff` below.
      activity = aggregateEntryActivity(
        entrySnap.docs.map((doc) => doc.data()),
        anonymousUserSet
      );
    }

    let deleted = 0;
    let skipped = 0;

    for (const uid of anonymousUsers) {
      const lastTs = activity.get(uid)?.lastTimestamp;
      if (lastTs && lastTs >= cutoff) {
        skipped++;
        continue;
      }

      await admin.auth().deleteUser(uid);
      await db.collection('userConfigs').doc(uid).delete();
      await deleteUserExerciseData(uid);

      await deleteAllPushSubscriptions(uid);
      deleted++;
    }

    logger.info('adminBulkDeleteInactiveAnonymous', {
      inactiveDays,
      cutoff,
      deleted,
      skipped,
      by: request.auth?.uid,
    });
    return { deleted, skipped };
  }
);

const MIGRATION_STATUS_COLLECTION = 'migrationStatus';

export const getMigrationStatuses = onCall(
  { region: 'europe-west3' },
  async (request) => {
    assertAdmin(request);
    const snap = await db.collection(MIGRATION_STATUS_COLLECTION).get();
    const statuses: Record<
      string,
      { completed: boolean; completedAt: string | null; completedBy: string }
    > = {};
    for (const doc of snap.docs) {
      const data = doc.data();
      statuses[doc.id] = {
        completed: Boolean(data.completed),
        completedAt: (data.completedAt as string | null) ?? null,
        completedBy: (data.completedBy as string) ?? '',
      };
    }
    return { statuses };
  }
);

export const setMigrationStatus = onCall(
  { region: 'europe-west3' },
  async (request) => {
    assertAdmin(request);

    const validation = validateSetMigrationStatusPayload(request.data);
    if (!validation.valid || !validation.id) {
      throw new HttpsError('invalid-argument', validation.error ?? 'invalid');
    }

    const nowIso = new Date().toISOString();
    const completed = validation.completed === true;
    const doc = {
      completed,
      completedAt: completed ? nowIso : null,
      completedBy: completed ? (request.auth?.uid ?? '') : '',
    };
    await db
      .collection(MIGRATION_STATUS_COLLECTION)
      .doc(validation.id)
      .set(doc);

    logger.info('setMigrationStatus', {
      id: validation.id,
      completed,
      by: request.auth?.uid,
    });
    return { id: validation.id, ...doc };
  }
);
