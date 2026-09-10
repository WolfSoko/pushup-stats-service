/**
 * Friendships: mutual, explicit, and the basis for the `friends`
 * visibility tier (`profile-visibility.models.ts`).
 *
 * One document per pair at `friendships/{friendshipId}`, with a
 * deterministic id derived from the two uids — so "A invites B" and "B
 * invites A" can never produce two competing records, and a duplicate
 * request is a document that already exists rather than a race.
 *
 * Written exclusively by Cloud Functions: the status decides what the
 * other side gets to see, so a client-writable state machine would be a
 * client-writable privacy setting.
 */

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface Friendship {
  /** Both uids, sorted — the pair, not a direction. */
  users: string[];
  /** Who asked. The other side is the one who may accept or decline. */
  requestedBy: string;
  status: FriendshipStatus;
  createdAt: string;
  /** ISO timestamp of the accept or decline. */
  respondedAt?: string;
}

/**
 * Upper bound on accepted friends. Not a technical limit — the friends
 * list and its leaderboard are read in one go, and a list of hundreds
 * stops being a list of friends.
 */
export const MAX_FRIENDS = 200;

/** The two uids in their canonical order. */
export function friendshipPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Document id for a pair. `__` separates: Firestore ids may not contain
 * `/`, and uids are `[A-Za-z0-9_-]`, so a double underscore cannot occur
 * inside one uid's worth of the id in a way that shifts the split.
 */
export function friendshipId(a: string, b: string): string {
  const [lo, hi] = friendshipPair(a, b);
  return `${lo}__${hi}`;
}

/** The other participant, or `null` when `uid` is not part of the pair. */
export function friendOf(
  friendship: Pick<Friendship, 'users'>,
  uid: string
): string | null {
  if (friendship.users.length !== 2) return null;
  const [a, b] = friendship.users;
  if (a === uid) return b;
  if (b === uid) return a;
  return null;
}

/** Whether `uid` is looking at an incoming request they may answer. */
export function isIncomingRequest(
  friendship: Pick<Friendship, 'users' | 'requestedBy' | 'status'>,
  uid: string
): boolean {
  return (
    friendship.status === 'pending' &&
    friendship.requestedBy !== uid &&
    friendOf(friendship, uid) !== null
  );
}

/** Whether `uid` is waiting for an answer to their own request. */
export function isOutgoingRequest(
  friendship: Pick<Friendship, 'users' | 'requestedBy' | 'status'>,
  uid: string
): boolean {
  return (
    friendship.status === 'pending' &&
    friendship.requestedBy === uid &&
    friendOf(friendship, uid) !== null
  );
}

export type FriendRequestRejection =
  | 'invalid' // malformed uid
  | 'self' // own uid
  | 'pending' // already asked, or already asked by them
  | 'exists' // already friends
  | 'declined' // they said no; only they can open the door again
  | 'limit'; // requester is at MAX_FRIENDS

/**
 * Whether `requester` may ask `target`, given whatever record the pair
 * already has. `null` means the request may be created.
 *
 * A declined request is not forgotten: re-asking would make "no" a
 * temporary answer. The person who declined may still send their own
 * request later — that is them changing their mind, not being nagged.
 */
export function friendRequestRejection(args: {
  readonly requester: string;
  readonly target: unknown;
  readonly existing: Pick<Friendship, 'status' | 'requestedBy'> | undefined;
  readonly requesterFriendCount: number;
}): FriendRequestRejection | null {
  if (!isValidFriendUid(args.target)) return 'invalid';
  if (args.target === args.requester) return 'self';
  const existing = args.existing;
  if (existing?.status === 'accepted') return 'exists';
  if (existing?.status === 'pending') return 'pending';
  if (
    existing?.status === 'declined' &&
    existing.requestedBy === args.requester
  ) {
    return 'declined';
  }
  if (args.requesterFriendCount >= MAX_FRIENDS) return 'limit';
  return null;
}

/**
 * Uids as they appear in this codebase: Firebase Auth uids are
 * URL-safe, and a value with a slash or a dot could address a different
 * document path. Mirrors `isValidUid` in the public-profile function.
 */
export function isValidFriendUid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

/** The document a fresh request turns into. */
export function newFriendship(
  requester: string,
  target: string,
  nowIso: string
): Friendship {
  return {
    users: [...friendshipPair(requester, target)],
    requestedBy: requester,
    status: 'pending',
    createdAt: nowIso,
  };
}
