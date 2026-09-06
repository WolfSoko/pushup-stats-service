/**
 * `notificationclick` handling for the push service worker: routes the
 * reminder notification's action buttons (`snooze`, `log`, `quick-log`)
 * and the plain body tap.
 *
 * `snooze` and `quick-log` are completed right here, server-side, with the
 * single-use token the dispatcher put into the notification. No app window
 * takes part: every channel from the SW to a window (postMessage, a deep
 * link, a stored intent drained on resume) arrives late or replays on an
 * installed Android PWA, and each of them has written a push-up entry the
 * user never asked for. A tap is now exactly one HTTP call, and the server
 * refuses the same token twice.
 */
import { resolveLocale, type SwContext, type SwLocale } from './handlers';

/** Minutes the `snooze` action postpones the next reminder by. */
export const SNOOZE_MINUTES = 30;

export interface ReminderActionRef {
  uid: string;
  token: string;
  url: string;
}

export interface ReminderActionFeedback {
  snoozed?: string;
  logged?: string;
  failed?: string;
}

export interface NotificationClickEventLike {
  action: string;
  notification: {
    data?: {
      locale?: string;
      url?: string;
      reminderAction?: ReminderActionRef | null;
      feedback?: ReminderActionFeedback | null;
    } | null;
    close(): void;
  };
  waitUntil(promise: Promise<unknown>): void;
}

type ReminderActionType = 'snooze' | 'quick-log';

function actionRef(
  event: NotificationClickEventLike
): ReminderActionRef | null {
  const ref = event.notification.data?.reminderAction;
  if (
    !ref ||
    typeof ref.uid !== 'string' ||
    typeof ref.token !== 'string' ||
    typeof ref.url !== 'string' ||
    !ref.url.startsWith('https://')
  ) {
    return null;
  }
  return ref;
}

/**
 * Resolves `true` only when the server confirmed the action. A payload
 * without a token (sent by an older dispatcher), a network failure and a
 * refusal all resolve `false` so the caller can fall back visibly.
 */
async function completeOnServer(
  action: ReminderActionType,
  event: NotificationClickEventLike,
  ctx: SwContext
): Promise<boolean> {
  const ref = actionRef(event);
  if (!ref) return false;
  try {
    const response = await ctx.fetch(ref.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          uid: ref.uid,
          token: ref.token,
          action,
          ...(action === 'snooze' ? { snoozeMinutes: SNOOZE_MINUTES } : {}),
        },
      }),
    });
    if (!response.ok) return false;
    const body = (await response.json().catch(() => null)) as {
      result?: { ok?: boolean };
    } | null;
    return body?.result?.ok === true;
  } catch (err) {
    console.error('[sw-push] reminder action failed', err);
    return false;
  }
}

function fallbackFeedback(
  kind: keyof ReminderActionFeedback,
  locale: SwLocale
): string {
  const en = locale === 'en';
  switch (kind) {
    case 'snoozed':
      return en
        ? `⏰ Reminder snoozed for ${SNOOZE_MINUTES} min`
        : `⏰ Erinnerung um ${SNOOZE_MINUTES} Min verschoben`;
    case 'logged':
      return en ? '✅ Push-ups logged' : '✅ Liegestütze eingetragen';
    default:
      return en
        ? 'Action failed – please try again in the app'
        : 'Aktion fehlgeschlagen – bitte in der App erneut versuchen';
  }
}

function showFeedback(
  kind: keyof ReminderActionFeedback,
  event: NotificationClickEventLike,
  ctx: SwContext,
  locale: SwLocale
): Promise<void> {
  const text =
    event.notification.data?.feedback?.[kind] || fallbackFeedback(kind, locale);
  return ctx.registration.showNotification(text, {
    tag: 'reminder',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: { url: `/${locale}/app`, locale },
  });
}

function handleSnooze(
  event: NotificationClickEventLike,
  ctx: SwContext,
  locale: SwLocale
): void {
  event.waitUntil(
    (async () => {
      const done = await completeOnServer('snooze', event, ctx);
      await showFeedback(done ? 'snoozed' : 'failed', event, ctx, locale);
    })()
  );
}

function handleQuickLog(
  event: NotificationClickEventLike,
  ctx: SwContext,
  locale: SwLocale
): void {
  event.waitUntil(
    (async () => {
      const done = await completeOnServer('quick-log', event, ctx);
      if (done) {
        await showFeedback('logged', event, ctx, locale);
        return;
      }
      // Never log silently on a failure path: the dialog lets the user
      // enter the count themselves and see that the tap did not persist.
      await ctx.clients.openWindow(`/${locale}/app?log=1`);
    })()
  );
}

export function handleNotificationClick(
  event: NotificationClickEventLike,
  ctx: SwContext
): void {
  event.notification.close();

  const action = event.action;
  const locale = resolveLocale(event.notification.data?.locale);

  if (action === 'snooze') {
    handleSnooze(event, ctx, locale);
    return;
  }

  if (action === 'log') {
    event.waitUntil(ctx.clients.openWindow(`/${locale}/app?log=1`));
    return;
  }

  if (action === 'quick-log') {
    handleQuickLog(event, ctx, locale);
    return;
  }

  const targetUrl = event.notification.data?.url || `/${locale}/app`;
  const fullUrl = new URL(targetUrl, ctx.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await ctx.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if (client.url === fullUrl && typeof client.focus === 'function') {
          await client.focus();
          return;
        }
      }
      await ctx.clients.openWindow(fullUrl);
    })()
  );
}
