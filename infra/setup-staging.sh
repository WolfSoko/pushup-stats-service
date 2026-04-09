#!/usr/bin/env bash
# Setup staging Firebase project infrastructure.
# Run once when creating a new staging project.
#
# Prerequisites:
#   - gcloud CLI authenticated with Owner access
#   - Firebase project already created in Firebase Console
#   - gh CLI authenticated (for GitHub Secrets)
#
# Usage:
#   ./infra/setup-staging.sh
#   ./infra/setup-staging.sh --dry-run   # Print commands without executing

set -euo pipefail

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
PROJECT_ID="pushup-stats-staging-867b7"
REGION="europe-west3"
SA_NAME="firebase-staging-deploy"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
GITHUB_REPO="WolfSoko/pushup-stats-service"
GITHUB_SECRET_NAME="FIREBASE_SERVICE_ACCOUNT_PUSHUP_STATS_STAGING"

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
# 1. Enable required APIs
# ──────────────────────────────────────────────
echo "═══ Step 1: Enable GCP APIs ═══"
APIS=(
  cloudfunctions.googleapis.com
  cloudbuild.googleapis.com
  artifactregistry.googleapis.com
  run.googleapis.com
  firestore.googleapis.com
  firebaserules.googleapis.com
  firebaseextensions.googleapis.com
  secretmanager.googleapis.com
  cloudscheduler.googleapis.com
  firebase.googleapis.com
  firebasehosting.googleapis.com
  identitytoolkit.googleapis.com
  fcmregistrations.googleapis.com
)

for api in "${APIS[@]}"; do
  run gcloud services enable "$api" --project="$PROJECT_ID"
done

# ──────────────────────────────────────────────
# 2. Create Service Account
# ──────────────────────────────────────────────
echo "═══ Step 2: Create deploy Service Account ═══"
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &>/dev/null; then
  echo "Service account $SA_EMAIL already exists, skipping creation."
else
  run gcloud iam service-accounts create "$SA_NAME" \
    --display-name="Firebase Staging Deploy (GitHub Actions)" \
    --project="$PROJECT_ID"
fi

# ──────────────────────────────────────────────
# 3. Grant IAM roles
# ──────────────────────────────────────────────
echo "═══ Step 3: Grant IAM roles to Service Account ═══"
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

for role in "${ROLES[@]}"; do
  run gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$role" \
    --condition=None \
    --quiet
done

# ──────────────────────────────────────────────
# 4. Create SA key and store as GitHub Secret
# ──────────────────────────────────────────────
echo "═══ Step 4: Create SA key → GitHub Secret ═══"
KEY_FILE=$(mktemp)
trap 'rm -f "$KEY_FILE"' EXIT

run gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SA_EMAIL"

if [[ "$DRY_RUN" == false ]]; then
  echo "▶ gh secret set $GITHUB_SECRET_NAME -R $GITHUB_REPO < (key file)"
  gh secret set "$GITHUB_SECRET_NAME" -R "$GITHUB_REPO" < "$KEY_FILE"
  echo "  ✔ GitHub Secret set."
else
  echo "▶ gh secret set $GITHUB_SECRET_NAME -R $GITHUB_REPO < (key file)"
fi
echo

# ──────────────────────────────────────────────
# 5. Create Firebase secrets (VAPID keys)
# ──────────────────────────────────────────────
echo "═══ Step 5: Create VAPID secrets ═══"
echo "Generating VAPID keys..."
if [[ "$DRY_RUN" == false ]]; then
  VAPID_OUTPUT=$(npx web-push generate-vapid-keys 2>/dev/null)
  VAPID_PUBLIC=$(echo "$VAPID_OUTPUT" | grep 'Public Key:' | awk '{print $NF}')
  VAPID_PRIVATE=$(echo "$VAPID_OUTPUT" | grep 'Private Key:' | awk '{print $NF}')

  echo "  Public Key:  ${VAPID_PUBLIC:0:20}..."
  echo "  Private Key: ${VAPID_PRIVATE:0:10}..."

  create_secret_if_missing() {
    local name="$1" value="$2"
    if gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
      echo "  Secret $name already exists, adding new version."
      echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT_ID"
    else
      echo -n "$value" | gcloud secrets create "$name" --data-file=- --project="$PROJECT_ID"
    fi
  }

  create_secret_if_missing "VAPID_PRIVATE_KEY" "$VAPID_PRIVATE"
  create_secret_if_missing "VAPID_PUBLIC_KEY" "$VAPID_PUBLIC"
  create_secret_if_missing "GITHUB_TOKEN" "placeholder-not-configured"

  echo
  echo "  ⚠  Update web/src/env/firebase-runtime.staging.ts vapidPublicKey:"
  echo "     $VAPID_PUBLIC"
  echo
  echo "  ⚠  Replace the GITHUB_TOKEN placeholder with a real PAT for issue creation:"
  echo "     firebase functions:secrets:set GITHUB_TOKEN --project $PROJECT_ID"
else
  echo "▶ npx web-push generate-vapid-keys"
  echo "▶ gcloud secrets create VAPID_PRIVATE_KEY ..."
  echo "▶ gcloud secrets create VAPID_PUBLIC_KEY ..."
  echo "▶ gcloud secrets create GITHUB_TOKEN (placeholder) ..."
fi
echo

# ──────────────────────────────────────────────
# 6. Summary
# ──────────────────────────────────────────────
echo "═══ Setup Complete ═══"
echo
echo "Staging project: $PROJECT_ID"
echo "Region:          $REGION"
echo "Service Account: $SA_EMAIL"
echo "GitHub Secret:   $GITHUB_SECRET_NAME"
echo
echo "Manual steps remaining:"
echo "  1. Create Firestore database in Firebase Console (region: $REGION)"
echo "  2. Enable Firebase Hosting in Firebase Console"
echo "  3. Enable Firebase Authentication providers as needed"
echo "  4. (Optional) Set GEMINI_API_KEY secret for motivation quotes"
echo "  5. (Optional) Configure reCAPTCHA Enterprise for staging"
