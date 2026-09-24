/**
 * What "delete everything about a user" means, as data. Pure so the
 * inventory can be asserted without Firestore; `purge.ts` executes it.
 *
 * Every collection that stores something about a user must appear here —
 * a new per-user collection that is missing from this file survives the
 * account and becomes the data junk this module exists to prevent.
 */

/**
 * Collections whose document id IS the uid. Deleted recursively, so
 * subcollections go with them (`userStats/{uid}/perExercise`,
 * `userTrainingPlans/{uid}/history`, `userXp/{uid}/xpLedger`, `pushSubscriptions/{uid}/subs`,
 * `notifications/{uid}/inbox`) — including parents that exist only as a
 * path because nothing was ever written to the parent document itself.
 *
 * `userStats`, `userXp` and `adminUserActivity` come last on purpose: the entry
 * triggers write them, so deleting them after the entries leaves nothing
 * for a late trigger to have re-created before the purge finished.
 */
export const UID_KEYED_COLLECTIONS = [
  'userConfigs',
  'userTrainingPlans',
  'userAchievements',
  'reminderDispatchState',
  'cheerPings',
  'pushSubscriptions',
  'notifications',
  'userStats',
  'userXp',
  'adminUserActivity',
] as const;

/**
 * Collections keyed `{uid}__{suffix}` — one document per uid and variant,
 * e.g. `motivationQuotes/{uid}__{lang}`. Deleted by a document-id range.
 */
export const UID_PREFIXED_COLLECTIONS = ['motivationQuotes'] as const;

export const UID_PREFIX_SEPARATOR = '__';

/** The uid a `{uid}__{suffix}` document id belongs to. */
export function uidOfPrefixedId(docId: string): string {
  return docId.split(UID_PREFIX_SEPARATOR)[0];
}

export interface OwnedQuery {
  readonly collection: string;
  readonly field: string;
  readonly op: '==' | 'array-contains';
}

/**
 * Documents that belong to the user (or to a pair the user was part of)
 * and are deleted outright. `exerciseEntries` is first because its
 * deletions fan out into triggers that the tombstone has to catch.
 */
export const OWNED_QUERIES: readonly OwnedQuery[] = [
  { collection: 'exerciseEntries', field: 'userId', op: '==' },
  { collection: 'deletedExerciseEntries', field: 'userId', op: '==' },
  { collection: 'workouts', field: 'ownerId', op: '==' },
  { collection: 'workoutReminders', field: 'ownerId', op: '==' },
  { collection: 'friendships', field: 'users', op: 'array-contains' },
  { collection: 'friendInvites', field: 'uid', op: '==' },
  { collection: 'cheers', field: 'from', op: '==' },
  { collection: 'cheers', field: 'to', op: '==' },
];

/**
 * Reports the user sent are kept for the team — the text is about the app,
 * not about the person — but everything that ties them to the person is
 * cleared.
 */
export const ANONYMIZED_QUERIES: ReadonlyArray<{
  readonly collection: string;
  readonly patch: Readonly<Record<string, null>>;
}> = [
  { collection: 'feedback', patch: { userId: null, email: null, name: null } },
  { collection: 'autoCountFeedback', patch: { userId: null } },
];

export interface ChallengeMembership {
  readonly participants?: unknown;
  readonly invited?: unknown;
}

export type ChallengeRemoval =
  | { readonly kind: 'delete' }
  | {
      readonly kind: 'update';
      readonly participants: string[];
      readonly invited: string[];
    }
  | { readonly kind: 'none' };

function uidList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
}

/**
 * A challenge the deleted user took part in or was invited to. The others
 * keep competing without them; a challenge nobody is left in goes away,
 * the same rule `leaveChallenge` applies.
 */
export function challengeWithoutUser(
  doc: ChallengeMembership,
  uid: string
): ChallengeRemoval {
  const participants = uidList(doc.participants);
  const invited = uidList(doc.invited);
  if (!participants.includes(uid) && !invited.includes(uid)) {
    return { kind: 'none' };
  }
  const remaining = participants.filter((p) => p !== uid);
  if (remaining.length === 0) return { kind: 'delete' };
  return {
    kind: 'update',
    participants: remaining,
    invited: invited.filter((i) => i !== uid),
  };
}
