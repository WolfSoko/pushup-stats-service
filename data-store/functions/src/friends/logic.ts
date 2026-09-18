import {
  friendOf,
  friendRequestRejection,
  isIncomingRequest,
  isOutgoingRequest,
  isValidFriendUid,
  type Friendship,
  type FriendRequestRejection,
} from '@pu-stats/models';

/**
 * Pure side of friendships: who may ask whom, and how a pile of
 * friendship documents turns into the three lists a user sees. Firestore
 * lives in `functions-friends.ts`.
 */

export interface FriendshipDoc extends Friendship {
  readonly id: string;
}

/** One row of the friends screen. */
export interface FriendListEntry {
  readonly id: string;
  readonly uid: string;
  readonly since: string;
}

export interface FriendLists {
  readonly friends: ReadonlyArray<FriendListEntry>;
  readonly incoming: ReadonlyArray<FriendListEntry>;
  readonly outgoing: ReadonlyArray<FriendListEntry>;
}

export function requestRejection(args: {
  readonly requester: string;
  readonly target: unknown;
  readonly existing: FriendshipDoc | undefined;
  readonly requesterFriendCount: number;
}): FriendRequestRejection | null {
  return friendRequestRejection({
    requester: args.requester,
    target: args.target,
    existing: args.existing,
    requesterFriendCount: args.requesterFriendCount,
  });
}

/**
 * Whether someone arriving on an invite link may be turned into a pending
 * request *from the inviter*.
 *
 * Same rules as a request the inviter sent by hand — they are the
 * requester here, so their friend cap and a record they already declined
 * both still apply. The one addition is validating the inviter: on this
 * path the uid comes off a link the caller controls, not from their auth
 * token.
 */
export function inviteRejection(args: {
  readonly inviter: unknown;
  readonly invitee: string;
  readonly existing: FriendshipDoc | undefined;
  readonly inviterFriendCount: number;
}): FriendRequestRejection | null {
  if (!isValidFriendUid(args.inviter)) return 'invalid';
  return friendRequestRejection({
    requester: args.inviter,
    target: args.invitee,
    existing: args.existing,
    requesterFriendCount: args.inviterFriendCount,
  });
}

/**
 * Splits a user's friendship documents into accepted friends, requests
 * waiting for their answer, and requests they are waiting on. Declined
 * records are kept in Firestore (they are what stops a re-ask) but never
 * surface — a list of people who said no is not a feature.
 *
 * Newest first in every list, so the thing that just happened is on top.
 */
export function friendLists(
  docs: ReadonlyArray<FriendshipDoc>,
  uid: string
): FriendLists {
  const friends: FriendListEntry[] = [];
  const incoming: FriendListEntry[] = [];
  const outgoing: FriendListEntry[] = [];

  for (const doc of docs) {
    const other = friendOf(doc, uid);
    if (!other) continue;
    const entry: FriendListEntry = {
      id: doc.id,
      uid: other,
      since: doc.respondedAt ?? doc.createdAt,
    };
    if (doc.status === 'accepted') friends.push(entry);
    else if (isIncomingRequest(doc, uid)) incoming.push(entry);
    else if (isOutgoingRequest(doc, uid)) outgoing.push(entry);
  }

  const newestFirst = (a: FriendListEntry, b: FriendListEntry) =>
    b.since.localeCompare(a.since);
  return {
    friends: friends.sort(newestFirst),
    incoming: incoming.sort(newestFirst),
    outgoing: outgoing.sort(newestFirst),
  };
}

/** One row as the friends screen reads it. */
export interface FriendListRow extends FriendListEntry {
  readonly displayName: string | null;
  readonly photoURL: string | null;
}

export interface FriendListsWithProfiles {
  readonly friends: ReadonlyArray<FriendListRow>;
  readonly incoming: ReadonlyArray<FriendListRow>;
  readonly outgoing: ReadonlyArray<FriendListRow>;
}

/**
 * Puts the names and pictures on the three lists.
 *
 * Only confirmed friends get a picture. A pending request is not yet an
 * audience anyone agreed to, and a stranger's request should not be a way
 * to pull someone's photo — the name they already typed to find each
 * other is a different matter.
 */
export function withProfiles(
  lists: FriendLists,
  names: ReadonlyMap<string, string>,
  photos: ReadonlyMap<string, string>
): FriendListsWithProfiles {
  const row = (entry: FriendListEntry, photoURL: string | null) => ({
    ...entry,
    displayName: names.get(entry.uid) ?? null,
    photoURL,
  });
  return {
    friends: lists.friends.map((e) => row(e, photos.get(e.uid) ?? null)),
    incoming: lists.incoming.map((e) => row(e, null)),
    outgoing: lists.outgoing.map((e) => row(e, null)),
  };
}

/** Uids of confirmed friends — the set the `friends` visibility tier uses. */
export function acceptedFriendUids(
  docs: ReadonlyArray<FriendshipDoc>,
  uid: string
): string[] {
  return docs
    .filter((doc) => doc.status === 'accepted')
    .map((doc) => friendOf(doc, uid))
    .filter((other): other is string => other !== null);
}

export type RespondRejection = 'not-found' | 'not-yours' | 'settled';

/**
 * Whether `uid` may answer this request. Only the invited side may, and
 * only while it is still open — an accepted friendship is ended with
 * `removeFriend`, not by declining it after the fact.
 */
export function respondRejection(
  doc: FriendshipDoc | undefined,
  uid: string
): RespondRejection | null {
  if (!doc) return 'not-found';
  if (friendOf(doc, uid) === null) return 'not-yours';
  if (doc.status !== 'pending') return 'settled';
  if (doc.requestedBy === uid) return 'not-yours';
  return null;
}
