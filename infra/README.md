# Infrastructure Scripts

Shell scripts for managing the Firebase environments (staging + production).

## Scripts

| Script                  | Description                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `setup-wif.sh`          | Keyless GitHub Actions → GCP auth via Workload Identity Federation for prod + staging (deploy SA, WIF pool/provider, repo variables) |
| `setup-staging.sh`      | One-time setup of the staging Firebase project (APIs, SA, IAM, secrets)                                                              |
| `teardown-staging.sh`   | Remove staging deploy resources (SA, secrets)                                                                                        |
| `setup-prod-secrets.sh` | Idempotent IAM bindings for all `defineSecret()` secrets on the prod project (runs after a new secret is added)                      |

## Prerequisites

- `gcloud` CLI authenticated with project Owner access
- `gh` CLI authenticated for GitHub Secrets management
- `npx` available (for VAPID key generation)

## Usage

```bash
# One-time: set up keyless deploy auth (Workload Identity Federation)
./infra/setup-wif.sh --dry-run
./infra/setup-wif.sh

# Preview what will be done
./infra/setup-staging.sh --dry-run

# Run setup
./infra/setup-staging.sh

# Teardown (does NOT delete the Firebase project)
./infra/teardown-staging.sh

# Re-apply production secret IAM bindings (after adding a new Firebase secret)
./infra/setup-prod-secrets.sh --dry-run
./infra/setup-prod-secrets.sh
```

## Deploy Authentication (Workload Identity Federation)

The deploy workflows (`firebase-hosting-merge.yml`, `firebase-hosting-pull-request.yml`)
authenticate to GCP **without a long-lived service-account key**. GitHub mints a
short-lived OIDC token per run; GCP exchanges it for scoped credentials bound to
this repository only via Workload Identity Federation (WIF).

`setup-wif.sh` provisions everything (idempotent, both projects):

- a deploy service account with the deploy roles (same set as `setup-staging.sh`),
- a Workload Identity Pool + GitHub OIDC provider, restricted to this repo's owner,
- a `roles/iam.workloadIdentityUser` binding for this repo's principal,
- the GitHub **repository variables** the workflows read:

  | Variable                | Project                      |
  | ----------------------- | ---------------------------- |
  | `WIF_PROVIDER`          | `pushup-stats` (prod)        |
  | `WIF_DEPLOY_SA`         | `pushup-stats` (prod)        |
  | `WIF_PROVIDER_STAGING`  | `pushup-stats-staging-867b7` |
  | `WIF_DEPLOY_SA_STAGING` | `pushup-stats-staging-867b7` |

These are GitHub **variables** (not secrets) — the provider resource name and SA
email are not sensitive. The old `FIREBASE_SERVICE_ACCOUNT_*` JSON-key secrets are
no longer used; delete them once a deploy has succeeded (the script prints the
exact `gh secret delete` commands).

> **Auth note:** firebase-tools' own ADC exchange is unreliable with WIF
> external-account credentials — it surfaces a generic
> `Failed to authenticate, have you run firebase login?`
> ([firebase/firebase-tools#10726](https://github.com/firebase/firebase-tools/issues/10726)).
> The deploy workflows therefore set `token_format: access_token` on the
> `google-github-actions/auth` step (so the action runs the OIDC→STS→impersonation
> exchange itself) and pass the minted short-lived token to firebase-tools via
> `FIREBASE_TOKEN`, which firebase-tools uses directly as a bearer. `gcloud`
> continues to authenticate from the exported credential file for any ADC-based
> steps. The firebase commands still retry a few times to absorb transient
> deploy/network hiccups.

## Production Secrets Workflow

Whenever a new Cloud Function in `data-store/functions/src/**` introduces a
`defineSecret('FOO')`, the Cloud Functions deploy on `main` → `deploy` will
fail for the prod project until:

1. The secret value exists in Secret Manager:
   ```bash
   echo -n '<value>' | gcloud secrets create FOO --data-file=- --project=pushup-stats
   ```
2. The runtime service account can read it — **run `setup-prod-secrets.sh`**
   after adding the secret name to the `SECRETS=(…)` array in the script.

The script resolves the runtime SA dynamically from the project number, so it
works across projects and survives SA-name changes. It is idempotent — safe to
run on every deploy-time change.

## Configuration

Edit the variables at the top of each script to change:

- `PROJECT_ID` – Firebase/GCP project ID
- `REGION` – GCP region for Firestore and Functions
- `GITHUB_REPO` – GitHub repository for secrets
- `SECRETS` (in `setup-prod-secrets.sh`) – list of Firebase secrets managed by this repo
