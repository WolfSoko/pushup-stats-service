/**
 * Root entrypoint for the push service worker.
 *
 * Deployed to `/push/sw-push.js` with scope `/push/`. Isolated from the
 * Angular service worker (`ngsw-worker.js` at `/`) so push/notification
 * logic can evolve independently of Angular's cache layer. The two
 * registrations coexist — browsers route push events to whichever
 * registration owns the active subscription.
 *
 * Version stamp (`__SW_PUSH_VERSION__`) is injected at build time by
 * `libs/sw-push/build.mjs` and surfaces in the first byte of the bundle,
 * so every rebuild produces a byte-diff and browsers reliably pick up the
 * new worker on update-check.
 */
/// <reference lib="webworker" />

import {
  handleNotificationClick,
  handlePush,
  handlePushSubscriptionChange,
  SW_PUSH_VERSION,
  type NotificationClickEventLike,
  type PushEventLike,
  type PushSubscriptionChangeEventLike,
  type SwContext,
} from './handlers';

declare const self: ServiceWorkerGlobalScope;

// Keep the version visible in DevTools' source panel + in any error reports.
(self as unknown as { __SW_PUSH_VERSION__: string }).__SW_PUSH_VERSION__ =
  SW_PUSH_VERSION;

const ctx: SwContext = {
  registration: self.registration,
  clients: self.clients,
  origin: self.location.origin,
};

self.addEventListener('push', (event) => {
  handlePush(event as unknown as PushEventLike, ctx);
});

self.addEventListener('pushsubscriptionchange', (event) => {
  handlePushSubscriptionChange(
    event as unknown as PushSubscriptionChangeEventLike,
    ctx
  );
});

self.addEventListener('notificationclick', (event) => {
  handleNotificationClick(event as unknown as NotificationClickEventLike, ctx);
});
