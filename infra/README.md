# Infrastructure Scripts

Shell scripts for managing the Firebase environments (staging + production).

## Scripts

| Script                   | Description                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `setup-staging.sh`       | One-time setup of the staging Firebase project (APIs, SA, IAM, secrets)                            |
| `teardown-staging.sh`    | Remove staging deploy resources (SA, secrets)                                                       |
| `setup-prod-secrets.sh`  | Idempotent IAM bindings for all `defineSecret()` secrets on the prod project (runs after a new secret is added) |

## Prerequisites

- `gcloud` CLI authenticated with project Owner access
- `gh` CLI authenticated for GitHub Secrets management
- `npx` available (for VAPID key generation)

## Usage

```bash
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
