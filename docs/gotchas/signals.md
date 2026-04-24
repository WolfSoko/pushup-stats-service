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

## Display-defaulted signals vs "is this configured?"

Several signals in the app return defaulted values for display convenience:

- `AppDataFacade.dailyGoal` returns `?? 100` when no user config.
- `DashboardStore.setDailyGoal(0)` coerces `0 → 1` (via `Math.max(1, ...)`).
- `stats-dashboard.component.ts` substitutes `cfg.dailyGoal || 10` on load.

Don't use these signals as a "goal is configured" guard — they always look configured. Derive visibility from the **raw resource value**: `userConfigResource.value()?.dailyGoal ?? 0` (falsy ⇒ hide). Display math can still use the defaulted signal.

Applies to any other settings signal with similar defaulting (weekly/monthly goals, reminder interval, etc.).
