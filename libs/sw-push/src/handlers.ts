/**
 * Pure handler functions for the push service worker. Extracted from the SW
 * entrypoint so they can be unit-tested directly without a Service Worker
 * runtime.
 *
 * Each handler takes the SW event plus the bits of the global scope it needs
 * (`registration`, `clients`). Kept independent of `self` / `importScripts`
 * so jest can call them with plain mocks.
 */

import type { PushIntent } from './intent-queue';

/** Injected at build time by esbuild's `define` option. */
declare const __SW_PUSH_VERSION__: string;

export const SW_PUSH_VERSION: string =
  typeof __SW_PUSH_VERSION__ === 'string' ? __SW_PUSH_VERSION__ : 'unversioned';

/**
 * Mirrored from `@pu-stats/models#SUPPORTED_REMINDER_LOCALES`. Inlined so
 * the sw-push bundle stays self-contained (no cross-package import in the
 * SW). When adding a locale to the web project's `i18n.locales`, add it
 * here too, otherwise notification clicks for that locale fall back to
 * the default and route to `/de/app...` instead of the locale-prefixed
 * URL.
 */
export const SW_SUPPORTED_LOCALES = [
  'de',
  'en',
  'fr',
  'es',
  'it',
  'nl',
  'el',
  'no',
  'zh',
] as const;
export type SwLocale = (typeof SW_SUPPORTED_LOCALES)[number];
const SW_DEFAULT_LOCALE: SwLocale = 'de';

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
  /**
   * Persists what the user tapped before any window is involved. Injected
   * rather than imported so the handlers stay unit-testable without an
   * IndexedDB runtime — see `intent-queue.ts` for why the hand-off has to be
   * durable at all.
   */
  saveIntent(intent: PushIntent): Promise<void>;
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

export function resolveLocale(raw: unknown): SwLocale {
  if (typeof raw !== 'string') return SW_DEFAULT_LOCALE;
  // Trim before splitting so a payload with leading/trailing whitespace
  // (e.g. " en-US ") still resolves correctly. Aligned with the
  // server-side `normalizeReminderLocale` in @pu-stats/models.
  const primary = raw.trim().toLowerCase().split(/[-_]/)[0];
  return (SW_SUPPORTED_LOCALES as ReadonlyArray<string>).includes(primary)
    ? (primary as SwLocale)
    : SW_DEFAULT_LOCALE;
}

/**
 * Last-resort action labels used only when the dispatch CF doesn't ship
 * an `actions` array (legacy or malformed payload). The CF always sets
 * locale-aware actions, so duplicating the full 10-locale dictionary
 * here would just bloat the SW bundle for a path that's never hit in
 * practice — de/en covers every realistic legacy payload.
 */
function defaultActions(
  locale: SwLocale
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
