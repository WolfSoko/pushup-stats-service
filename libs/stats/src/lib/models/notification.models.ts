/**
 * The user's message inbox: one document per event under
 * `notifications/{uid}/items/{id}`.
 *
 * Social events already send a Web Push, but push is not a delivery
 * guarantee — someone who never granted notification permission, or
 * whose subscription expired, never learns the event happened. The
 * inbox is the durable side; push stays the optional accelerator.
 *
 * Texts are deliberately **not** stored. A document carries `type` plus
 * `payload` and the client renders it with `$localize`, so switching
 * language does not leave half the inbox in the language it was written
 * in.
 */

export type NotificationType =
  | 'cheer'
  | 'friendRequest'
  | 'friendAccepted'
  | 'challenge'
  | 'challengeAccepted'
  | 'workoutShared'
  | 'achievement';

export interface UserNotification {
  readonly type: NotificationType;
  /** ISO timestamp, same convention as `Cheer.createdAt`. */
  readonly createdAt: string;
  readonly readAt: string | null;
  readonly actorUid: string | null;
  /**
   * Snapshot of the actor's display name at write time. Denormalised so
   * a list renders without one `userConfigs` read per row; the push
   * payload resolves the same name anyway.
   */
  readonly actorName: string | null;
  /** Target route *without* locale prefix — the client knows its locale. */
  readonly url: string;
  readonly payload?: Readonly<Record<string, string | number>>;
}

/**
 * Inbox entries are history, not a ledger — the TTL policy on
 * `expiresAt` drops them. Long enough that a month away from the app
 * still shows what happened, short enough that the collection does not
 * grow without bound.
 */
export const NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type NotificationIdInput =
  | { readonly type: 'cheer'; readonly actorUid: string; readonly day: string }
  | {
      readonly type: 'friendRequest' | 'friendAccepted';
      readonly actorUid: string;
    }
  | { readonly type: 'achievement'; readonly achievementId: string }
  | { readonly type: 'challenge' | 'challengeAccepted' | 'workoutShared' };

/**
 * A deterministic id where a repeat would be noise, `null` where every
 * occurrence deserves its own row (the caller then lets Firestore assign
 * one). Deterministic means a repeat *overwrites*: someone who withdraws
 * a friend request and sends it again owns one row, not two.
 */
export function notificationDocId(input: NotificationIdInput): string | null {
  switch (input.type) {
    case 'cheer':
      return `cheer__${input.actorUid}__${input.day}`;
    case 'friendRequest':
    case 'friendAccepted':
      return `${input.type}__${input.actorUid}`;
    case 'achievement':
      return `achievement__${input.achievementId}`;
    default:
      return null;
  }
}
