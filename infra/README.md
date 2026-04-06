# Infrastructure Scripts

Shell scripts for managing the Firebase staging environment.

## Scripts

| Script                | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `setup-staging.sh`    | One-time setup of the staging Firebase project (APIs, SA, IAM, secrets) |
| `teardown-staging.sh` | Remove staging deploy resources (SA, secrets)                           |

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
```

## Configuration

Edit the variables at the top of each script to change:

- `PROJECT_ID` – Firebase/GCP project ID
- `REGION` – GCP region for Firestore and Functions
- `GITHUB_REPO` – GitHub repository for secrets
