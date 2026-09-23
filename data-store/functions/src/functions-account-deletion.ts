import { getAuth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import {
  deleteAccountWithData,
  mayDeleteOwnAccount,
} from './account-deletion/delete-account';
import { liveDeleteAccountDeps } from './account-deletion/live-deps';
import {
  collectDataOwnerUids,
  findOrphanUids,
} from './account-deletion/orphans';
import { purgeUserData } from './account-deletion/purge';
import { requireUid } from './callable-auth';
import { db, DEMO_USER_ID } from './firebase-app';
import { assertAdmin } from './functions-admin';

/** Orphaned accounts purged per admin run; the rest waits for the next run. */
export const ORPHAN_PURGE_LIMIT = 25;

// Self-service deletion from the settings page. A callable rather than an
// Auth `onDelete` trigger: that trigger exists only in 1st gen, and 1st gen
// does not run the Node 24 runtime this codebase deploys with.
export const deleteOwnAccount = onCall(
  { region: 'europe-west3', timeoutSeconds: 540, memory: '512MiB' },
  async (request) => {
    const uid = requireUid(request.auth);
    if (uid === DEMO_USER_ID) {
      throw new HttpsError(
        'failed-precondition',
        'Demo-Benutzer kann nicht gelöscht werden.'
      );
    }
    // The message carries the Firebase Auth code so the client maps it to
    // the same "please sign in again" hint a client-side deletion shows.
    if (!mayDeleteOwnAccount(request.auth?.token ?? {}, Date.now())) {
      throw new HttpsError('failed-precondition', 'auth/requires-recent-login');
    }

    const result = await deleteAccountWithData(liveDeleteAccountDeps(), uid);
    logger.info('deleteOwnAccount', { uid, ...result });
    return { ok: true };
  }
);

// Cleans up the data junk of accounts deleted without a purge: before it
// existed (settings used to only anonymize `userConfigs`, the admin
// callables left most collections behind) or through the Firebase console.
// Runs from the admin migrations page with the uniform `{ dryRun }`
// contract; only an explicit `dryRun: false` deletes anything.
export const cleanupOrphanedUserData = onCall(
  { region: 'europe-west3', timeoutSeconds: 540, memory: '512MiB' },
  async (request) => {
    assertAdmin(request);
    const dryRun = request.data?.dryRun !== false;

    const candidates = await collectDataOwnerUids(db);
    const orphans = await findOrphanUids(
      getAuth(),
      candidates,
      new Set([DEMO_USER_ID])
    );

    if (dryRun) {
      return {
        dryRun: true,
        checkedUsers: candidates.length,
        orphans: orphans.length,
      };
    }

    const batch = orphans.slice(0, ORPHAN_PURGE_LIMIT);
    let deletedDocs = 0;
    for (const uid of batch) {
      const result = await purgeUserData(liveDeleteAccountDeps(), uid);
      deletedDocs += result.deletedDocs;
    }

    logger.info('cleanupOrphanedUserData', {
      purgedUsers: batch.length,
      deletedDocs,
      by: request.auth?.uid,
    });
    return {
      dryRun: false,
      purgedUsers: batch.length,
      deletedDocs,
      remaining: orphans.length - batch.length,
    };
  }
);
