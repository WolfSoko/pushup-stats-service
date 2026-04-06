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
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge-72x72.png',
    tag: data.tag || 'reminder',
    renotify: data.renotify ?? true,
    data: data.data || {},
    actions: [
      { action: 'snooze', title: '⏰ 30 Min snoozen' },
      { action: 'log', title: '✅ Eintragen' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const locale = event.notification.data?.locale || 'de';

  if (action === 'snooze') {
    // Call snoozeReminder Firebase Function via postMessage to app
    event.waitUntil(
      clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          if (clientList.length > 0) {
            clientList[0].postMessage({ type: 'SNOOZE_REMINDER', snoozeMinutes: 30 });
          } else {
            // App not open — open it with snooze param so it can call the function
            return clients.openWindow(`/${locale}/?snooze=30`);
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
