/**
 * Pure handler functions for the push service worker. Extracted from the SW
 * entrypoint so they can be unit-tested directly without a Service Worker
 * runtime.
 *
 * Each handler takes the SW event plus the bits of the global scope it needs
 * (`registration`, `clients`). Kept independent of `self` / `importScripts`
 * so jest can call them with plain mocks.
 */

/** Injected at build time by esbuild's `define` option. */
declare const __SW_PUSH_VERSION__: string;

export const SW_PUSH_VERSION: string =
  typeof __SW_PUSH_VERSION__ === 'string' ? __SW_PUSH_VERSION__ : 'unversioned';

export interface PushSubscriptionChangeEventLike {
  oldSubscription: PushSubscription | null;
  newSubscription: PushSubscription | null;
  waitUntil(promise: Promise<unknown>): void;
}

export interface PushEventLike {
  data: {
    json(): unknown;
    text(): string;
  } | null;
  waitUntil(promise: Promise<unknown>): void;
}

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

export interface SwContext {
  registration: Pick<
    ServiceWorkerRegistration,
    'showNotification' | 'pushManager'
  >;
  clients: {
    matchAll(options?: {
      type?: string;
      includeUncontrolled?: boolean;
    }): Promise<Array<Pick<WindowClient, 'url' | 'focus' | 'postMessage'>>>;
    openWindow(url: string): Promise<unknown>;
  };
  origin: string;
}

interface PushPayload {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  renotify?: boolean;
  data?: Record<string, unknown> & { locale?: string };
  locale?: string;
  actions?: Array<{ action: string; title: string }>;
}

function resolveLocale(raw: unknown): 'en' | 'de' {
  return String(raw ?? '')
    .toLowerCase()
    .startsWith('en')
    ? 'en'
    : 'de';
}

function defaultActions(
  locale: 'en' | 'de'
): Array<{ action: string; title: string }> {
  return locale === 'en'
    ? [
        { action: 'snooze', title: '⏰ Snooze 30 min' },
        { action: 'log', title: '✅ Log push-ups' },
      ]
    : [
        { action: 'snooze', title: '⏰ 30 Min snoozen' },
        { action: 'log', title: '✅ Eintragen' },
      ];
}

export function handlePush(event: PushEventLike, ctx: SwContext): void {
  if (!event.data) return;

  let payload: PushPayload;
  try {
    payload = (event.data.json() ?? {}) as PushPayload;
  } catch {
    payload = { title: 'PushUp Stats', body: event.data.text() };
  }

  const title = payload.title || 'PushUp Stats';
  const rawLocale = payload.data?.locale ?? payload.locale ?? '';
  const localeTag = String(rawLocale).toLowerCase();
  const locale = resolveLocale(localeTag);
  const actions = Array.isArray(payload.actions)
    ? payload.actions
    : defaultActions(locale);

  const options: NotificationOptions = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/badge-72x72.png',
    tag: payload.tag || 'reminder',
    // `renotify` is a valid web spec field but missing from lib.dom's
    // NotificationOptions in some TS lib versions — cast to keep it typed.
    data: { ...(payload.data ?? {}), locale: localeTag || undefined },
    actions,
  } as NotificationOptions & {
    renotify?: boolean;
    actions?: Array<{ action: string; title: string }>;
  };
  (options as { renotify?: boolean }).renotify = payload.renotify ?? true;

  event.waitUntil(ctx.registration.showNotification(title, options));
}

/**
 * `pushsubscriptionchange` fires when the push service invalidates a
 * subscription (FCM endpoint rotation, battery-saver kill, OS-level reset).
 * Without a listener, Chrome/Edge rewrite the endpoint to
 * `permanently-removed.invalid` and the sub becomes a zombie forever.
 *
 * Prefer `event.newSubscription` if the browser provides it; otherwise
 * re-subscribe with the old options so the applicationServerKey stays
 * aligned with the server's VAPID pair. Then postMessage to any open
 * client so it can persist the fresh sub via the `savePushSubscription`
 * callable.
 */
export function handlePushSubscriptionChange(
  event: PushSubscriptionChangeEventLike,
  ctx: SwContext
): void {
  event.waitUntil(
    (async () => {
      try {
        let newSub = event.newSubscription;
        const oldSub = event.oldSubscription;
        if (!newSub && oldSub) {
          newSub = await ctx.registration.pushManager.subscribe(
            oldSub.options as PushSubscriptionOptionsInit
          );
        }
        if (!newSub) return;
        const clientList = await ctx.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of clientList) {
          client.postMessage({
            type: 'PUSH_SUBSCRIPTION_CHANGED',
            sub: newSub.toJSON(),
          });
        }
      } catch (err) {
        console.error('[sw-push] pushsubscriptionchange failed', err);
      }
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
    event.waitUntil(
      (async () => {
        const clientList = await ctx.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        if (clientList.length > 0) {
          clientList[0].postMessage({
            type: 'SNOOZE_REMINDER',
            snoozeMinutes: 30,
          });
          return;
        }
        await ctx.clients.openWindow(`/${locale}/app?snooze=30`);
      })()
    );
    return;
  }

  if (action === 'log') {
    event.waitUntil(ctx.clients.openWindow(`/${locale}/app?log=1`));
    return;
  }

  if (action === 'quick-log') {
    const repsRaw = event.notification.data?.quickLogReps;
    const reps =
      typeof repsRaw === 'number' && Number.isFinite(repsRaw)
        ? Math.floor(repsRaw)
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
            await (
              clientList[0] as { focus: () => Promise<unknown> }
            )
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
