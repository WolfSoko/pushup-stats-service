import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import * as functionsV1 from 'firebase-functions/v1';

import {
  collectDataOwnerUids,
  findOrphanUids,
} from './account-deletion/orphans';
import { purgeUserData, type PurgeDeps } from './account-deletion/purge';
import { db, DEMO_USER_ID } from './firebase-app';
import { assertAdmin } from './functions-admin';
import { PHOTO_BUCKET } from './profile/photo-storage';

/** Orphaned accounts purged per admin run; the rest waits for the next run. */
export const ORPHAN_PURGE_LIMIT = 25;

function purgeDeps(): PurgeDeps {
  return {
    db,
    photoBucket: getStorage().bucket(PHOTO_BUCKET),
    nowMs: Date.now(),
  };
}

// Auth `onDelete` only exists as a 1st-gen trigger — 2nd gen has blocking
// triggers for sign-up/sign-in but nothing for deletion. It fires for every
// deletion path at once: self-service in the settings, the admin callables
// and the Firebase console. `failurePolicy` retries a failed purge; the
// purge is idempotent, so a retry finishes what the first run started.
export const purgeUserDataOnAccountDelete = functionsV1
  .region('europe-west3')
  .runWith({ timeoutSeconds: 540, memory: '512MB', failurePolicy: true })
  .auth.user()
  .onDelete(async (user) => {
    if (user.uid === DEMO_USER_ID) return;
    const result = await purgeUserData(purgeDeps(), user.uid);
    logger.info('purgeUserDataOnAccountDelete', { uid: user.uid, ...result });
  });

// Cleans up the data junk of accounts deleted before the purge trigger
// existed (settings used to only anonymize `userConfigs`, the admin
// callables left most collections behind). Runs from the admin migrations
// page with the uniform `{ dryRun }` contract; only an explicit
// `dryRun: false` deletes anything.
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
      const result = await purgeUserData(purgeDeps(), uid);
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
