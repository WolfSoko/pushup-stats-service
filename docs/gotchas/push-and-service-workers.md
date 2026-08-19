# Gotchas: Push Notifications & Service Workers

## Two-tier reminder system

In-app reminders use `ReminderService` with `setInterval`. Server-side reminders come from the `dispatchPushReminders` Cloud Function (runs every 5 min via Web Push).

## The update prompt must not live in a snackbar alone

`MatSnackBar` is a singleton: every `open()` dismisses whatever is currently
displayed. The app opens routine toasts from ~a dozen call sites (quick-add,
training plans, feedback, reminders), and `VERSION_READY` fires **exactly once**
per downloaded version — so the sticky reload prompt was regularly wiped by the
next "Eintrag gespeichert" toast and never came back. Users reported never
seeing an update notice at all.

`SwUpdateService` (`web/src/app/core/sw-update.service.ts`) latches the event
into an `updateAvailable` signal that stays set until the user reloads. The
toolbar renders it as a persistent button; the snackbar is only the loud,
transient half of the notice. Anything that has to survive a competing toast
belongs in that signal, not in the snackbar.

The service also re-opens the prompt (and skips the manifest check) on
`visibilitychange → visible`, which is what actually reaches a PWA the user
resumes hours after a deploy — background tabs get their `interval` timers
throttled, so the 10-minute poll alone is not enough.

## ngsw update prompt: `activateUpdate()` before `reload()`

`SwUpdate.versionUpdates` fires `VERSION_READY` when ngsw has downloaded a new version, but the new worker stays in `installed/waiting` until the **last** client of the old worker is gone. A plain `window.location.reload()` does not qualify — it just opens another navigation against the still-active old worker, so the user taps "Neu laden", the page reloads, and they keep seeing the old build until every tab is closed.

Always call `await swUpdate.activateUpdate()` first, then `reload()`
(`SwUpdateService.applyUpdate()`):

```ts
try {
  await swUpdate.activateUpdate();
} catch {
  // no waiting worker (UNRECOVERABLE_STATE) — reload anyway
}
window.location.reload();
```

`SwUpdate.unrecoverable` needs the same treatment: ngsw has lost the version it
was serving and cannot self-heal, so the page keeps running on stale in-memory
code until someone reloads it. Left unhandled it looks exactly like "the app
stopped updating".

## ngsw doesn't poll — long-lived PWA/TWA sessions miss updates

`SwUpdate` only checks the manifest once on app stabilisation (`registerWhenStable:2000` in `app.config.ts`). PWA / TWA users who never close the tab consequently **never** receive `VERSION_READY` after a deploy. Poll explicitly, and pair the timer with a visibility hook:

```ts
merge(interval(10 * 60 * 1000), fromEvent(document, 'visibilitychange').pipe(filter(() => document.visibilityState === 'visible')))
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(() => void swUpdate.checkForUpdate());
```

Symptom that points here: "the SW update notification stopped working after deploys" while DevTools shows the new ngsw is registered but stuck in `waiting`.

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

Defense-in-depth: clamp again in the SW handler (`libs/sw-push/src/notification-click.ts`) and in `QuickLogService`. Stale payloads from older SW deployments stay in the push queue for `TTL: 1800` seconds and can outlive a server-side validator change.

## Neither postMessage nor a query param delivers a notification action

Both channels the SW has to an app window lose actions on an installed Android
PWA, and they lose them in opposite directions:

- **`client.postMessage()` arrives late, not never.** A backgrounded PWA is
  _frozen_: `matchAll` still returns it, but the message sits in its queue until
  the tab thaws — which may be hours later, on an unrelated notification tap.
  It is not a dropped message, it is a **delayed** one, and that is worse: the
  handler cannot tell a fresh tap from a stale one.
- **`openWindow('/app?quickLog=N')` replays.** Android resumes an existing PWA
  task instead of navigating, so the param never arrives. When it does arrive,
  it stays in the task's committed URL, and **every later resume re-runs the
  deep link**.

Production symptom (Aug 2026): tapping "⏰ 30 Min snoozen" created a 20-rep
push-up entry. The snooze tap only _resumed_ the app; the resume replayed a
quick-log the user had tapped earlier. Four such entries were written, one at
02:05 — inside the user's own quiet hours, when the dispatcher had sent nothing
at all. Meanwhile `snoozeReminder` had zero invocations for over three months.

**Rule: a notification action must be recorded durably before any window is
involved.** `libs/sw-push/src/intent-queue.ts` writes `{id, type, createdAt}`
to IndexedDB; `PushIntentDrainService` claims intents by reading and clearing
them in one transaction, and discards anything older than `PUSH_INTENT_MAX_AGE_MS`
(pinned to the dispatcher's `TTL: 1800`). Two properties do the work:

- **single-use** — read-and-clear share a transaction, so overlapping triggers
  (SW nudge + `visibilitychange`) cannot double-apply. At-most-once is the
  deliberate trade: a dropped snooze costs one reminder, a replayed quick-log
  writes an entry the user never asked for.
- **time-bounded** — a late drain discards instead of acting. This is what makes
  the frozen-tab case safe rather than merely unlikely.

The `postMessage` that remains is a _nudge_ carrying no payload, and the drain
runs on three triggers because none is reliable alone: auth-resolved (cold
start), the SW nudge (app responsive), and `visibilitychange → visible` (the
frozen tab that Android just resumed without navigating).

Corollary: **`focus()` is what thaws a frozen client.** Quick-log always called
it and appeared to work; snooze did not, and appeared broken. Any handler that
waits on a client answering must focus it first.

Deploy rollover: the SW and the app update independently, so for up to ~24h a
device can run an old SW against a new app (its `QUICK_LOG_PUSHUPS` message and
`?quickLog=` link are ignored — quick-log no-ops) or a new SW against an old app
(intents pile up unread and expire — snooze is lost). Both self-heal; neither
writes a wrong entry.

## Notification deep-links are untrusted input

The count no longer round-trips through the URL (see above — that link replayed), but it still round-trips through the notification payload and the intent store, so it stays untrusted: clamp into the valid range in the SW _and_ before persisting in `QuickLogService`.

## Source attribution must be consistent across paths

A single user action ("tap notification button") reaches the app through one of two timings depending on whether a window is already open — both now end in the same `QuickLogService.logEntry`, so the attribution cannot drift:

- **App open** → SW nudges the client, which drains the intent immediately.
- **App closed** → SW opens `/{locale}/app`; the app drains the intent on boot.

Both must set the same `source`, otherwise source-based filtering/analytics quietly drift apart.
