/**
 * Custom root service worker that extends ngsw-worker.js with push support.
 *
 * MUST be registered instead of ngsw-worker.js (at scope '/').
 * Imports ngsw first, then adds push/notificationclick handlers.
 *
 * push event: Shows the notification from the payload
 * notificationclick: Opens or focuses the app
 */
importScripts('ngsw-worker.js');

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'PushUp Stats', body: event.data.text() };
  }

  const title = data.title || 'PushUp Stats';
  const rawLocale = String(
    data.data?.locale || data.locale || ''
  ).toLowerCase();
  const isEnglish = rawLocale.startsWith('en');
  const defaultActions = isEnglish
    ? [
        { action: 'snooze', title: '⏰ Snooze 30 min' },
        { action: 'log', title: '✅ Log push-ups' },
      ]
    : [
        { action: 'snooze', title: '⏰ 30 Min snoozen' },
        { action: 'log', title: '✅ Eintragen' },
      ];
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge-72x72.png',
    tag: data.tag || 'reminder',
    renotify: data.renotify ?? true,
    data: { ...(data.data || {}), locale: rawLocale || undefined },
    actions: Array.isArray(data.actions) ? data.actions : defaultActions,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * `pushsubscriptionchange` is the W3C-spec event the browser fires when the
 * push service invalidates a subscription (FCM endpoint rotation, battery
 * optimiser kill, OS-level reset). Without a listener, Chrome/Edge rewrite
 * the local endpoint to `https://permanently-removed.invalid/...` and keep
 * returning that sentinel from `pushManager.getSubscription()` — producing
 * the zombie subscriptions that silently killed background push for weeks.
 *
 * Prefer `event.newSubscription` (some browsers provide it directly); when
 * absent, re-subscribe using the old options so the applicationServerKey
 * stays aligned with the server's VAPID pair. Then notify any open client
 * so it can save the new sub via the `savePushSubscription` callable.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        let newSub = event.newSubscription;
        const oldSub = event.oldSubscription;
        if (!newSub && oldSub) {
          newSub = await self.registration.pushManager.subscribe(
            oldSub.options
          );
        }
        if (!newSub) return;
        const clientList = await clients.matchAll({
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
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const rawLocale = String(event.notification.data?.locale || '').toLowerCase();
  const locale = rawLocale.startsWith('en') ? 'en' : 'de';

  if (action === 'snooze') {
    // Call snoozeReminder Firebase Function via postMessage to app
    event.waitUntil(
      clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          if (clientList.length > 0) {
            clientList[0].postMessage({
              type: 'SNOOZE_REMINDER',
              snoozeMinutes: 30,
            });
          } else {
            // App not open — open it with snooze param so it can call the function
            return clients.openWindow(`/${locale}/app?snooze=30`);
          }
        })
    );
    return;
  }

  if (action === 'log') {
    // Open app at dashboard to log push-ups
    event.waitUntil(clients.openWindow(`/${locale}/app?log=1`));
    return;
  }

  // Default: open/focus app
  const targetUrl = event.notification.data?.url || `/${locale}/app`;
  const fullUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === fullUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});
