import { isInQuietHours, type ReminderConfig } from './reminder-config.models';

/**
 * The user's message inbox: one document per event under
 * `notifications/{uid}/inbox/{id}`.
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
  | 'achievement'
  | 'goalReached';

/**
 * How an entry is presented. Derived from the type rather than stored:
 * it is a display decision, and baking it into the document would freeze
 * today's grouping into every row ever written.
 *
 * `motivation` exists because an anfeuerung and a reached goal are the
 * same *feeling* as a motivational quote — they belong together, not
 * sorted into a grey list.
 */
export type NotificationCategory =
  | 'motivation'
  | 'social'
  | 'achievement'
  | 'system';

export function notificationCategory(
  type: NotificationType
): NotificationCategory {
  if (type === 'cheer' || type === 'goalReached') return 'motivation';
  if (type === 'achievement') return 'achievement';
  return 'social';
}

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

/**
 * Per-type push opt-out. Absent or `undefined` means on: the feature is
 * opt-out, like `cheerAnimationEnabled`, so configs written before this
 * field existed keep behaving as their owners expect.
 */
export type NotificationPrefs = Partial<Record<NotificationType, boolean>>;

export interface NotificationPushContext {
  readonly notificationPrefs?: NotificationPrefs;
  readonly reminder?: Pick<ReminderConfig, 'quietHours' | 'timezone'>;
}

/**
 * Whether a push may go out for this notification. The inbox entry is
 * written either way — that is what makes suppressing a push safe at
 * all. Before the inbox existed, `sendCheer` sent unconditionally,
 * because a suppressed cheer would have vanished without trace.
 *
 * Quiet hours are reused from the reminder config rather than given
 * their own setting: someone who silenced their nights does not want to
 * be woken by a friend instead, and asking them twice would be a
 * second switch for the same wish.
 */
export function shouldPushNotification(
  context: NotificationPushContext | undefined,
  type: NotificationType,
  now: Date
): boolean {
  if (context?.notificationPrefs?.[type] === false) return false;
  return !isInQuietHours(
    context?.reminder?.quietHours ?? [],
    context?.reminder?.timezone,
    now
  );
}

export type NotificationIdInput =
  | { readonly type: 'cheer'; readonly actorUid: string; readonly day: string }
  | {
      readonly type: 'friendRequest' | 'friendAccepted';
      readonly actorUid: string;
    }
  | { readonly type: 'achievement'; readonly achievementId: string }
  | { readonly type: 'goalReached'; readonly day: string }
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
    case 'goalReached':
      return `goalReached__${input.day}`;
    default:
      return null;
  }
}
