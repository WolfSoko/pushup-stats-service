/**
 * Invitations: the return path of the sharing loop.
 *
 * A shared link carries the inviting user's id as `?ref=<uid>`. The
 * recipient's browser keeps it until they have an account, then the
 * `claimReferral` callable attributes the signup — server-side, because a
 * client-written attribution would be a badge anyone could mint.
 *
 * Nothing here depends on Firebase, so both tiers share the rules about
 * what may be claimed.
 */

/** Query parameter carrying the inviter's uid on a shared link. */
export const REFERRAL_PARAM = 'ref';

/** Per-user invitation state, stored on `userConfigs/{uid}.referral`. */
export interface ReferralState {
  /** Uid of the user whose link brought this account in. Server-written. */
  referredBy?: string;
  /** ISO timestamp the attribution was recorded. */
  referredAt?: string;
  /** How many accounts joined through this user's link. Server-written. */
  invitedCount?: number;
}

/**
 * How long after signup an invitation can still be attributed.
 *
 * Without a window, an account could claim an invite months later — the
 * count is supposed to measure "this link brought someone in", not "these
 * two users know each other".
 */
export const REFERRAL_CLAIM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Why a claim was refused; `null` means it may proceed. */
export type ReferralRejection =
  | 'invalid' // malformed or missing referrer id
  | 'self' // own link
  | 'already-claimed' // this account was already attributed
  | 'too-late'; // outside REFERRAL_CLAIM_WINDOW_MS

/**
 * Firestore document ids are 1–1500 bytes and cannot contain slashes;
 * Firebase Auth uids are 1–128 characters. A ref value that fails this
 * never identified a user, so it is refused before any read.
 */
export function isValidReferrerId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    !value.includes('/') &&
    value.trim() === value
  );
}

/**
 * Whether `uid` may claim `referrerUid` as their inviter. Pure, so the
 * callable and the client agree on the rules — though only the callable's
 * verdict is authoritative.
 */
export function referralRejection(args: {
  readonly referrerUid: unknown;
  readonly uid: string;
  readonly existing: ReferralState | undefined;
  readonly accountCreatedAtMs: number | null;
  readonly nowMs: number;
}): ReferralRejection | null {
  if (!isValidReferrerId(args.referrerUid)) return 'invalid';
  if (args.referrerUid === args.uid) return 'self';
  if (args.existing?.referredBy) return 'already-claimed';
  if (
    args.accountCreatedAtMs !== null &&
    args.nowMs - args.accountCreatedAtMs > REFERRAL_CLAIM_WINDOW_MS
  ) {
    return 'too-late';
  }
  return null;
}

/** Invitations credited to a user so far. */
export function invitedCount(
  referral: ReferralState | undefined | null
): number {
  const count = referral?.invitedCount;
  return typeof count === 'number' && Number.isFinite(count) && count > 0
    ? Math.trunc(count)
    : 0;
}
