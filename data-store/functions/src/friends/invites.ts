/**
 * Invite tokens — the proof that an inviter meant *this* person.
 *
 * An earlier version put the inviter's raw uid in the link and trusted
 * whoever sent it back. A uid is public (it is the `/u/:uid` segment), so
 * that let any account forge a pending request *from* anyone and then
 * accept it themselves — `respondRejection` only stops the side that is
 * `requestedBy`. The token closes that: it is unguessable, it is minted
 * only by the account it belongs to, and it expires.
 */

/** 30 days. Long enough for a link to sit in a chat, short enough to rot. */
export const FRIEND_INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface FriendInviteRecord {
  readonly uid: string;
  readonly expiresAtMs: number;
}

export type InviteTokenRejection = 'invalid' | 'expired';

/**
 * Token shape, checked before any read: 32 base64url characters from
 * `randomBytes(24)`. Anything else never came from `createFriendInvite`
 * and must not reach a document path.
 */
export function isValidInviteToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 16 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

/**
 * Whether a looked-up token may still be redeemed. Expiry is checked here
 * rather than left to the TTL policy: that policy deletes lazily, and a
 * token is a credential — it has to stop working on time, not eventually.
 */
export function inviteTokenRejection(args: {
  readonly record: FriendInviteRecord | undefined;
  readonly nowMs: number;
}): InviteTokenRejection | null {
  const record = args.record;
  if (!record || !record.uid) return 'invalid';
  if (!Number.isFinite(record.expiresAtMs)) return 'expired';
  if (record.expiresAtMs <= args.nowMs) return 'expired';
  return null;
}

/** When a token minted or refreshed at `nowMs` stops working. */
export function inviteExpiryMs(nowMs: number): number {
  return nowMs + FRIEND_INVITE_TTL_MS;
}
