/**
 * `notificationclick` handling for the push service worker: routes the
 * reminder notification's action buttons (`snooze`, `log`, `quick-log`)
 * and the plain body tap.
 *
 * Split from `handlers.ts` so each file keeps one concern — the push /
 * subscription-change handlers there, the click routing here.
 */
import { resolveLocale, type SwContext, type SwLocale } from './handlers';
import { newIntentId, type PushIntent } from './intent-queue';

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
 * Message asking every open client to drain the intent store now. Carries no
 * payload: what to do lives in IndexedDB, so a client that handles this late
 * (or twice) can neither miss nor duplicate the action.
 */
export const DRAIN_INTENTS_MESSAGE = 'DRAIN_PUSH_INTENTS';

/**
 * How long to wait for a client to confirm it drained the intent before
 * bringing a window to the front.
 *
 * A backgrounded tab can be frozen by the browser: `matchAll` still returns
 * it, but a posted message sits unhandled in its queue. Keep this short:
 * `waitUntil` holds the worker alive for the whole window.
 */
export const INTENT_ACK_TIMEOUT_MS = 2000;

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
 * Asks every open client to drain the intent store and resolves as soon as
 * one confirms. Resolves `false` when there is no client, when none replies
 * within `INTENT_ACK_TIMEOUT_MS` (frozen tab), or when the client reports it
 * could not act — the caller then brings a window to the front.
 *
 * All clients are messaged, not just the first: `matchAll` order carries no
 * guarantee that `[0]` is the live tab, and draining is idempotent (the
 * store is emptied in the same transaction it is read), so a double nudge is
 * harmless.
 */
function requestDrainFromClients(
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
    const timer = setTimeout(() => settle(false), INTENT_ACK_TIMEOUT_MS);

    for (const client of clientList) {
      const channel = new MessageChannel();
      ports.push(channel.port1);
      channel.port1.onmessage = (ev: MessageEvent) => {
        // Only a positive ack counts. A client that reports failure is left
        // to the timeout so another (healthy) client still gets its chance.
        if ((ev.data as { ok?: boolean } | null)?.ok === true) settle(true);
      };
      client.postMessage({ type: DRAIN_INTENTS_MESSAGE }, [channel.port2]);
    }
  });
}

/**
 * Records the intent, then tries to get it acted on right away.
 *
 * The store write is what makes the action reliable; everything after it is
 * about immediacy. When no client confirms, a window is focused (which thaws
 * a frozen PWA) or opened — the app drains on `visibilitychange` either way,
 * so this survives Android resuming an existing task without navigating.
 * Better a window the user did not ask for than a snooze they believe is set
 * while reminders keep firing.
 */
async function dispatchIntent(
  intent: PushIntent,
  ctx: SwContext,
  locale: SwLocale
): Promise<boolean> {
  try {
    await ctx.saveIntent(intent);
  } catch (err) {
    console.error('[sw-push] could not store intent', err);
    return false;
  }

  const clientList = await ctx.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  if (await requestDrainFromClients(clientList)) return true;

  const target = clientList[0];
  if (target && 'focus' in target) {
    const focused = await target.focus().then(
      () => true,
      () => false
    );
    if (focused) return true;
  }
  await ctx.clients.openWindow(`/${locale}/app`);
  return true;
}

function handleSnooze(
  event: NotificationClickEventLike,
  ctx: SwContext,
  locale: SwLocale
): void {
  event.waitUntil(
    dispatchIntent(
      {
        id: newIntentId(),
        type: 'snooze',
        createdAt: Date.now(),
        snoozeMinutes: SNOOZE_MINUTES,
      },
      ctx,
      locale
    )
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
      const dispatched = await dispatchIntent(
        { id: newIntentId(), type: 'quick-log', createdAt: Date.now(), reps },
        ctx,
        locale
      );
      // Storage failed, so nothing will ever apply this tap. Silence would
      // read as a dead button; the dialog at least lets the user log it.
      if (!dispatched) await ctx.clients.openWindow(`/${locale}/app?log=1`);
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
