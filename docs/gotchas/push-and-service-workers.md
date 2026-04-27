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

## Notification action data must match the action title

`ServiceWorkerRegistration.showNotification(title, { actions })` accepts a list of buttons; the click payload is delivered to `notificationclick` with the original `notification.data`. When the button label embeds a value (e.g. "✅ Log 25"), **derive the displayed value and the data payload from the same sanitized variable**. Computing them independently caused a real PR #249 regression: the title clamped to 500 via `sanitizeQuickLogReps` while `data.quickLogReps` shipped raw `Math.floor(reminder.quickLogReps ?? 0)`, so the SW silently logged 9999 push-ups when the user tapped a button labelled "Log 500".

Pattern (CF `dispatchPushReminders`):

```ts
const quickLogReps = sanitizeQuickLogReps(reminder?.quickLogReps);
const actions = buildReminderActions(lang, quickLogReps);
const payload = JSON.stringify({
  // ...
  data: { url, locale, ...(quickLogReps ? { quickLogReps } : {}) },
  actions,
});
```

Defense-in-depth: clamp again in the SW handler (`libs/sw-push/src/handlers.ts`) and in the in-app listener (`QuickLogListenerService`). Stale payloads from older SW deployments stay in the push queue for `TTL: 1800` seconds and can outlive a server-side validator change.

## Notification deep-links are untrusted input

When the SW falls back to `clients.openWindow('/app?quickLog=N')` (no client open), the count round-trips through the URL. Treat it like any user-controllable input: clamp into the valid range before persisting. The same handler covers two callers (legitimate notification click + URL-tampered reload), so the validation lives at the dashboard, not at the SW.

## Source attribution must be consistent across paths

A single user action ("tap notification button") can route through two code paths depending on whether an app tab is already open:

- **App open** → SW posts `QUICK_LOG_PUSHUPS` to the client; client writes `source: 'reminder'`.
- **App closed** → SW opens `/app?quickLog=N`; dashboard writes `source: 'reminder'`.

Both must set the same `source`, otherwise source-based filtering/analytics quietly drift apart. Add a regression test that asserts both paths produce the same `source`.
