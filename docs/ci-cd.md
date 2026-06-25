# CI/CD & Deployment

How code reaches production and staging. AGENTS.md keeps the high-level rule (no deploy bypasses CI); details live here.

## CI Pipeline

- **Workflow** (`.github/workflows/ci.yml`): Runs lint, test, build, e2e on every push to `main` and on PRs.
- **Agent pool:** Nx Cloud dynamic distribution — see `.nx/workflows/distribution-config.yaml`. Details in [`gotchas/build-and-tooling.md`](gotchas/build-and-tooling.md).
- **Deploy gate:** CI fast-forwards the `deploy` branch from `main` only after all checks pass (`promote-to-deploy` job). Both deployment targets watch this branch.

## Deployment Targets

- **Firebase Hosting** (static, `.github/workflows/firebase-hosting-merge.yml`): Triggers on push to `deploy` branch.
- **Firebase App Hosting** (SSR/Cloud Run, `apphosting.yaml`): Auto-deploys on push to `deploy` branch (configured in Firebase Console).
- **PR Previews** (`.github/workflows/firebase-hosting-pull-request.yml`): Full staging deployment on every PR (same-repo only) — see [Staging Environment](#staging-environment) below.
- **Rule:** No deployment path should bypass CI. Both Hosting and App Hosting are gated on green CI.
- **Sentry source maps:** The deploy workflow uploads source maps to Sentry after the production build (`pnpm sentry:sourcemaps`). Requires `SENTRY_AUTH_TOKEN` GitHub secret. See [`observability/sentry.md`](observability/sentry.md).

## Deploy Authentication (Workload Identity Federation)

Both deploy workflows authenticate to GCP **keylessly** via Workload Identity Federation — no long-lived service-account JSON key is stored in GitHub. Each run mints a GitHub OIDC token (`permissions: id-token: write`); GCP exchanges it for short-lived credentials scoped to this repo. `google-github-actions/auth` exports `GOOGLE_APPLICATION_CREDENTIALS`, which `firebase deploy` and `gcloud` consume automatically.

- **GitHub variables** read by the workflows (set by `infra/setup-wif.sh`): `WIF_PROVIDER` / `WIF_DEPLOY_SA` (prod) and `WIF_PROVIDER_STAGING` / `WIF_DEPLOY_SA_STAGING` (staging). These are non-sensitive variables, not secrets.
- **One-time GCP setup:** run [`infra/setup-wif.sh`](../infra/README.md#deploy-authentication-workload-identity-federation) (idempotent; provisions the deploy SA, WIF pool/provider, and repo variables for both projects).
- **Why:** the previous `FIREBASE_SERVICE_ACCOUNT_*` key-based auth broke when the SA key was disabled/expired with no warning. WIF removes the key entirely.
- The PR-preview workflow deploys its hosting channel with `firebase hosting:channel:deploy` and comments the preview URL via `gh pr comment` (replacing `FirebaseExtended/action-hosting-deploy`, which requires a key).

## Staging Environment

A separate Firebase project (`pushup-stats-staging-867b7`) provides full isolation for PR previews:

- **PR workflow deploys:** Hosting preview + Cloud Functions + Firestore rules & indexes to the staging project.
- **Web app build:** Uses `staging` configuration (`pnpm nx run web:build -c staging`) which swaps `fire.config.ts` → `fire.config.staging.ts` and `firebase-runtime.ts` → `firebase-runtime.staging.ts` (separate VAPID key for staging push notifications).
- **Staging config:** `web/src/env/fire.config.staging.ts` points to the staging project.
- **App Hosting config:** `apphosting.staging.yaml` (reduced `maxInstances: 1`).
- **Firebase alias:** `staging` alias in `data-store/.firebaserc`.
- **GitHub Secret required:** `FIREBASE_SERVICE_ACCOUNT_PUSHUP_STATS_STAGING` — service account JSON for the staging project (must be added in GitHub repo settings).
- **Firestore region:** `europe-west3` (Frankfurt). Must match when creating the database in Firebase Console.
- **Firestore rules & indexes** are shared source files (`data-store/firestore.rules`, `data-store/firestore.indexes.json`) deployed to both projects.
- **Infra scripts:** `infra/setup-staging.sh` automates full project setup (APIs, SA, IAM, secrets); `infra/teardown-staging.sh` removes deploy resources. Both support `--dry-run`.

## Firestore Rules — Adding a New Collection

`data-store/firestore.rules` ends with a deny-all fallback (`match /{document=**} { allow read, write: if false; }`). **Every new collection a client reads or writes needs a matching `match` block** — without it, authenticated users hit `permission-denied` in production. Both PR preview and merge deploy run `firebase deploy --only functions,firestore`, so the rules ship together with the code, but propagation can lag the hosting deploy by 10–30 s; staging-preview testers may briefly see permission errors on the first request after a redeploy.

Default pattern for owner-only single-doc-per-user collections (e.g. `userTrainingPlans`):

```
match /userTrainingPlans/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create, update: if request.auth != null
                        && request.auth.uid == userId
                        && request.resource.data.userId == userId;
  allow delete: if request.auth != null && request.auth.uid == userId;
}
```
