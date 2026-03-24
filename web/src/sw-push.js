/**
 * Custom push handler extending ngsw-worker.js.
 * This script is registered as an additional service worker script.
 *
 * push event: Shows the notification from the payload
 * notificationclick: Opens or focuses the app
 */

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
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/dashboard';
  const fullUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url === fullUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});
