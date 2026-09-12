import type { Friendship, ReminderLocale } from '@pu-stats/models';

import type { PushSendOptions } from '../push/deliver';
import { friendPushTexts } from './push-text';

/**
 * Pure side of the friend notifications: which write means what, and
 * what the notification says. The trigger and callables in
 * `functions-friends-notify.ts` / `functions-cheers.ts` /
 * `functions-challenges.ts` do the reads and the sending.
 */

export type FriendPushKind = 'request' | 'accepted' | 'cheer' | 'challenge';

export interface FriendshipPushEvent {
  readonly kind: 'request' | 'accepted';
  /** Who gets the notification. */
  readonly to: string;
  /** Who it is about. */
  readonly from: string;
}

/**
 * The notification a friendship write earns, if any: a fresh request
 * wakes the person asked, an acceptance wakes the person who asked.
 * Declines and removals stay silent — "no" is not news anyone wants
 * pushed to their phone.
 */
export function friendshipPushEvent(
  before: Friendship | undefined,
  after: Friendship | undefined
): FriendshipPushEvent | null {
  if (!after || after.users.length !== 2) return null;
  const other = after.users.find((uid) => uid !== after.requestedBy);
  if (!other) return null;
  if (!before && after.status === 'pending') {
    return { kind: 'request', to: other, from: after.requestedBy };
  }
  if (before?.status === 'pending' && after.status === 'accepted') {
    return { kind: 'accepted', to: after.requestedBy, from: other };
  }
  return null;
}

/** Push-service options per kind: a topic per kind so two requests
 * collapse into one, but a request never swallows a cheer. */
export function friendPushOptions(kind: FriendPushKind): PushSendOptions {
  return { urgency: 'normal', TTL: 24 * 60 * 60, topic: `friend-${kind}` };
}

export interface FriendPushInput {
  readonly kind: FriendPushKind;
  readonly locale: ReminderLocale;
  /** Display name of the person the notification is about. */
  readonly actorName: string | null;
  readonly challenge?: {
    readonly target: number;
    readonly exerciseName: string;
    readonly days: number;
  };
}

/**
 * The Web Push payload. `actions` is an empty list on purpose: the SW
 * substitutes its reminder buttons when the field is missing, and a
 * friend notification has no push-ups to log.
 */
export function buildFriendPushPayload(input: FriendPushInput): string {
  const t = friendPushTexts(input.locale);
  const name = input.actorName ?? t.anonymous;
  const [title, body] = (() => {
    switch (input.kind) {
      case 'request':
        return [t.requestTitle, t.requestBody(name)];
      case 'accepted':
        return [t.acceptedTitle, t.acceptedBody(name)];
      case 'cheer':
        return [t.cheerTitle, t.cheerBody(name)];
      case 'challenge': {
        const c = input.challenge;
        return [
          t.challengeTitle,
          c
            ? t.challengeBody(name, c.target, c.exerciseName, c.days)
            : t.challengeBody(name, 0, '', 0),
        ];
      }
    }
  })();
  return JSON.stringify({
    title,
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `friend-${input.kind}`,
    renotify: true,
    data: { url: `/${input.locale}/freunde`, locale: input.locale },
    actions: [],
  });
}
