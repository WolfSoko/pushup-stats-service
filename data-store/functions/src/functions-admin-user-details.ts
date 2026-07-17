import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import {
  type AdminUserDetails,
  readActivePlan,
  readPublicProfile,
  validateGetUserDetailsPayload,
} from './admin/user-details';
import { readUserActivity } from './admin/user-data-ops';
import { db } from './firebase-app';
import { assertAdmin } from './functions-admin';

// Admin-only fetch of one user's header details for the entries page:
// identity (from Auth + `userConfigs`), activity aggregate, public-profile
// opt-in and the active training plan. Kept separate from `adminListUsers`
// (which pages every user) so the drill-down page can deep-link/reload by uid
// without materialising the whole user list.
export const adminGetUserDetails = onCall(
  { region: 'europe-west3', timeoutSeconds: 60 },
  async (request) => {
    assertAdmin(request);

    const result = validateGetUserDetailsPayload(request.data);
    if (!result.valid) {
      throw new HttpsError('invalid-argument', result.error);
    }
    const { uid } = result;

    let userRecord: admin.auth.UserRecord;
    try {
      userRecord = await admin.auth().getUser(uid);
    } catch (err) {
      if ((err as { code?: string }).code === 'auth/user-not-found') {
        throw new HttpsError('not-found', 'Benutzer nicht gefunden.');
      }
      throw err;
    }

    try {
      const [configSnap, planSnap, activity] = await Promise.all([
        db.collection('userConfigs').doc(uid).get(),
        db.collection('userTrainingPlans').doc(uid).get(),
        readUserActivity([uid]),
      ]);

      const config = configSnap.exists ? (configSnap.data() ?? {}) : {};
      const act = activity.get(uid);

      const details: AdminUserDetails = {
        uid,
        displayName:
          (config.displayName as string) || userRecord.displayName || null,
        email: (config.email as string) || userRecord.email || null,
        anonymous: userRecord.providerData.length === 0,
        role: userRecord.customClaims?.admin === true ? 'admin' : null,
        createdAt: userRecord.metadata.creationTime || null,
        entryCount: act?.entryCount ?? 0,
        lastEntry: act?.lastEntry ?? null,
        publicProfile: readPublicProfile(config),
        activePlan: readActivePlan(planSnap.exists ? planSnap.data() : null),
      };
      return details;
    } catch (err) {
      logger.error('adminGetUserDetails failed', {
        uid,
        error: err instanceof Error ? (err.stack ?? err.message) : String(err),
      });
      throw new HttpsError(
        'internal',
        'Benutzerdetails konnten nicht geladen werden.'
      );
    }
  }
);
