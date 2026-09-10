import { getAuth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  isValidReferrerId,
  type EarnedAchievement,
  type ReferralState,
} from '@pu-stats/models';

import { db, DEMO_USER_ID } from './firebase-app';
import { claimPlan, claimRejection } from './referral';

/**
 * Attributes a signup to the user whose link brought it in.
 *
 * Server-side because the invite count earns public badges: a
 * client-written count would be a badge anyone could mint. The same
 * reason `userAchievements` is Admin-SDK-only.
 *
 * Idempotent per account — the first claim wins, every later one is
 * refused with a reason the client can ignore quietly.
 */
export const claimReferral = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
    }
    const uid = request.auth.uid;
    const referrerUid = request.data?.referrerUid as unknown;

    // An anonymous account is not a user who joined — crediting one would
    // make the invite count farmable with a single tap.
    if (request.auth.token.firebase?.sign_in_provider === 'anonymous') {
      return { ok: false, reason: 'anonymous' as const };
    }

    const configRef = db.collection('userConfigs').doc(uid);
    const existing = (await configRef.get()).data()?.['referral'] as
      ReferralState | undefined;

    const self = await getAuth()
      .getUser(uid)
      .catch(() => null);
    const createdAt = self?.metadata.creationTime
      ? Date.parse(self.metadata.creationTime)
      : NaN;

    const rejection = claimRejection({
      referrerUid,
      uid,
      existing,
      accountCreatedAtMs: Number.isNaN(createdAt) ? null : createdAt,
      nowMs: Date.now(),
    });
    if (rejection) return { ok: false, reason: rejection };

    // Narrowed by `claimRejection`, which refuses an invalid id first.
    const referrer = referrerUid as string;
    if (!isValidReferrerId(referrer) || referrer === DEMO_USER_ID) {
      return { ok: false, reason: 'invalid' as const };
    }
    const inviter = await getAuth()
      .getUser(referrer)
      .catch(() => null);
    if (!inviter) return { ok: false, reason: 'invalid' as const };

    const inviterConfigRef = db.collection('userConfigs').doc(referrer);
    const inviterBadgesRef = db.collection('userAchievements').doc(referrer);
    const nowIso = new Date().toISOString();

    const awarded = await db.runTransaction(async (tx) => {
      const [inviterConfig, inviterBadges] = await Promise.all([
        tx.get(inviterConfigRef),
        tx.get(inviterBadgesRef),
      ]);
      const earned =
        (inviterBadges.data()?.['earned'] as EarnedAchievement[] | undefined) ??
        [];
      const plan = claimPlan({
        referrerUid: referrer,
        inviterReferral: inviterConfig.data()?.['referral'] as
          ReferralState | undefined,
        inviterEarned: earned,
        nowIso,
      });

      tx.set(
        configRef,
        { userId: uid, referral: plan.invitedPatch, updatedAt: nowIso },
        { merge: true }
      );
      // `referral` is a nested map, so the whole map is rewritten rather
      // than merged — see docs/gotchas/firestore.md. Only this callable
      // writes it, and it carries every field forward.
      tx.set(
        inviterConfigRef,
        {
          userId: referrer,
          referral: {
            ...(inviterConfig.data()?.['referral'] as
              ReferralState | undefined),
            invitedCount: plan.inviterCount,
          },
          updatedAt: nowIso,
        },
        { merge: true }
      );
      if (plan.newBadges.length > 0) {
        tx.set(
          inviterBadgesRef,
          {
            userId: referrer,
            earned: [
              ...earned,
              ...plan.newBadges.map((id) => ({ id, awardedAt: nowIso })),
            ],
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }
      return plan;
    });

    logger.info('claimReferral', {
      uid,
      referrer,
      invitedCount: awarded.inviterCount,
      badges: awarded.newBadges,
    });
    return { ok: true, invitedCount: awarded.inviterCount };
  }
);
