# Sentry Observability

End-to-end reference for how Sentry is wired up in this project — SDKs, release identifiers, source map upload, secret bindings, and the gotchas that bite during initial setup.

Read this **before** touching any of:

- `scripts/upload-sentry-sourcemaps.sh`
- `apphosting.yaml` / `apphosting.staging.yaml` (`SENTRY_AUTH_TOKEN` references, `scripts.buildCommand`)
- `.github/workflows/firebase-hosting-merge.yml` (`Upload source maps to Sentry` step)
- `Sentry.init(...)` calls in `web/src/main.ts`, `web/src/server.ts`, `data-store/functions/src/index.ts`

## SDKs and where they run

| Surface | SDK | Init location | Active when |
| --- | --- | --- | --- |
| Browser | `@sentry/angular` | `web/src/main.ts` | `!isDevMode() && !useEmulators` |
| SSR server | `@sentry/node` | `web/src/server.ts` | `NODE_ENV === 'production'` |
| Cloud Functions | `@sentry/node` | `data-store/functions/src/index.ts` | always (no guard) |

Angular providers (`Sentry.createErrorHandler()`, `Sentry.TraceService`) are registered in `web/src/app/app.config.ts`, gated by the same `!isDevMode() && !useEmulators` predicate as `Sentry.init()`.

## Release identifier

Short git SHA (e.g. `abc1234`). No semantic versioning — releases are 1:1 with commits, which gives clean "Suspect Commits" linkage in Sentry without any extra coordination.

| Surface | How the release reaches `Sentry.init({ release })` |
| --- | --- |
| Browser | `scripts/upload-sentry-sourcemaps.sh` injects `<script>globalThis.SENTRY_RELEASE="<sha>";</script>` into every `index.html` and `index.csr.html`. `main.ts` reads `globalThis.SENTRY_RELEASE`. |
| SSR server | Reads `process.env['GIT_SHA']` (set by App Hosting / Cloud Run). |
| Cloud Functions | Reads `process.env['SENTRY_RELEASE']` from the deployed `.env` file. The upload script writes/replaces a single `SENTRY_RELEASE=<sha>` line in `data-store/functions-dist/.env` so re-runs don't accumulate duplicates. |

The HTML injection is **idempotent**: the script first deletes any prior `globalThis.SENTRY_RELEASE` script tag before inserting the new one. Re-running on the same `dist/` doesn't double-tag.

## The upload script (`scripts/upload-sentry-sourcemaps.sh`)

Lifecycle steps (matches the latest Sentry Wizard guidance for Angular):

1. `sentry-cli releases new <sha>` — idempotent, dedupes by name.
2. `sentry-cli releases set-commits <sha> --auto --ignore-missing` — links commits for the "Suspect Commits" feature. `--ignore-missing` prevents the deploy from failing when the Sentry GitHub integration isn't configured.
3. Inject `<script>globalThis.SENTRY_RELEASE=...</script>` into HTML.
4. `sentry-cli sourcemaps inject dist/web` — embeds debug IDs into JS bundles + `.map` files.
5. `sentry-cli sourcemaps upload --release=<sha> --strict dist/web` — `--strict` makes silent skips (the historical bug) impossible.
6. Same inject + upload for `data-store/functions-dist/` (when present), then strip `.map` files from there.
7. Strip `.map` files from `dist/web` so they don't ship to production.
8. `sentry-cli releases finalize <sha>`.

**Idempotency / safety properties** — the script is intentionally safe to invoke multiple times in the same workspace:

