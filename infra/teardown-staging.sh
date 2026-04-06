#!/usr/bin/env bash
# Teardown staging Firebase project resources.
# Removes the deploy service account, its keys, and GitHub secret.
# Does NOT delete the Firebase project itself.
#
# Usage:
#   ./infra/teardown-staging.sh
#   ./infra/teardown-staging.sh --dry-run

set -euo pipefail

PROJECT_ID="pushup-stats-staging-867b7"
SA_NAME="firebase-staging-deploy"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
GITHUB_REPO="WolfSoko/pushup-stats-service"
GITHUB_SECRET_NAME="FIREBASE_SERVICE_ACCOUNT_PUSHUP_STATS_STAGING"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN MODE ==="
  echo
fi

run() {
  echo "▶ $*"
  if [[ "$DRY_RUN" == false ]]; then
    "$@"
  fi
  echo
}

echo "═══ Remove GitHub Secret ═══"
run gh secret delete "$GITHUB_SECRET_NAME" -R "$GITHUB_REPO" || true

echo "═══ Delete Service Account ═══"
run gcloud iam service-accounts delete "$SA_EMAIL" \
  --project="$PROJECT_ID" --quiet || true

echo "═══ Delete VAPID Secrets ═══"
for secret in VAPID_PRIVATE_KEY VAPID_PUBLIC_KEY; do
  run gcloud secrets delete "$secret" --project="$PROJECT_ID" --quiet || true
done

echo "═══ Teardown Complete ═══"
echo "Note: The Firebase project ($PROJECT_ID) was NOT deleted."
echo "      Delete it manually in Firebase Console if no longer needed."
