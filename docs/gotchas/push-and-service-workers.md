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

`ServiceWorkerRegistration.showNotification(title, { actions })` accepts a list of buttons; when a label embeds a value (e.g. "✅ Log 25"), **the displayed value and the value the server later acts on must come from the same sanitized variable**. Computing them independently caused a real PR #249 regression: the title clamped to 500 via `sanitizeQuickLogReps` while the payload shipped raw `Math.floor(reminder.quickLogReps ?? 0)`, so 9999 push-ups were logged behind a button labelled "Log 500".

Pattern (CF `dispatchPushReminders`): sanitize once, pass the result to `buildReminderActions` **and** store it in `pendingAction.quickLogReps` next to the action token. The SW never sends a count — `reminderAction` writes the stored one, so a stale or tampered payload cannot pick a number.

## Notification actions are completed by the service worker, never by a window

Both channels the SW has to an app window lose or replay actions on an
installed Android PWA, and the two failure modes point in opposite directions:

- **`client.postMessage()` arrives late, not never.** A backgrounded PWA is
  _frozen_: `matchAll` still returns it, but the message sits in its queue until
  the tab thaws — which may be hours later, on an unrelated notification tap.
- **`openWindow('/app?quickLog=N')` replays.** Android resumes an existing PWA
  task instead of navigating, so the param never arrives; when it does arrive,
  it stays in the task's committed URL and every later resume re-runs it.
- **A durable intent store drained on resume is still a window hand-off.** The
  app applies whatever is stored whenever it happens to come to the front — a
  quick-log tapped minutes earlier surfaces on the next snooze tap and reads as
  "snooze logged push-ups".

Production symptom (Aug/Sep 2026, through three fix attempts): tapping
"⏰ 30 Min snoozen" created a 10/20-rep push-up entry when the app came up.

**Rule: a notification action is one HTTP call from the SW, authenticated by a
single-use token, and no app window takes part.** `dispatchPushReminders`
mints a random token per reminder, stores it as
`reminderDispatchState/{uid}.pendingAction` (with the sanitized `quickLogReps`
the button showed) and ships `data.reminderAction = {uid, token, url}` in the
push payload. On `notificationclick` the SW POSTs the token to the
`reminderAction` callable; the server verifies, consumes and applies it in one
transaction (`data-store/functions/src/push/reminder-action.ts`). Properties:

- **single-use** — verify + delete + write share a transaction, so a second
  tap, a retried request or a replayed SW event finds nothing pending.
- **time-bounded** — `REMINDER_ACTION_MAX_AGE_MS` is pinned to the dispatcher's
  `TTL: 1800`; a token older than the push it belongs to is refused.
- **server-authoritative count** — the reps written for `quick-log` come from
  the stored `pendingAction`, never from the request, so a tampered or stale
  payload cannot choose a number.
- **visible fallback** — a refusal, a missing token (older dispatcher payload)
  or a network error never logs silently: quick-log opens `/app?log=1` (the
  dialog), snooze shows a failure notification.

The SW confirms with a notification (`data.feedback`, localized by the
dispatcher) so the user gets an answer without opening the app; the app's
Firestore listeners pick the server write up on their own.

Deploy rollover: an old SW against the new dispatcher stores nothing and
opens the app on a tap (no app-side consumer remains); a new SW against an old
dispatcher has no token and falls back visibly. Neither writes a wrong entry.

The `snoozeReminder` callable stays deployed only because the non-interactive
prod deploy (`firebase deploy` without `--force`) aborts on function deletion;
nothing calls it any more.

## Notification deep-links are untrusted input

`?log=1` is the only deep link left and it only opens the entry dialog — nothing persists without a further tap. Any future param that writes data would replay on Android (see above); route it through `reminderAction` instead.

## Source attribution

Every entry created from a notification button is written by `reminderAction` with `source: 'reminder'`, so source-based filtering and analytics have a single writer to trust.
