# stats-data-access-state

Reactive read-models (signal stores) layered on top of `@pu-stats/data-access`.

`@pu-stats/data-access` is intentionally stateless (pure Firestore API surface).
This lib owns the stores that subscribe to those API services and expose live
signals to the rest of the app:

- `LiveDataStore` — Firestore real-time pushup + exercise entries for the
  current user, plus an update tick. Browser-only.
- `LeaderboardStore` — cached leaderboard data with `load({ force })` and a
  live refresh hook driven by `LeaderboardService.observeSnapshot()`.

Importers: `web/src/app/**` only. API-service consumers (e.g. `@pu-reminders/reminders`,
`@pu-push/push`) keep depending on `@pu-stats/data-access` directly and must
NOT import from this lib.

## Running unit tests

Run `nx test stats-data-access-state` to execute the unit tests.
