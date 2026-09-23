import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { FieldPath } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import {
  validateAdminAccess,
  validateLeaderboardExclusionPayload,
} from './admin';
import { deleteAccountWithData } from './account-deletion/delete-account';
import { liveDeleteAccountDeps } from './account-deletion/live-deps';
import { deleteInactiveAccounts } from './admin/bulk-delete';
import { hasEntrySince, readUserActivity } from './admin/user-data-ops';
import { db, DEMO_USER_ID } from './firebase-app';

export function assertAdmin(request: {
  auth?: { uid: string; token: Record<string, unknown> };
}) {
  const error = validateAdminAccess(request.auth);
  if (error) throw new HttpsError(error.code, error.message);
}

export const adminListUsers = onCall(
  { region: 'europe-west3', timeoutSeconds: 120 },
  async (request) => {
    assertAdmin(request);

    const authUsers: UserRecord[] = [];
    let pageToken: string | undefined;
    do {
      const result = await getAuth().listUsers(1000, pageToken);
      authUsers.push(...result.users);
      pageToken = result.pageToken;
    } while (pageToken);

    const uids = authUsers.map((u) => u.uid);
    const configMap = new Map<string, Record<string, unknown>>();
    for (let i = 0; i < uids.length; i += 10) {
      const batch = uids.slice(i, i + 10);
      const snaps = await db
        .collection('userConfigs')
        .where(FieldPath.documentId(), 'in', batch)
        .get();
      for (const snap of snaps.docs) {
        configMap.set(snap.id, snap.data());
      }
    }

    const activity = await readUserActivity(uids);

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
        entryCount: userActivity?.entryCount ?? 0,
        lastEntry: userActivity?.lastEntry ?? null,
        createdAt: user.metadata.creationTime || null,
        role: user.customClaims?.admin === true ? 'admin' : null,
        androidTest: (config as Record<string, unknown>).androidTest ?? null,
      };
    });
  }
);

export const adminDeleteUser = onCall(
  { region: 'europe-west3', timeoutSeconds: 540, memory: '512MiB' },
  async (request) => {
    assertAdmin(request);

    const uid = String(request.data?.uid || '').trim();

    if (!uid) throw new HttpsError('invalid-argument', 'uid erforderlich.');
    if (uid === DEMO_USER_ID) {
      throw new HttpsError(
        'failed-precondition',
        'Demo-Benutzer kann nicht gelöscht werden.'
      );
    }

    const result = await deleteAccountWithData(liveDeleteAccountDeps(), uid);

    logger.info('adminDeleteUser', { uid, ...result, by: request.auth?.uid });
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

/**
 * Accounts deleted per bulk run. Each deletion purges the user's data, so an
 * unbounded run would outlast the timeout; the admin re-runs until
 * `remaining` is 0.
 */
export const BULK_DELETE_LIMIT = 25;

export const adminBulkDeleteInactiveAnonymous = onCall(
  { region: 'europe-west3', timeoutSeconds: 540, memory: '512MiB' },
  async (request) => {
    assertAdmin(request);

    const inactiveDays = Number(request.data?.inactiveDays ?? 20);
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const anonymousUsers: string[] = [];
    let pageToken: string | undefined;
    do {
      const result = await getAuth().listUsers(1000, pageToken);
      for (const user of result.users) {
        if (user.providerData.length === 0 && user.uid !== DEMO_USER_ID) {
          anonymousUsers.push(user.uid);
        }
      }
      pageToken = result.pageToken;
    } while (pageToken);

    // A user is "active" iff their last entry is on/after the cutoff. Read the
    // precomputed per-user aggregates (O(#anonymous)) instead of scanning the
    // entry history. ISO `lastEntry` sorts lexicographically against the
    // date-only `cutoff`, so the comparison is exact.
    const activity = await readUserActivity(anonymousUsers);

    const { deleted, skipped, remaining } = await deleteInactiveAccounts({
      uids: anonymousUsers,
      limit: BULK_DELETE_LIMIT,
      isActive: async (uid) => {
        const aggregate = activity.get(uid);
        if (aggregate)
          return !!aggregate.lastEntry && aggregate.lastEntry >= cutoff;
        // No aggregate yet (e.g. the post-deploy window before the backfill
        // ran) — fall back to a bounded source check so an active user is
        // never deleted.
        return hasEntrySince(uid, cutoff);
      },
      deleteAccount: (uid) =>
        deleteAccountWithData(liveDeleteAccountDeps(), uid),
    });

    logger.info('adminBulkDeleteInactiveAnonymous', {
      inactiveDays,
      cutoff,
      deleted,
      skipped,
      remaining,
      by: request.auth?.uid,
    });
    return { deleted, skipped, remaining };
  }
);
