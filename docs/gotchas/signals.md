# Gotchas: Angular Signals

## `toSignal()` timing — signals lag async operations

`toSignal()` starts with `undefined` and updates via microtask. After async auth operations (e.g. `signInWithPopup`), signals may not yet reflect the new state when the promise resolves. Use `auth.currentUser` (synchronous) as fallback where immediate access is needed — see `LoginUiStore`, `RegisterUiStore`, `AuthService.upgradeWithEmail()` for the pattern.

For templates, use `authResolved` (= `authState() !== undefined`) to distinguish "loading" from "not authenticated".

## `toSignal()` default equality drops mutated same-reference emissions

Firebase reuses the **same** `User` object after `linkWithCredential` (guest → account upgrade) and mutates `isAnonymous` in place. `toSignal()`'s default `Object.is` equality check silently drops those emissions, so downstream computeds (e.g. `AuthStore.isGuest`) stay stuck at the pre-mutation value — the preview banner never hides after upgrade (see closed issue #143).

Fix: wrap the observable with `{ equal: () => false }` so every emission propagates. See `libs/auth/src/lib/adapters/to-auth-user-signal.ts` for the pattern:

```ts
export function toAuthUserSignal(obs$: Observable<User | null>): Signal<User | null | undefined> {
  return toSignal(obs$, { equal: () => false });
}
```

When forcing propagation, **dedupe at a higher layer** so effects don't over-fire on routine token refreshes. The fix for #143 added `{ equal: sameUserIdentity }` on `AuthService.user` (comparing `uid`/`isAnonymous`/`email`/etc.) so `reminderOrchestrationService`'s effect only re-runs when the user identity actually changes.

## General principle

Any `toSignal()` wrapping an observable that emits objects which may be mutated in place needs either:

- `{ equal: () => false }` plus downstream dedup, OR
- A `.pipe(map(x => ({ ...x })))` to break reference equality

## Clock-derived computeds need a reactive dependency

`computed(() => toBerlinIsoDate(new Date()))` looks fine but is a **stale-data trap**: the computed has no signal dependency, so Angular memoises the first result for the entire lifetime of the injector. In a long-running PWA session that crosses midnight, `today()` keeps returning yesterday's date — even though `new Date()` would give the right answer if it were called fresh — and any flag/bucket/key derived from it stays anchored to day 1.

`GoalReachedNotificationService` hit this exact bug: the daily celebration suppressed itself on day 2 because both the dialog gating key and the entry filter pulled from a `todayBerlin` that never recomputed.

Fix: tie clock-derived computeds to a signal that _does_ change when the user could possibly observe a different "now" — typically the live data signal that triggers whatever consumes the date:

```ts
private readonly todayBerlin = computed(() => {
  this.entries(); // tracking dependency: re-evaluate `new Date()` on any data change
  return toBerlinIsoDate(new Date());
});
```

Alternatives, depending on the use case:

- A wall-clock `setInterval` that bumps a `tick` signal at midnight.
- Convert the function from `computed` to a plain method so each call re-reads `Date.now()`.

Don't rely on the natural recomputation of consumers — if `todayBerlin` is read from another `computed`, that consumer only re-runs when _its_ dependencies change. The clock-derived signal itself must declare a reactive dep.

## `localStorage` getter can throw — wrap the access, not just the calls

`globalThis.localStorage` itself is a getter. In Safari private mode, sandboxed iframes, embedded webviews, or any context where storage is disabled, _touching_ it throws `SecurityError` synchronously — before any `getItem` / `setItem` call. A guard like:

```ts
const ls = globalThis.localStorage; // ← can throw
if (!ls) return;
try {
  ls.removeItem(key);
} catch {}
```

still aborts module / service construction. Wrap the **entire** access, including the getter read and any derived data, inside the try block:

```ts
try {
  const ls = globalThis.localStorage;
  if (!ls) return;
  // ...derive keys, iterate, mutate...
} catch {
  // Storage unavailable / SecurityError — best-effort.
}
```

The `readFlag`/`writeFlag` helpers in `goal-reached-notification.service.ts` follow this pattern. Apply it anywhere a `providedIn: 'root'` service touches `localStorage`/`sessionStorage` during construction — a single uncaught `SecurityError` there breaks the whole app, not just the feature.

## Display-defaulted signals vs "is this configured?"

Several signals in the app return defaulted values for display convenience:

- `AppDataFacade.dailyGoal` returns `?? 100` when no user config.
- `DashboardStore.setDailyGoal(0)` coerces `0 → 1` (via `Math.max(1, ...)`).
- `stats-dashboard.component.ts` substitutes `cfg.dailyGoal || 10` on load.

Don't use these signals as a "goal is configured" guard — they always look configured. Derive visibility from the **raw resource value**: `userConfigResource.value()?.dailyGoal ?? 0` (falsy ⇒ hide). Display math can still use the defaulted signal.

Applies to any other settings signal with similar defaulting (weekly/monthly goals, reminder interval, etc.).