- No-op when `SENTRY_AUTH_TOKEN` is unset (so local builds + uninitialized App Hosting backends don't break the pipeline).
- No-op when `dist/web` doesn't exist (run order tolerant).
- Skips inject + upload for `dist/web` when zero `.map` files are found (a second run after `.map` cleanup would otherwise fail under `--strict`).
- Same `.map`-count guard for `data-store/functions-dist/`.
- `set -euo pipefail` on top — any unhandled failure aborts the build instead of silently passing.

## `SENTRY_AUTH_TOKEN` is needed in TWO places

This is the gotcha that originally caused production stack traces to stay minified for weeks. Two **independent** build pipelines deploy production code, and each one needs its own access to the auth token:

### 1. GitHub Actions (Hosting + Cloud Functions deploy)

- Source: GitHub repo Secret named `SENTRY_AUTH_TOKEN`.
- Consumed by: `.github/workflows/firebase-hosting-merge.yml`, `Upload source maps to Sentry` step (step-level `env:` — NOT job-level — so the token isn't exposed to other steps).
- Covers: the static Hosting artifact + Cloud Functions bundles.

### 2. Firebase App Hosting (Cloud Run SSR build that serves `pushup-stats.de`)

- Source: Cloud Secret Manager secret named `SENTRY_AUTH_TOKEN` in the GCP project (`pushup-stats` for prod, `pushup-stats-staging-867b7` for staging).
- Consumed by: `apphosting.yaml` `env` block with `availability: BUILD`. The override in `scripts.buildCommand` runs `pnpm sentry:sourcemaps` after the Angular build inside Cloud Build.
- Covers: the SSR + browser bundles actually served at `pushup-stats.de`.

**Without #2**, the bundles deployed to Cloud Run carry debug IDs that don't match anything in Sentry → every production stack trace is minified. This is invisible until someone hits an error and tries to debug it.

### One-time setup for App Hosting (per environment)

```bash
# Production
gcloud secrets create SENTRY_AUTH_TOKEN \
  --replication-policy=automatic \
  --project pushup-stats
echo -n "<token>" | gcloud secrets versions add SENTRY_AUTH_TOKEN \
  --data-file=- --project pushup-stats
firebase apphosting:secrets:grantaccess SENTRY_AUTH_TOKEN \
  --backend pushup-stats-service --project pushup-stats

# Staging — only needed if apphosting.staging.yaml keeps the SENTRY_AUTH_TOKEN
# secret reference. Otherwise PR-preview rollouts will fail with "secret not found".
gcloud secrets create SENTRY_AUTH_TOKEN \
  --replication-policy=automatic \
  --project pushup-stats-staging-867b7
# ... same pattern as above with --project pushup-stats-staging-867b7
```

### Auth token scopes

Generate the token at https://wolsok.sentry.io/settings/auth-tokens/ with:

- `org:ci`
- `project:releases`
- `project:write`

## Config

- **Org / project:** `.sentryclirc` at the repo root (`org=wolsok`, `project=pushup-stats`).
- **DSNs:** hardcoded in `web/src/main.ts`, `web/src/server.ts`, `data-store/functions/src/index.ts` (same DSN for all three — public, safe to commit).
- **Environment tag:** `production` for browser + SSR; CF defaults to `production` but can be overridden via `SENTRY_ENVIRONMENT`.

## Verifying a release after deploy

1. **Release exists:** check `https://wolsok.sentry.io/releases/?project=4511089937219584` for the new `<sha>`.
2. **Runtime tag matches:** in Sentry, an event from production should show the `release` tag equal to the deployed SHA (look at any recent transaction or error).
3. **Debug IDs in bundles:** an authenticated browser fetch of `https://pushup-stats.de/de/main-*.js` should contain the `_sentryDebugIds=...` snippet near the top (this is the proof that App Hosting's build ran the upload script).
4. **Stack traces resolve:** the next production error should land in Sentry with file paths like `web/src/app/<component>.ts:42:18` instead of `chunk-XYZ.js:1:144929`.

If (1) and (2) hold but (4) doesn't, the most likely cause is that App Hosting's `SENTRY_AUTH_TOKEN` isn't bound — releases get created via GitHub Actions but the runtime bundles deployed via App Hosting carry mismatched debug IDs.

## Related: SSR `NG_ALLOWED_HOSTS`

`apphosting.yaml` lists `*.run.app` in `NG_ALLOWED_HOSTS` because Firebase App Hosting routes through Cloud Run revision URLs (`t-<id>---pushup-stats-service-<hash>-<region>.a.run.app`) during rolling deploys. Angular SSR (`@angular/ssr`'s `isHostAllowed`) only treats entries starting with `*.` as wildcards — a bare leading dot is matched literally and would NOT cover the revision URLs. Without this, the SSR server returns 400 during rolling deploys.

This is unrelated to Sentry but lives in the same `apphosting.yaml`, so flagged here.
