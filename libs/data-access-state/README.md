# stats-data-access-state

Reactive read-models (signal stores) layered on top of `@pu-stats/data-access`.

`@pu-stats/data-access` is intentionally stateless (pure Firestore API surface).
This lib owns the stores that subscribe to those API services and expose live
signals to the rest of the app:

- `LiveDataStore` — Firestore real-time pushup + exercise entries for the
  current user, plus an update tick. Browser-only.
- `LeaderboardStore` — cached leaderboard data with `load({ force })` and a
  live refresh hook driven by `LeaderboardService.observeSnapshot()`.

Allowed importers (per `@nx/enforce-module-boundaries`): `scope:app`
(`web/src/app/**`) and `scope:reminders`. Other libs (e.g. `@pu-push/push`)
keep depending on `@pu-stats/data-access` directly for the stateless API
services — they shouldn't reach for signal stores.

## Running unit tests

Run `nx test stats-data-access-state` to execute the unit tests.
