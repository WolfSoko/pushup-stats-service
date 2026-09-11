import {
  deriveInviteAchievements,
  invitedCount,
  referralRejection,
  type AchievementId,
  type EarnedAchievement,
  type ReferralRejection,
  type ReferralState,
} from '@pu-stats/models';

/**
 * Pure side of attributing an invitation: what to refuse, what the new
 * counts are, and which badges that earns. The Firestore reads, the
 * transaction and the Auth lookup live in `functions-referral.ts`.
 */

export interface ClaimInputs {
  readonly referrerUid: unknown;
  readonly uid: string;
  /** The claiming account's own referral state, if it has one. */
  readonly existing: ReferralState | undefined;
  /** From Firebase Auth metadata; `null` when unavailable. */
  readonly accountCreatedAtMs: number | null;
  readonly nowMs: number;
}

export interface ClaimPlan {
  /** Patch for the invited user's config. */
  readonly invitedPatch: Required<
    Pick<ReferralState, 'referredBy' | 'referredAt'>
  >;
  /** The inviter's new total, for the badge derivation. */
  readonly inviterCount: number;
  /** Invite badges the inviter does not hold yet. */
  readonly newBadges: ReadonlyArray<AchievementId>;
}

/**
 * Why this claim must be refused, or `null` when it may proceed.
 * Mirrors the model's rules; kept as a named wrapper so the callable
 * reads as "decide, then act".
 */
export function claimRejection(inputs: ClaimInputs): ReferralRejection | null {
  return referralRejection({
    referrerUid: inputs.referrerUid,
    uid: inputs.uid,
    existing: inputs.existing,
    accountCreatedAtMs: inputs.accountCreatedAtMs,
    nowMs: inputs.nowMs,
  });
}

/**
 * The writes a successful claim turns into.
 *
 * `inviterReferral` is the inviter's state as read inside the
 * transaction, so the count it produces is the one that goes in — the
 * caller writes the number rather than an increment sentinel, because the
 * badge derivation needs to know the result.
 */
export function claimPlan(args: {
  readonly referrerUid: string;
  readonly inviterReferral: ReferralState | undefined;
  readonly inviterEarned: ReadonlyArray<EarnedAchievement>;
  readonly nowIso: string;
}): ClaimPlan {
  const inviterCount = invitedCount(args.inviterReferral) + 1;
  const owned = new Set(args.inviterEarned.map((e) => e.id));
  return {
    invitedPatch: {
      referredBy: args.referrerUid,
      referredAt: args.nowIso,
    },
    inviterCount,
    newBadges: deriveInviteAchievements(inviterCount).filter(
      (id) => !owned.has(id)
    ),
  };
}
