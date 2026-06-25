#!/usr/bin/env bash
# Setup keyless GitHub Actions → GCP auth via Workload Identity Federation (WIF)
# for the production and staging Firebase projects.
#
# WHY THIS EXISTS:
# The deploy workflows used to authenticate with a long-lived service-account
# JSON key stored in a GitHub secret. Those keys can be disabled/expired by an
# org policy with no warning, which silently breaks `firebase deploy` with
# "Failed to authenticate, have you run firebase login?". WIF removes the key
# entirely: GitHub mints a short-lived OIDC token per run, GCP exchanges it for
# scoped, short-lived credentials bound to this repo only.
#
# This script is idempotent — safe to run multiple times. It:
#   1. Enables the IAM/STS APIs WIF needs.
#   2. Creates the deploy service account (if missing) with the deploy roles.
#   3. Creates the Workload Identity Pool + GitHub OIDC provider.
#   4. Binds roles/iam.workloadIdentityUser for THIS repo's principal only.
#   5. Stores the provider resource name + SA email as GitHub repo variables
#      (vars.WIF_PROVIDER / vars.WIF_DEPLOY_SA and the *_STAGING pair) that the
#      deploy workflows read.
#
# Prerequisites:
#   - gcloud CLI authenticated with Owner (or equivalent) on both projects
#   - gh CLI authenticated (for setting GitHub repo variables)
#
# Usage:
#   ./infra/setup-wif.sh
#   ./infra/setup-wif.sh --dry-run   # Print commands without executing
#
# After running, delete the now-unused key-based secrets:
#   gh secret delete FIREBASE_SERVICE_ACCOUNT_PUSHUP_STATS
#   gh secret delete FIREBASE_SERVICE_ACCOUNT_PUSHUP_STATS_STAGING
# and (optionally) the corresponding SA keys in GCP.

set -euo pipefail

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
GITHUB_REPO="WolfSoko/pushup-stats-service"
GITHUB_OWNER="${GITHUB_REPO%%/*}"
POOL_ID="github-actions"
PROVIDER_ID="github"

# Deploy roles — identical to the key-based deploy SA (see setup-staging.sh).
ROLES=(
  roles/firebase.admin
  roles/cloudfunctions.developer
  roles/artifactregistry.writer
  roles/iam.serviceAccountUser
  roles/resourcemanager.projectIamAdmin
  roles/secretmanager.admin
  roles/run.admin
  roles/cloudscheduler.admin
)

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN MODE – commands will be printed but not executed ==="
  echo
fi

run() {
  echo "▶ $*"
  if [[ "$DRY_RUN" == false ]]; then
    "$@"
  fi
  echo
}

# ──────────────────────────────────────────────
# Per-project setup
#   $1 PROJECT_ID   $2 SA_NAME   $3 provider var name   $4 SA var name
# ──────────────────────────────────────────────
setup_project() {
  local project_id="$1" sa_name="$2" var_provider="$3" var_sa="$4"
  local sa_email="${sa_name}@${project_id}.iam.gserviceaccount.com"

  echo "═══════════════════════════════════════════════════════"
  echo "  Project: $project_id"
  echo "═══════════════════════════════════════════════════════"

  echo "── Enable WIF APIs ──"
  for api in iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com; do
    run gcloud services enable "$api" --project="$project_id"
  done

  echo "── Resolve project number ──"
  local project_number
  if [[ "$DRY_RUN" == false ]]; then
    project_number=$(gcloud projects describe "$project_id" --format='value(projectNumber)')
  else
    project_number="<PROJECT_NUMBER>"
  fi
  echo "  $project_id → $project_number"
  echo

  echo "── Deploy service account ──"
  if [[ "$DRY_RUN" == false ]] && gcloud iam service-accounts describe "$sa_email" --project="$project_id" &>/dev/null; then
    echo "  $sa_email already exists, skipping creation."
    echo
  else
    run gcloud iam service-accounts create "$sa_name" \
      --display-name="Firebase Deploy (GitHub Actions, WIF)" \
      --project="$project_id"
  fi

  echo "── Grant deploy roles ──"
  for role in "${ROLES[@]}"; do
    run gcloud projects add-iam-policy-binding "$project_id" \
      --member="serviceAccount:$sa_email" \
      --role="$role" \
      --condition=None \
      --quiet
  done

  echo "── Workload Identity Pool ──"
  if [[ "$DRY_RUN" == false ]] && gcloud iam workload-identity-pools describe "$POOL_ID" \
    --location=global --project="$project_id" &>/dev/null; then
    echo "  Pool $POOL_ID already exists, skipping creation."
    echo
  else
    run gcloud iam workload-identity-pools create "$POOL_ID" \
      --location=global \
      --display-name="GitHub Actions" \
      --project="$project_id"
  fi

  echo "── GitHub OIDC provider ──"
  if [[ "$DRY_RUN" == false ]] && gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
    --location=global --workload-identity-pool="$POOL_ID" --project="$project_id" &>/dev/null; then
    echo "  Provider $PROVIDER_ID already exists, skipping creation."
    echo
  else
    # attribute-condition restricts token exchange to this repo's owner so a
    # token from any other GitHub repo cannot impersonate the deploy SA.
    run gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
      --location=global \
      --workload-identity-pool="$POOL_ID" \
      --display-name="GitHub" \
      --issuer-uri="https://token.actions.githubusercontent.com" \
      --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
      --attribute-condition="assertion.repository_owner=='${GITHUB_OWNER}'" \
      --project="$project_id"
  fi

  echo "── Bind workloadIdentityUser for ${GITHUB_REPO} ──"
  run gcloud iam service-accounts add-iam-policy-binding "$sa_email" \
    --role=roles/iam.workloadIdentityUser \
    --member="principalSet://iam.googleapis.com/projects/${project_number}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}" \
    --project="$project_id" \
    --quiet

  local provider_resource="projects/${project_number}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"

  echo "── Set GitHub repo variables ──"
  run gh variable set "$var_provider" -R "$GITHUB_REPO" --body "$provider_resource"
  run gh variable set "$var_sa" -R "$GITHUB_REPO" --body "$sa_email"

  echo "  $var_provider = $provider_resource"
  echo "  $var_sa       = $sa_email"
  echo
}

# ──────────────────────────────────────────────
# Run for both environments
# ──────────────────────────────────────────────
setup_project "pushup-stats" "firebase-deploy" "WIF_PROVIDER" "WIF_DEPLOY_SA"
setup_project "pushup-stats-staging-867b7" "firebase-staging-deploy" "WIF_PROVIDER_STAGING" "WIF_DEPLOY_SA_STAGING"

echo "═══ WIF setup complete ═══"
echo
echo "The deploy workflows now authenticate without any long-lived key."
echo "Once a deploy has succeeded, remove the obsolete key-based secrets:"
echo "  gh secret delete FIREBASE_SERVICE_ACCOUNT_PUSHUP_STATS -R $GITHUB_REPO"
echo "  gh secret delete FIREBASE_SERVICE_ACCOUNT_PUSHUP_STATS_STAGING -R $GITHUB_REPO"
