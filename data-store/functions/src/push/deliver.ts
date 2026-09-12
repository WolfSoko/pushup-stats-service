import webpush from 'web-push';

import { isExpiredSubscriptionError } from './reminders';

/**
 * Sending one payload to a user's devices, and sorting the failures into
 * "this subscription is dead" and "try again next time". Firestore- and
 * logger-free so the classification is testable; `deliver-user.ts` wraps
 * it with the subscription reads and the cleanup of expired ones.
 */

export interface StoredSubscription {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown } | null;
}

export interface FailedSend {
  /** Endpoint tail, enough to match a log line to a device. */
  readonly endpoint: string;
  readonly status?: number;
  readonly code?: string;
  readonly message?: string;
}

export interface DeliveryResult<T> {
  sent: number;
  /** Keys of subscriptions the push service declared gone. */
  expired: T[];
  /** Everything else — worth a log line, and a retry next time. */
  failed: FailedSend[];
}

export interface PushSendOptions {
  urgency: 'very-low' | 'low' | 'normal' | 'high';
  TTL: number;
  topic: string;
}

export type PushSender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  options: PushSendOptions
) => Promise<unknown>;

const webPushSender: PushSender = (subscription, payload, options) =>
  webpush.sendNotification(subscription, payload, options);

export async function sendToSubscriptions<T>(
  subs: ReadonlyArray<{ key: T; data: StoredSubscription }>,
  payload: string,
  options: PushSendOptions,
  send: PushSender = webPushSender
): Promise<DeliveryResult<T>> {
  const result: DeliveryResult<T> = { sent: 0, expired: [], failed: [] };
  for (const { key, data } of subs) {
    const endpoint = data.endpoint;
    const p256dh = data.keys?.p256dh;
    const auth = data.keys?.auth;
    if (
      typeof endpoint !== 'string' ||
      typeof p256dh !== 'string' ||
      typeof auth !== 'string'
    ) {
      continue;
    }
    try {
      await send({ endpoint, keys: { p256dh, auth } }, payload, options);
      result.sent++;
    } catch (err: unknown) {
      const pushErr = err as {
        statusCode?: number;
        code?: string;
        message?: string;
      };
      if (isExpiredSubscriptionError(pushErr, endpoint)) {
        result.expired.push(key);
      } else {
        result.failed.push({
          endpoint: endpoint.slice(-20),
          status: pushErr.statusCode,
          code: pushErr.code,
          message: pushErr.message,
        });
      }
    }
  }
  return result;
}
