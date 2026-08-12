/**
 * `notificationclick` handling for the push service worker: routes the
 * reminder notification's action buttons (`snooze`, `log`, `quick-log`)
 * and the plain body tap.
 *
 * Split from `handlers.ts` so each file keeps one concern — the push /
 * subscription-change handlers there, the click routing here.
 */
import { resolveLocale, type SwContext, type SwLocale } from './handlers';

/**
 * Defense-in-depth cap mirrored from `@pu-stats/models#QUICK_LOG_REPS_MAX` and
 * the dispatch CF (`data-store/functions/src/push/reminders.ts`). Inlined to
 * keep the sw-push bundle self-contained — if either value changes, update
 * here too. The CF already sanitizes before sending; this guard catches stale
 * payloads from older deployments and any payload tampering.
 */
export const SW_QUICK_LOG_MAX = 500;

/** Minutes the `snooze` action postpones the next reminder by. */
export const SNOOZE_MINUTES = 30;

/**
 * How long the snooze handler waits for a client to confirm it reached the
 * `snoozeReminder` callable before falling back to the deep link.
 *
 * A backgrounded tab can be frozen by the browser: `matchAll` still returns
 * it, but a posted message sits unhandled in its queue — and dies with the
 * tab when the browser discards it. Without an ack the snooze was silently
 * lost (production showed zero `snoozeReminder` invocations while reminders
 * kept being delivered). Keep this short: `waitUntil` holds the worker
 * alive for the whole window.
 */
export const SNOOZE_ACK_TIMEOUT_MS = 2000;

export interface NotificationClickEventLike {
  action: string;
  notification: {
    data?: {
      locale?: string;
      url?: string;
      /** Set when the dispatch CF includes a `quick-log` action button. */
      quickLogReps?: number;
    } | null;
    close(): void;
  };
  waitUntil(promise: Promise<unknown>): void;
}

type SwWindowClient = Pick<WindowClient, 'url' | 'focus' | 'postMessage'>;

/**
 * Asks every open client to run the snooze and resolves as soon as one
 * confirms. Resolves `false` when there is no client, when none replies
 * within `SNOOZE_ACK_TIMEOUT_MS` (frozen tab), or when the client reports
 * the callable failed — the caller then falls back to the deep link.
 *
 * All clients are messaged, not just the first: `matchAll` order carries no
 * guarantee that `[0]` is the live tab, and the callable is idempotent
 * (it writes an absolute `snoozedUntil`), so a double run is harmless.
 */
function requestSnoozeFromClients(
  clientList: SwWindowClient[]
): Promise<boolean> {
  if (clientList.length === 0) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const ports: MessagePort[] = [];
    let settled = false;
    const settle = (value: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const port of ports) port.close();
      resolve(value);
    };
    const timer = setTimeout(() => settle(false), SNOOZE_ACK_TIMEOUT_MS);

    for (const client of clientList) {
      const channel = new MessageChannel();
      ports.push(channel.port1);
      channel.port1.onmessage = (ev: MessageEvent) => {
        // Only a positive ack counts. A client that reports failure is left
        // to the timeout so another (healthy) client still gets its chance.
        if ((ev.data as { ok?: boolean } | null)?.ok === true) settle(true);
      };
      client.postMessage(
        { type: 'SNOOZE_REMINDER', snoozeMinutes: SNOOZE_MINUTES },
        [channel.port2]
      );
    }
  });
}

function handleSnooze(
  event: NotificationClickEventLike,
  ctx: SwContext,
  locale: SwLocale
): void {
  event.waitUntil(
    (async () => {
      const clientList = await ctx.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      if (await requestSnoozeFromClients(clientList)) return;
      // Nobody confirmed — open the app so the `?snooze=` deep link runs it.
      // Better a tab the user did not ask for than a snooze they believe is
      // set while reminders keep firing.
      await ctx.clients.openWindow(`/${locale}/app?snooze=${SNOOZE_MINUTES}`);
    })()
  );
}

function handleQuickLog(
  event: NotificationClickEventLike,
  ctx: SwContext,
  locale: SwLocale
): void {
  const repsRaw = event.notification.data?.quickLogReps;
  const repsFloored =
    typeof repsRaw === 'number' && Number.isFinite(repsRaw)
      ? Math.floor(repsRaw)
      : NaN;
  // Clamp into [1, SW_QUICK_LOG_MAX] so a stale or tampered payload can't
  // smuggle a 9999-rep entry past the dispatch sanitizer.
  const reps =
    Number.isFinite(repsFloored) && repsFloored > 0
      ? Math.min(repsFloored, SW_QUICK_LOG_MAX)
      : NaN;

  event.waitUntil(
    (async () => {
      // No valid count → fall back to the standard log flow so the user
      // doesn't get an unresponsive button.
      if (!Number.isFinite(reps) || reps <= 0) {
        await ctx.clients.openWindow(`/${locale}/app?log=1`);
        return;
      }
      const clientList = await ctx.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      if (clientList.length > 0) {
        // App is open somewhere — log silently in the existing tab so the
        // user gets feedback without a navigation flicker.
        clientList[0].postMessage({
          type: 'QUICK_LOG_PUSHUPS',
          reps,
        });
        if ('focus' in clientList[0]) {
          await (clientList[0] as { focus: () => Promise<unknown> })
            .focus()
            .catch(() => undefined);
        }
        return;
      }
      // No open client — open a new tab with `?quickLog=N`; the dashboard
      // creates the entry on first render.
      await ctx.clients.openWindow(`/${locale}/app?quickLog=${reps}`);
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
        if (client.url === fullUrl && 'focus' in client) {
          await client.focus();
          return;
        }
      }
      await ctx.clients.openWindow(fullUrl);
    })()
  );
}
