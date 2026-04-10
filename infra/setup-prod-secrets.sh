#!/usr/bin/env bash
# Setup / repair IAM bindings for Firebase Cloud Functions secrets in the
# production project. Idempotent — safe to run multiple times.
#
# WHY THIS EXISTS:
# Firebase Functions v2 that use `defineSecret('FOO')` require the function's
# runtime Service Account to hold `roles/secretmanager.secretAccessor` on the
# secret. When a secret is first created (via the Firebase / GCP console or
# `gcloud secrets create`) it has ZERO IAM bindings. The Firebase CLI tries to
# add the binding at deploy time, but that needs `roles/secretmanager.admin`
# on the secret (or project-wide) — which the prod deploy SA intentionally
# does NOT have. Result: "Deploy Cloud Functions + Firestore rules & indexes"
# step fails with a permission error on the new secret.
#
# This script applies the missing IAM bindings in one idempotent run.
#
# Prerequisites:
#   - gcloud CLI authenticated with Owner / secretmanager.admin on the project
#   - Firebase project already exists with the secrets created (values set)
#
# Usage:
#   ./infra/setup-prod-secrets.sh
#   ./infra/setup-prod-secrets.sh --dry-run   # Print commands without executing

set -euo pipefail

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
PROJECT_ID="pushup-stats"

# Every secret referenced via `defineSecret()` in data-store/functions/src/**
# must be listed here so the runtime SA can read it at function invocation.
# Keep in sync with data-store/functions/src/index.ts.
SECRETS=(
  GITHUB_TOKEN
  VAPID_PRIVATE_KEY
  VAPID_PUBLIC_KEY
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
# 1. Resolve project number → runtime SA
# ──────────────────────────────────────────────
# Firebase Functions v2 default to the project's Compute Engine default SA
# as runtime identity:
#   <PROJECT_NUMBER>-compute@developer.gserviceaccount.com
# We derive the project number dynamically to avoid hard-coding.
echo "═══ Step 1: Resolve runtime service account ═══"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
if [[ -z "$PROJECT_NUMBER" ]]; then
  echo "ERROR: could not resolve projectNumber for $PROJECT_ID" >&2
  exit 1
fi
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "  Project:    $PROJECT_ID ($PROJECT_NUMBER)"
echo "  Runtime SA: $RUNTIME_SA"
echo

# ──────────────────────────────────────────────
# 2. Grant secretAccessor on every referenced secret
# ──────────────────────────────────────────────
echo "═══ Step 2: Grant runtime SA secretAccessor on every Functions secret ═══"
MISSING=()
for secret in "${SECRETS[@]}"; do
  if ! gcloud secrets describe "$secret" --project="$PROJECT_ID" &>/dev/null; then
    echo "  ⚠  Secret '$secret' does NOT exist in $PROJECT_ID — skipping."
    echo "     Create it first with:"
    echo "       echo -n '<VALUE>' | gcloud secrets create $secret --data-file=- --project=$PROJECT_ID"
    echo
    MISSING+=("$secret")
    continue
  fi

  run gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID" \
    --condition=None
done

# ──────────────────────────────────────────────
# 3. Summary
# ──────────────────────────────────────────────
echo "═══ Summary ═══"
echo "Project:    $PROJECT_ID"
echo "Runtime SA: $RUNTIME_SA"
echo "Secrets checked: ${SECRETS[*]}"
if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo
  echo "⚠  Missing secrets (create them, then re-run this script):"
  for secret in "${MISSING[@]}"; do
    echo "   - $secret"
  done
  exit 1
fi
echo
echo "✔ All IAM bindings applied. Next Firebase deploy should succeed."
echo "  Verify with:"
echo "    gcloud secrets get-iam-policy GITHUB_TOKEN --project=$PROJECT_ID"
