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
- **The first-write rebuild fetch needs a composite index.** On the first entry for a (user, exercise) — and on a `USERSTATS_VERSION` bump — the trigger rebuilds the aggregate from the user's full history with `where('userId','==').where('exerciseId','==').orderBy('timestamp')`. An equality-filtered query ordered by another field is served **only** from a composite index over `(…equality fields…, orderBy field)`. `rebuildUserStats` queries `pushups` with one equality, so `pushups (userId, timestamp)` is enough; `updateExerciseStatsOnEntryWrite` adds the `exerciseId` equality, so it needs `exerciseEntries (userId, exerciseId, timestamp)`. That second index was missing, so the trigger threw `FAILED_PRECONDITION` on the first entry of every non-pushup exercise, `userStats/{uid}/perExercise/{exerciseId}` was never written, and the per-exercise **"Alle Zeit"** leaderboard stayed empty (pushup hid it — its aggregate is seeded by `backfillPushupPerExerciseStats`, not the rebuild query). Any new `where(==)…orderBy(other)` query must ship its composite index in `firestore.indexes.json`; `firestore-indexes.spec.ts` guards the aggregation triggers' indexes.

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
// In updateExerciseStatsOnEntryWrite:
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

## Public-projection pattern (private docs → anonymous-readable surface)

When you need to expose a sanitized subset of an owner-only Firestore doc to anonymous callers (e.g. `/u/:uid` public profiles), do NOT widen Firestore rules. Use a callable that reads via Admin SDK and returns a **whitelisted** projection, with a regression spec asserting the output keys are a subset of an explicit allowlist (`Set` of allowed keys). See `data-store/functions/src/profile/public-profile.ts` + spec for the canonical implementation.

**Privacy gates:**

- Opt-in flag must be `=== true`, never truthy. Defaults to private.
- Map both "user does not exist" and "user is private" to the same `not-found` response so account existence cannot be probed by walking UIDs.
- Map invalid/malformed UIDs to the same `not-found` (not `invalid-argument`) so the public route stays on one consistent UX/privacy path.

## `onCall` vs `onRequest` for anonymous endpoints

- `onCall` requires a CORS preflight + Firebase SDK envelope and is awkward for raw `<img>` / crawler use cases. Use it for callable RPCs from authenticated clients.
- `onRequest` is plain HTTP — needed when crawlers, social-card scrapers, or `<img src>` consume the response directly (e.g. dynamic OG images). Set `invoker: 'public'` to skip auth.
- Firebase UID range: `1` to `128` characters, charset is implementation-defined but URL-safe in practice. Custom UIDs (test fixtures, custom-token flows) can be much shorter than the 28-char anonymous default — don't impose a minimum length floor in validators or you'll lock out valid users.

## Shipping deps with WASM/native bytes

`@nx/esbuild` with `thirdParty: false` keeps `node_modules` external; with `generatePackageJson: true` new deps just get registered in the emitted `package.json` and Cloud Functions npm-installs them at deploy.

For deps that load WASM at runtime (e.g. `@resvg/resvg-wasm`), use `createRequire(__filename).resolve('@resvg/.../index_bg.wasm')` to locate the file inside the deployed `node_modules` tree — relative paths from `import.meta` don't work in CJS bundles. Cache the `initWasm()` result in module scope; cold start runs it once, warm starts skip.

## Lazy-load heavy renderers (satori, puppeteer, sharp, …)

All Cloud Functions in this repo share a single `index.ts` bundle, so any module imported at the top of `index.ts` (or re-exported from a shared barrel like `./profile/index.ts`) initialises in **every** function's cold start — even ones that never touch it. For deps over a few megabytes (satori + `@resvg/resvg-wasm` is ~15 MB combined), that's an unacceptable tax on unrelated triggers.

Pattern:

```ts
export const ogProfile = onRequest(
  {
    /* … */
  },
  async (req, res) => {
    // …Firestore reads, validation, 404 path…

    const { renderProfileOg } = await import('./profile/og-render');
    const png = await renderProfileOg(projection);
    // …
  }
);
```

And keep the heavy module **out** of the shared `./profile/index.ts` barrel — direct path imports (`./profile/og-render`) inside the dynamic `import()` only.

The renderer caches its own state (font bytes, `initWasm()` result) in module scope, so the dynamic import runs once per warm container and is free thereafter. First OG request after a cold start still pays the full cost — bump function memory (`512MiB` minimum for satori) and `timeoutSeconds` accordingly.
