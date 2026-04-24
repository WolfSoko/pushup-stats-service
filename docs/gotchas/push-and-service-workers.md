# Gotchas: Push Notifications & Service Workers

## Two-tier reminder system

In-app reminders use `ReminderService` with `setInterval`. Server-side reminders come from the `dispatchPushReminders` Cloud Function (runs every 5 min via Web Push).

## Browser API quirks

- **Android Chrome does NOT support `new Notification()`** — always use `ServiceWorkerRegistration.showNotification()` with a `new Notification()` fallback for desktop/dev.
- **Never use `navigator.serviceWorker.ready`** in async code paths — it hangs forever when no SW is registered (dev mode: `enabled: !isDevMode()`). Use `navigator.serviceWorker.getRegistration()` which resolves immediately with `undefined`.
- **`renotify: true`** is not in the TypeScript `NotificationOptions` type — cast with `as NotificationOptions`.

## Subscription vs reminder toggle

**Push subscription ≠ reminder toggle.** They are separate actions. Auto-subscribing to push when enabling reminders must only happen on first enable (not every save) to respect explicit push opt-out.

## VAPID keys

- **Public key** lives in `web/src/env/firebase-runtime.ts` (`firebase-runtime.staging.ts` has a separate key for staging).
- **Private key** lives in Firebase Secrets (`VAPID_PRIVATE_KEY`).

## Cloud Function lease handling

`dispatchPushReminders` uses a transactional lease (`inProgress` flag) to prevent duplicate sends. **Always release the lease in `finally`** — any early return path that skips the release leaves the lease stuck until the next write to the doc.
