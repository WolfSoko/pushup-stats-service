# Gotchas: Cloud Functions

## Deploy path restriction

**Firebase deploy path:** `functions.source` in `firebase.json` **must** be inside the Firebase project directory (`data-store/`). Parent-relative paths (`../dist/...`) are rejected by Firebase CLI.

## `defineSecret()` requires IAM setup

When introducing a new `defineSecret('FOO')` in `data-store/functions/src/**`, the prod Cloud Functions deploy **WILL fail** until the runtime SA (`<project-number>-compute@developer.gserviceaccount.com`) has `roles/secretmanager.secretAccessor` on the secret.

A freshly created Secret Manager secret has **zero IAM bindings** (`gcloud secrets get-iam-policy NAME` returns only `etag: ACAB`), and the prod deploy SA intentionally does **not** have `secretmanager.admin` to grant it automatically.

**Fix:** add the secret name to the `SECRETS=(…)` array in `infra/setup-prod-secrets.sh` and run the script. It's idempotent and resolves the runtime SA dynamically from the project number.

## Delta-based aggregation pitfalls

- **Timestamp changes on update:** When an entry's timestamp changes on update, a single delta is wrong — it must be split into undo-old + apply-new. Otherwise the old day/week/month/heatmap bucket is never decremented.
- **Fields that can't be maintained incrementally** (like `totalDays` — counting unique days) require heuristic tracking or periodic `rebuildFromEntries()` to stay accurate.
- **`bestDay` and `bestSingleEntry`** can only grow via deltas. When entries are deleted, a rebuild is needed to find the true new best.

## UserStats versioning system

**Version tracking enables automatic rebuilds when calculation logic changes:**

- Every `UserStats` rebuild sets `version: USERSTATS_VERSION`
- Cloud Function checks: `if (stored.version < USERSTATS_VERSION) → auto-rebuild`
- New users: Auto-rebuild on first entry ensures correct initialization with today's period keys

### Version changelog

- **v1:** Legacy (no versioning)
- **v2:** Fixed period keys to use TODAY (not last entry date in rebuild)
- **v3:** Fixed `berlinParts()` to treat offset-less timestamps as Berlin local time
- **v4:** Added sets aggregation fields (`totalSets`, `avgSetSize`, `bestSingleSet`)

### How it works

```typescript
// In updateUserStatsOnPushupWrite:
if (existingStats.version < USERSTATS_VERSION) {
  // Fetch all entries and call rebuildFromEntries —
  // automatically applies calculation improvements
  logger.info('Auto-rebuild on version upgrade', {
    oldVersion: existingStats.version,
    newVersion: USERSTATS_VERSION,
  });
}
```

### Future deployments

Increment `USERSTATS_VERSION` in `@pu-stats/models`. Affected users automatically rebuild on next entry without manual intervention.

## Pure business logic modules

Keep Cloud Function business logic in separate pure modules (e.g. `user-stats-delta.ts`) for unit testing without Firestore mocks. The trigger functions in `index.ts` are thin wrappers. See [`testing.md`](testing.md) for the testing pattern.
